import type { Museum as MuseumRow, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import type { Request } from 'express';
import { writeAuditLog } from '../../lib/auditLog.js';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type {
  AddMuseumAdminRequest,
  CreateMuseumRequest,
  ListMuseumsQuery,
  Museum,
  MuseumStats,
  MuseumWithStats,
  UpdateMuseumRequest,
} from './schemas.js';

/**
 * §14.1. Only the plain columns cross the API boundary — never the
 * AdminUser relation, and never a raw Date (the schema commits to ISO
 * strings via z.iso.datetime()).
 */
function toMuseumDto(row: MuseumRow): Museum {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    cityCountry: row.cityCountry,

    ticketValidationUrl: row.ticketValidationUrl,
    gateMode: row.gateMode,
    allowedTicketPrefix: row.allowedTicketPrefix,
    graceWindowMinutes: row.graceWindowMinutes,

    systemPrompt: row.systemPrompt,
    personaName: row.personaName,
    guideStyleTone: row.guideStyleTone,

    defaultVoiceId: row.defaultVoiceId,
    // Prisma hands back a Decimal; the contract commits to a JSON number.
    speakingRate: Number(row.speakingRate),
    pronunciationHints: row.pronunciationHints,

    tier: row.tier,
    subscriptionStatus: row.subscriptionStatus,
    subscriptionRenewsAt: row.subscriptionRenewsAt?.toISOString() ?? null,

    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function findMuseumRowOrThrow(id: string): Promise<MuseumRow> {
  const museum = await prisma.museum.findUnique({ where: { id } });
  if (!museum) {
    throw ApiError.notFound('Museum not found.');
  }
  return museum;
}

/**
 * A room counts as narrated once its script is more than a token placeholder.
 * The console draws a readiness marker per room from the same rule, so it
 * lives here rather than being re-derived on the client.
 */
const MIN_NARRATION_CHARS = 40;

/**
 * Counts for one museum, in as few queries as the shape allows. Rooms are
 * fetched once and reduced in memory: the sequence walk needs the whole
 * nextRoomId graph anyway, and a museum's room count is small by design.
 */
export async function computeMuseumStats(museumId: string): Promise<MuseumStats> {
  const [rooms, itemCount, adminCount] = await Promise.all([
    prisma.room.findMany({
      where: { museumId },
      select: {
        id: true,
        storyOrder: true,
        nextRoomId: true,
        narrationScript: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
      orderBy: { storyOrder: 'asc' },
    }),
    prisma.item.count({ where: { room: { museumId } } }),
    prisma.adminUser.count({ where: { museumId } }),
  ]);

  const nextById = new Map(rooms.map((room) => [room.id, room.nextRoomId]));
  let roomsInSequence = 0;
  let cursor: string | null = rooms[0]?.id ?? null;
  const seen = new Set<string>();
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor);
    roomsInSequence += 1;
    cursor = nextById.get(cursor) ?? null;
  }

  const lastEditedAt = rooms.reduce<Date | null>(
    (latest, room) => (latest === null || room.updatedAt > latest ? room.updatedAt : latest),
    null,
  );

  return {
    roomCount: rooms.length,
    itemCount,
    adminCount,
    roomsMissingNarration: rooms.filter(
      (room) => room.narrationScript.trim().length < MIN_NARRATION_CHARS,
    ).length,
    roomsWithoutItems: rooms.filter((room) => room._count.items === 0).length,
    roomsReady: rooms.filter(
      (room) =>
        room.narrationScript.trim().length >= MIN_NARRATION_CHARS && room._count.items > 0,
    ).length,
    roomsInSequence,
    lastEditedAt: lastEditedAt?.toISOString() ?? null,
  };
}

/**
 * Resolver for requireMuseumScope on routes shaped `/:id` where the museum
 * itself *is* the resource — the "resource's museumId" is just its own id.
 * A missing museum still returns null so requireMuseumScope turns it into a
 * 404 before it ever compares against req.admin.museumId.
 */
export async function resolveMuseumIdFromParam(req: Request): Promise<string | null> {
  const museum = await prisma.museum.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  return museum?.id ?? null;
}

export async function listMuseums(query: ListMuseumsQuery) {
  const where: Prisma.MuseumWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { slug: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const rows = await prisma.museum.findMany({
    where,
    take: query.limit + 1,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;

  if (!query.withStats) {
    return { data: page.map(toMuseumDto), nextCursor };
  }

  const withStats: MuseumWithStats[] = await Promise.all(
    page.map(async (row) => ({ ...toMuseumDto(row), stats: await computeMuseumStats(row.id) })),
  );
  return { data: withStats, nextCursor };
}

export async function getMuseum(id: string, withStats = false): Promise<Museum | MuseumWithStats> {
  const museum = toMuseumDto(await findMuseumRowOrThrow(id));
  if (!withStats) return museum;
  return { ...museum, stats: await computeMuseumStats(id) };
}

interface CreatedAdmin {
  id: string;
  email: string;
  role: 'MUSEUM_ADMIN';
  museumId: string;
}

/**
 * §14.1: creates the Museum and its first MUSEUM_ADMIN in one transaction —
 * a museum nobody can log into is a dead end. Slug/email uniqueness is
 * checked up front for a specific 409 message; the transaction's own unique
 * constraints are still the source of truth against a concurrent request.
 */
export async function createMuseum(
  input: CreateMuseumRequest,
  actorAdminId: string,
): Promise<{ museum: Museum; admin: CreatedAdmin }> {
  const email = input.adminEmail.trim().toLowerCase();

  const [slugTaken, emailTaken] = await Promise.all([
    prisma.museum.findUnique({ where: { slug: input.slug }, select: { id: true } }),
    prisma.adminUser.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (slugTaken) {
    throw ApiError.conflict('A museum with this slug already exists.');
  }
  if (emailTaken) {
    throw ApiError.conflict('An admin with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.adminPassword, 12);

  const { museum, admin } = await prisma.$transaction(async (tx) => {
    const museum = await tx.museum.create({
      data: { name: input.name, slug: input.slug, cityCountry: input.cityCountry ?? null },
    });
    const admin = await tx.adminUser.create({
      data: { email, passwordHash, role: 'MUSEUM_ADMIN', museumId: museum.id },
    });

    await writeAuditLog(tx, {
      adminUserId: actorAdminId,
      museumId: museum.id,
      action: 'CREATE',
      entityType: 'Museum',
      entityId: museum.id,
      after: { name: museum.name, slug: museum.slug },
    });
    await writeAuditLog(tx, {
      adminUserId: actorAdminId,
      museumId: museum.id,
      action: 'CREATE',
      entityType: 'AdminUser',
      entityId: admin.id,
      after: { email: admin.email, role: admin.role, museumId: admin.museumId },
    });

    return { museum, admin };
  });

  return {
    museum: toMuseumDto(museum),
    admin: { id: admin.id, email: admin.email, role: 'MUSEUM_ADMIN', museumId: museum.id },
  };
}

/** Fields only a system administrator may write. The rest are the museum's own. */
const SYSTEM_ONLY_FIELDS = ['status'] as const satisfies readonly (keyof UpdateMuseumRequest)[];

/**
 * §14.1: `status` is system-only; everything else is gated by
 * requireMuseumScope rather than role, so the museum's own admin may set it.
 * The router enforces scope; this function enforces the status split.
 */
export async function updateMuseum(
  id: string,
  input: UpdateMuseumRequest,
  actor: { id: string; role: 'SYSTEM_ADMIN' | 'MUSEUM_ADMIN' },
): Promise<Museum> {
  if (actor.role !== 'SYSTEM_ADMIN') {
    const attempted = SYSTEM_ONLY_FIELDS.filter((field) => input[field] !== undefined);
    if (attempted.length > 0) {
      throw ApiError.forbidden(
        `Only a system administrator may change: ${attempted.join(', ')}.`,
      );
    }
  }

  const before = await findMuseumRowOrThrow(id);

  if (input.slug !== undefined && input.slug !== before.slug) {
    const taken = await prisma.museum.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (taken) {
      throw ApiError.conflict('A museum with this slug already exists.');
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const museum = await tx.museum.update({ where: { id }, data: input });

    // Only the fields this request actually touched, so the trail reads as a
    // diff rather than a snapshot of every column on every edit.
    const changedKeys = Object.keys(input) as (keyof UpdateMuseumRequest)[];
    const beforeSubset = Object.fromEntries(
      changedKeys.map((key) => [key, before[key as keyof MuseumRow] ?? null]),
    );

    await writeAuditLog(tx, {
      adminUserId: actor.id,
      museumId: museum.id,
      action: 'UPDATE',
      entityType: 'Museum',
      entityId: museum.id,
      before: beforeSubset,
      after: input,
    });

    return museum;
  });

  return toMuseumDto(updated);
}

export async function addMuseumAdmin(
  museumId: string,
  input: AddMuseumAdminRequest,
  actorAdminId: string,
): Promise<CreatedAdmin> {
  await findMuseumRowOrThrow(museumId);

  const email = input.email.trim().toLowerCase();
  const emailTaken = await prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
  if (emailTaken) {
    throw ApiError.conflict('An admin with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const admin = await prisma.$transaction(async (tx) => {
    const admin = await tx.adminUser.create({
      data: {
        email,
        passwordHash,
        role: 'MUSEUM_ADMIN',
        museumId,
        displayName: input.displayName ?? null,
        // Created by someone else and never signed into yet.
        status: 'INVITED',
      },
    });

    await writeAuditLog(tx, {
      adminUserId: actorAdminId,
      museumId,
      action: 'CREATE',
      entityType: 'AdminUser',
      entityId: admin.id,
      after: { email: admin.email, role: admin.role, museumId: admin.museumId },
    });

    return admin;
  });

  return { id: admin.id, email: admin.email, role: 'MUSEUM_ADMIN', museumId };
}
