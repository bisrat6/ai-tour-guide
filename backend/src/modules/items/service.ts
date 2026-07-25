import type { Item as ItemRow } from '@prisma/client';
import type { Request } from 'express';
import { writeAuditLog } from '../../lib/auditLog.js';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { assertMuseumScope } from '../../middleware/requireMuseumScope.js';
import type { AdminContext } from '../../types/express.js';
import type { CreateItemRequest, Item, UpdateItemRequest } from './schemas.js';

/**
 * Shared with rooms/service.ts, which embeds items in GET /admin/rooms/:id
 * (§14.2).
 */
export function toItemDto(row: ItemRow): Item {
  return {
    id: row.id,
    legacyId: row.legacyId,
    roomId: row.roomId,
    name: row.name,
    shortDescription: row.shortDescription,
    detailText: row.detailText,
    imageUrl: row.imageUrl,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function findRoomOrThrow(roomId: string): Promise<{ id: string; museumId: string }> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, museumId: true },
  });
  if (!room) {
    throw ApiError.notFound('Room not found.');
  }
  return room;
}

async function findItemWithRoomOrThrow(
  id: string,
): Promise<ItemRow & { room: { museumId: string } }> {
  const item = await prisma.item.findUnique({
    where: { id },
    include: { room: { select: { museumId: true } } },
  });
  if (!item) {
    throw ApiError.notFound('Item not found.');
  }
  return item;
}

/** Resolver for requireMuseumScope on `/items/:id` routes — §14.4's "scope resolved through item.room.museumId". */
export async function resolveItemMuseumId(req: Request): Promise<string | null> {
  const item = await prisma.item.findUnique({
    where: { id: req.params.id },
    select: { room: { select: { museumId: true } } },
  });
  return item?.room.museumId ?? null;
}

export async function listItems(
  admin: AdminContext,
  query: { roomId: string; limit: number; cursor?: string },
) {
  const room = await findRoomOrThrow(query.roomId);
  assertMuseumScope(admin, room.museumId);

  const rows = await prisma.item.findMany({
    where: { roomId: query.roomId },
    take: query.limit + 1,
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    data: page.map(toItemDto),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function createItem(input: CreateItemRequest, admin: AdminContext): Promise<Item> {
  const room = await findRoomOrThrow(input.roomId);
  assertMuseumScope(admin, room.museumId);

  const item = await prisma.$transaction(async (tx) => {
    const displayOrder =
      input.displayOrder ?? (await tx.item.count({ where: { roomId: input.roomId } }));

    const item = await tx.item.create({
      data: {
        roomId: input.roomId,
        name: input.name,
        shortDescription: input.shortDescription,
        detailText: input.detailText,
        imageUrl: input.imageUrl ?? null,
        displayOrder,
      },
    });

    // §14.4: a new item can change what a "what's in this room" answer
    // should say, so any answer cached for the room is invalidated too.
    await tx.chatAnswer.deleteMany({ where: { roomId: input.roomId } });

    await writeAuditLog(tx, {
      adminUserId: admin.id,
      museumId: room.museumId,
      action: 'CREATE',
      entityType: 'Item',
      entityId: item.id,
      after: { name: item.name, roomId: item.roomId, displayOrder: item.displayOrder },
    });

    return item;
  });

  return toItemDto(item);
}

export async function updateItem(
  id: string,
  input: UpdateItemRequest,
  admin: AdminContext,
): Promise<Item> {
  const before = await findItemWithRoomOrThrow(id);

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.item.update({ where: { id }, data: input });

    await tx.chatAnswer.deleteMany({ where: { roomId: before.roomId } });

    await writeAuditLog(tx, {
      adminUserId: admin.id,
      museumId: before.room.museumId,
      action: 'UPDATE',
      entityType: 'Item',
      entityId: item.id,
      before: {
        name: before.name,
        shortDescription: before.shortDescription,
        detailText: before.detailText,
        imageUrl: before.imageUrl,
        displayOrder: before.displayOrder,
      },
      after: input,
    });

    return item;
  });

  return toItemDto(updated);
}

export async function deleteItem(id: string, admin: AdminContext): Promise<void> {
  const item = await findItemWithRoomOrThrow(id);

  await prisma.$transaction(async (tx) => {
    // onDelete: SetNull already clears ChatAnswer.itemId for answers about
    // this specific item; the explicit purge below covers room-level
    // answers too, since "what's in this room" just became stale.
    await tx.item.delete({ where: { id } });
    await tx.chatAnswer.deleteMany({ where: { roomId: item.roomId } });

    await writeAuditLog(tx, {
      adminUserId: admin.id,
      museumId: item.room.museumId,
      action: 'DELETE',
      entityType: 'Item',
      entityId: id,
      before: { name: item.name, roomId: item.roomId },
    });
  });
}

/**
 * §14.4 "New" route: bulk reorder in one transaction, because reordering
 * one at a time means N requests and transient duplicate orderings. The
 * body must name exactly the set of items already in the room — anything
 * else (missing, extra, or foreign items) is a 400, not a partial apply.
 */
export async function reorderRoomItems(
  roomId: string,
  itemIds: string[],
  admin: AdminContext,
): Promise<void> {
  const room = await findRoomOrThrow(roomId);
  assertMuseumScope(admin, room.museumId);

  const existing = await prisma.item.findMany({ where: { roomId }, select: { id: true } });
  const existingIds = new Set(existing.map((i) => i.id));
  const requestedIds = new Set(itemIds);

  if (itemIds.length !== existingIds.size || [...requestedIds].some((id) => !existingIds.has(id))) {
    throw ApiError.validation([
      {
        path: 'itemIds',
        message: 'itemIds must be exactly the set of items already in this room.',
      },
    ]);
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      itemIds.map((id, index) => tx.item.update({ where: { id }, data: { displayOrder: index } })),
    );

    await writeAuditLog(tx, {
      adminUserId: admin.id,
      museumId: room.museumId,
      action: 'UPDATE',
      entityType: 'Room',
      entityId: roomId,
      after: { reorderedItemIds: itemIds },
    });
  });
}
