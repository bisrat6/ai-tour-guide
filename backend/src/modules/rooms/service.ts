import type { AdminRole, Room as RoomRow } from '@prisma/client';
import type { Request } from 'express';
import { writeAuditLog } from '../../lib/auditLog.js';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { toItemDto } from '../items/service.js';
import type { CreateRoomRequest, Room, RoomWithItems, UpdateRoomRequest } from './schemas.js';

function toRoomDto(row: RoomRow): Room {
  return {
    id: row.id,
    legacyId: row.legacyId,
    museumId: row.museumId,
    storyOrder: row.storyOrder,
    title: row.title,
    roomOverviewText: row.roomOverviewText,
    narrationScript: row.narrationScript,
    roomAudioUrl: row.roomAudioUrl,
    nextRoomId: row.nextRoomId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function findRoomRowOrThrow(id: string): Promise<RoomRow> {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) {
    throw ApiError.notFound('Room not found.');
  }
  return room;
}

/** Resolver for requireMuseumScope on `/rooms/:id` routes. */
export async function resolveRoomMuseumId(req: Request): Promise<string | null> {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    select: { museumId: true },
  });
  return room?.museumId ?? null;
}

/**
 * §14.2: never trust a museumId from the query string over the one on the
 * token. A MUSEUM_ADMIN's own museumId always wins; a SYSTEM_ADMIN must
 * supply one explicitly since it has no museum of its own.
 */
function resolveScopedMuseumId(
  admin: { role: AdminRole; museumId: string | null },
  requestedMuseumId: string | undefined,
): string {
  if (admin.role === 'SYSTEM_ADMIN') {
    if (!requestedMuseumId) {
      throw ApiError.validation([
        { path: 'museumId', message: 'museumId is required for SYSTEM_ADMIN.' },
      ]);
    }
    return requestedMuseumId;
  }
  return admin.museumId as string;
}

/**
 * §14.3: walks the nextRoomId chain in-memory (one query for the whole
 * museum, bounded by its room count) to detect a cycle before it's written.
 */
async function formsCycle(museumId: string, roomId: string, nextRoomId: string): Promise<boolean> {
  const rooms = await prisma.room.findMany({
    where: { museumId },
    select: { id: true, nextRoomId: true },
  });
  const nextById = new Map(rooms.map((r) => [r.id, r.nextRoomId]));

  let current: string | null = nextRoomId;
  const visited = new Set<string>();
  while (current) {
    if (current === roomId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = nextById.get(current) ?? null;
  }
  return false;
}

/**
 * §14.3: same-museum (v1) plus cycle detection (M2). `roomId` is null on
 * create — a brand-new room can never already appear in an existing chain.
 */
async function assertValidNextRoomId(
  museumId: string,
  roomId: string | null,
  nextRoomId: string,
): Promise<void> {
  const target = await prisma.room.findUnique({
    where: { id: nextRoomId },
    select: { museumId: true },
  });
  if (!target || target.museumId !== museumId) {
    throw ApiError.invalidRoomSequence('nextRoomId must belong to the same museum.');
  }
  if (roomId && (await formsCycle(museumId, roomId, nextRoomId))) {
    throw ApiError.invalidRoomSequence('nextRoomId would create a cycle.');
  }
}

async function assertStoryOrderAvailable(
  museumId: string,
  storyOrder: number,
  excludeRoomId?: string,
): Promise<void> {
  const existing = await prisma.room.findUnique({
    where: { museumId_storyOrder: { museumId, storyOrder } },
    select: { id: true },
  });
  if (existing && existing.id !== excludeRoomId) {
    throw ApiError.conflict('storyOrder is already used by another room in this museum.');
  }
}

export async function listRooms(
  admin: { role: AdminRole; museumId: string | null },
  query: { limit: number; cursor?: string; museumId?: string },
) {
  const museumId = resolveScopedMuseumId(admin, query.museumId);

  const rows = await prisma.room.findMany({
    where: { museumId },
    take: query.limit + 1,
    orderBy: [{ storyOrder: 'asc' }, { id: 'asc' }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    data: page.map(toRoomDto),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function getRoom(id: string): Promise<RoomWithItems> {
  const room = await findRoomRowOrThrow(id);
  const items = await prisma.item.findMany({
    where: { roomId: id },
    orderBy: { displayOrder: 'asc' },
  });
  return { ...toRoomDto(room), items: items.map(toItemDto) };
}

export async function createRoom(
  input: CreateRoomRequest,
  actor: { id: string; role: AdminRole; museumId: string | null },
): Promise<Room> {
  // Acceptance: created under the correct museum regardless of what the
  // body claims — a MUSEUM_ADMIN's supplied museumId (if any) is ignored.
  const museumId =
    actor.role === 'SYSTEM_ADMIN'
      ? resolveScopedMuseumId(actor, input.museumId)
      : (actor.museumId as string);

  await assertStoryOrderAvailable(museumId, input.storyOrder);
  if (input.nextRoomId) {
    await assertValidNextRoomId(museumId, null, input.nextRoomId);
  }

  const room = await prisma.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: {
        museumId,
        title: input.title,
        roomOverviewText: input.roomOverviewText,
        narrationScript: input.narrationScript,
        storyOrder: input.storyOrder,
        nextRoomId: input.nextRoomId ?? null,
      },
    });

    await writeAuditLog(tx, {
      adminUserId: actor.id,
      museumId,
      action: 'CREATE',
      entityType: 'Room',
      entityId: room.id,
      after: { title: room.title, storyOrder: room.storyOrder, nextRoomId: room.nextRoomId },
    });

    return room;
  });

  return toRoomDto(room);
}

export async function updateRoom(
  id: string,
  input: UpdateRoomRequest,
  actorId: string,
): Promise<Room> {
  const before = await findRoomRowOrThrow(id);

  if (input.storyOrder !== undefined) {
    await assertStoryOrderAvailable(before.museumId, input.storyOrder, id);
  }
  if (input.nextRoomId) {
    await assertValidNextRoomId(before.museumId, id, input.nextRoomId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const room = await tx.room.update({ where: { id }, data: input });

    // §14.2: any content edit invalidates chat answers cached against the
    // old text — deletion, unlike create, has no cascade to rely on here.
    await tx.chatAnswer.deleteMany({ where: { roomId: id } });

    await writeAuditLog(tx, {
      adminUserId: actorId,
      museumId: room.museumId,
      action: 'UPDATE',
      entityType: 'Room',
      entityId: room.id,
      before: {
        title: before.title,
        roomOverviewText: before.roomOverviewText,
        narrationScript: before.narrationScript,
        storyOrder: before.storyOrder,
        nextRoomId: before.nextRoomId,
      },
      after: input,
    });

    return room;
  });

  return toRoomDto(updated);
}

export async function deleteRoom(
  id: string,
  opts: { force: boolean },
  actorId: string,
): Promise<void> {
  const room = await findRoomRowOrThrow(id);

  const referencingCount = await prisma.room.count({ where: { nextRoomId: id } });
  if (referencingCount > 0 && !opts.force) {
    throw ApiError.roomReferenced();
  }

  await prisma.$transaction(async (tx) => {
    // onDelete: Cascade on Item and ChatAnswer, onDelete: SetNull on any
    // other room's nextRoomId pointing here — all enforced at the DB level.
    await tx.room.delete({ where: { id } });

    await writeAuditLog(tx, {
      adminUserId: actorId,
      museumId: room.museumId,
      action: 'DELETE',
      entityType: 'Room',
      entityId: id,
      before: { title: room.title, storyOrder: room.storyOrder },
    });
  });
}
