import type { Museum as MuseumRow } from '@prisma/client';
import bcrypt from 'bcrypt';
import type { Request } from 'express';
import { writeAuditLog } from '../../lib/auditLog.js';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type {
  AddMuseumAdminRequest,
  CreateMuseumRequest,
  Museum,
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
    ticketValidationUrl: row.ticketValidationUrl,
    systemPrompt: row.systemPrompt,
    defaultVoiceId: row.defaultVoiceId,
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

export async function listMuseums(query: { limit: number; cursor?: string }) {
  const rows = await prisma.museum.findMany({
    take: query.limit + 1,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    data: page.map(toMuseumDto),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function getMuseum(id: string): Promise<Museum> {
  return toMuseumDto(await findMuseumRowOrThrow(id));
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
      data: { name: input.name, slug: input.slug },
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

/**
 * §14.1: `status` is system-only; the other three fields are gated by
 * requireMuseumScope rather than role, so the museum's own admin may set
 * them. The router enforces scope; this function enforces the status split.
 */
export async function updateMuseum(
  id: string,
  input: UpdateMuseumRequest,
  actor: { id: string; role: 'SYSTEM_ADMIN' | 'MUSEUM_ADMIN' },
): Promise<Museum> {
  if (input.status !== undefined && actor.role !== 'SYSTEM_ADMIN') {
    throw ApiError.forbidden('Only a system administrator may change museum status.');
  }

  const before = await findMuseumRowOrThrow(id);

  const updated = await prisma.$transaction(async (tx) => {
    const museum = await tx.museum.update({ where: { id }, data: input });

    await writeAuditLog(tx, {
      adminUserId: actor.id,
      museumId: museum.id,
      action: 'UPDATE',
      entityType: 'Museum',
      entityId: museum.id,
      before: {
        status: before.status,
        ticketValidationUrl: before.ticketValidationUrl,
        systemPrompt: before.systemPrompt,
        defaultVoiceId: before.defaultVoiceId,
      },
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
      data: { email, passwordHash, role: 'MUSEUM_ADMIN', museumId },
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
