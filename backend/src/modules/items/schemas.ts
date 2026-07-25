import { z } from 'zod';
import { paginatedResponseSchema, paginationQuerySchema } from '../../shared/pagination.js';

/**
 * §14.4 Items.
 */

export const itemSchema = z
  .object({
    id: z.uuid(),
    legacyId: z.string().nullable(),
    roomId: z.uuid(),
    name: z.string(),
    shortDescription: z.string(),
    detailText: z.string(),
    imageUrl: z.url().nullable(),
    displayOrder: z.int().min(0),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Item' });

export const listItemsQuerySchema = paginationQuerySchema.extend({
  roomId: z.uuid(),
});
export const listItemsResponseSchema = paginatedResponseSchema(itemSchema).meta({
  id: 'ListItemsResponse',
});

export const createItemRequestSchema = z
  .object({
    roomId: z.uuid(),
    name: z.string().min(1),
    shortDescription: z.string().min(1),
    detailText: z.string().min(1),
    imageUrl: z.url().nullable().optional(),
    displayOrder: z.int().min(0).optional(),
  })
  .meta({ id: 'CreateItemRequest' });

export const updateItemRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    shortDescription: z.string().min(1).optional(),
    detailText: z.string().min(1).optional(),
    imageUrl: z.url().nullable().optional(),
    displayOrder: z.int().min(0).optional(),
  })
  .meta({ id: 'UpdateItemRequest' });

export type Item = z.infer<typeof itemSchema>;
export type CreateItemRequest = z.infer<typeof createItemRequestSchema>;
export type UpdateItemRequest = z.infer<typeof updateItemRequestSchema>;
