import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/errors';

export interface WaypointItemResponse {
  id: string;
  name: string;
  shortDescription: string;
  detailText: string;
  imageUrl: string | null;
}

export interface WaypointResponse {
  id: string;
  storyOrder: number;
  title: string;
  roomOverviewText: string;
  roomAudioUrl: string | null;
  nextRoomId: string | null;
  items: WaypointItemResponse[];
}

export interface MuseumSummaryResponse {
  id: string;
  name: string;
  slug: string;
  ticketRequired: boolean;
}

/**
 * GET /waypoint/:id (§9.1). A suspended museum's content is deliberately
 * indistinguishable from content that never existed — 404, not a special
 * error that reveals platform-internal state to a visitor.
 */
export async function getWaypoint(id: string): Promise<WaypointResponse> {
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      museum: true,
      items: { orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] },
    },
  });

  if (!room || room.museum.status === 'SUSPENDED') {
    throw ApiError.notFound('Waypoint not found');
  }

  return {
    id: room.id,
    storyOrder: room.storyOrder,
    title: room.title,
    roomOverviewText: room.roomOverviewText,
    roomAudioUrl: room.roomAudioUrl,
    nextRoomId: room.nextRoomId,
    items: room.items.map((item) => ({
      id: item.id,
      name: item.name,
      shortDescription: item.shortDescription,
      detailText: item.detailText,
      imageUrl: item.imageUrl,
    })),
  };
}

/** GET /museums/:slug (§9.3, M5). */
export async function getMuseumBySlug(slug: string): Promise<MuseumSummaryResponse> {
  const museum = await prisma.museum.findUnique({ where: { slug } });

  if (!museum || museum.status === 'SUSPENDED') {
    throw ApiError.notFound('Museum not found');
  }

  return {
    id: museum.id,
    name: museum.name,
    slug: museum.slug,
    ticketRequired: museum.ticketValidationUrl !== null,
  };
}
