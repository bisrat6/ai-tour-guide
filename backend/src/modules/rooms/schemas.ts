import { z } from 'zod';
import { itemSchema } from '../items/schemas.js';
import { paginatedResponseSchema, paginationQuerySchema } from '../../shared/pagination.js';

/**
 * §14.2 Rooms, §14.3 Room sequence validation.
 */

export const roomSchema = z
  .object({
    id: z.uuid(),
    legacyId: z
      .string()
      .nullable()
      .meta({ description: 'Original id from data/*.json, see §16.1.' }),
    museumId: z.uuid(),
    storyOrder: z.int().min(1),
    title: z.string(),
    roomOverviewText: z.string().meta({ description: 'Grounding prose for chat.' }),
    narrationScript: z.string().meta({ description: 'Spoken script sent to TTS.' }),
    roomAudioUrl: z.url().nullable(),
    nextRoomId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Room' });

// §14.2: GET /admin/rooms/:id "includes items" — a distinct response shape
// from the plain Room used everywhere else, so the paginated list stays cheap.
export const roomWithItemsSchema = roomSchema
  .extend({ items: z.array(itemSchema) })
  .meta({ id: 'RoomWithItems' });

export const listRoomsQuerySchema = paginationQuerySchema.extend({
  museumId: z.uuid().optional().meta({
    description:
      'Required for SYSTEM_ADMIN. Ignored for MUSEUM_ADMIN — req.admin.museumId is used instead (§14.2).',
  }),
});
export const listRoomsResponseSchema = paginatedResponseSchema(roomSchema).meta({
  id: 'ListRoomsResponse',
});

export const createRoomRequestSchema = z
  .object({
    museumId: z
      .uuid()
      .optional()
      .meta({ description: 'Required for SYSTEM_ADMIN, taken from the token for MUSEUM_ADMIN.' }),
    title: z.string().min(1),
    roomOverviewText: z.string().min(1),
    narrationScript: z.string().min(1),
    storyOrder: z.int().min(1),
    nextRoomId: z.uuid().nullable().optional(),
  })
  .meta({ id: 'CreateRoomRequest' });

export const updateRoomRequestSchema = z
  .object({
    title: z.string().min(1).optional(),
    roomOverviewText: z.string().min(1).optional(),
    narrationScript: z.string().min(1).optional(),
    storyOrder: z.int().min(1).optional(),
    nextRoomId: z.uuid().nullable().optional(),
  })
  .meta({ id: 'UpdateRoomRequest' });

export const deleteRoomQuerySchema = z
  .object({
    force: z.coerce.boolean().optional().meta({
      description:
        'Null out other rooms\u2019 nextRoomId instead of returning 409 ROOM_REFERENCED.',
    }),
  })
  .meta({ id: 'DeleteRoomQuery' });

export const reorderItemsRequestSchema = z
  .object({
    itemIds: z.array(z.uuid()).min(1),
  })
  .meta({ id: 'ReorderItemsRequest' });

export type Room = z.infer<typeof roomSchema>;
export type RoomWithItems = z.infer<typeof roomWithItemsSchema>;
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;
export type UpdateRoomRequest = z.infer<typeof updateRoomRequestSchema>;
export type DeleteRoomQuery = z.infer<typeof deleteRoomQuerySchema>;
