import type { Museum } from '@prisma/client';
import { ApiError } from './errors.js';
import { prisma } from './prisma.js';

/**
 * Resolves the owning museum of a resource from the database rather than from a
 * request body or query field (dev3 §8.2). Scope decisions must be made against
 * stored ownership, otherwise a caller could name someone else's museum.
 */

export async function resolveMuseumByRoomId(roomId: string): Promise<Museum> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { museum: true },
  });
  if (!room) throw ApiError.notFound('Room not found.');
  return room.museum;
}

export async function resolveMuseumByItemId(itemId: string): Promise<Museum> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { room: { include: { museum: true } } },
  });
  if (!item) throw ApiError.notFound('Item not found.');
  return item.room.museum;
}

export async function resolveMuseumById(museumId: string): Promise<Museum> {
  const museum = await prisma.museum.findUnique({ where: { id: museumId } });
  if (!museum) throw ApiError.notFound('Museum not found.');
  return museum;
}
