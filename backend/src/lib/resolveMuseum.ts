import { prisma } from './prisma.js';
import { ApiError } from './errors.js';
import type { Museum } from '@prisma/client';

/**
 * Resolves the Museum that owns a given resource, always from the database
 * and never from the request body or query string.
 *
 * This helper is shared by:
 *   - requireMuseumScope (Dev 1) — compares resolved museumId against token
 *   - requireWithinTierLimit (Dev 3) — checks tier limits against the resolved museum
 *
 * Both must call this function so the two middleware cannot drift and develop
 * separate body-trusting code paths that create a bypass.
 */

export async function resolveMuseumByRoomId(roomId: string): Promise<Museum> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { museum: true },
  });
  if (!room) throw ApiError.notFound('Room');
  return room.museum;
}

export async function resolveMuseumByItemId(itemId: string): Promise<Museum> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { room: { include: { museum: true } } },
  });
  if (!item) throw ApiError.notFound('Item');
  return item.room.museum;
}

export async function resolveMuseumById(museumId: string): Promise<Museum> {
  const museum = await prisma.museum.findUnique({ where: { id: museumId } });
  if (!museum) throw ApiError.notFound('Museum');
  return museum;
}
