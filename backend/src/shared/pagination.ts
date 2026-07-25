import { z } from 'zod';

/**
 * Shared cursor-pagination query params for every admin list route (§14).
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .meta({ description: 'Page size. Defaults to 50, capped at 200.' }),
  cursor: z.string().optional().meta({ description: 'Opaque cursor from a previous page.' }),
});

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  });
}
