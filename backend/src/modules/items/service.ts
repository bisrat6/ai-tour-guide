import type { Item as ItemRow } from '@prisma/client';
import type { Item } from './schemas.js';

/**
 * Shared with rooms/service.ts, which embeds items in GET /admin/rooms/:id
 * (§14.2) ahead of D1-6 adding the rest of the item CRUD surface here.
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
