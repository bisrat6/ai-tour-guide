import { z } from 'zod';

export const waypointParamsSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export const museumSlugParamsSchema = z.object({
  slug: z.string().min(1, 'slug is required'),
});

export type WaypointParams = z.infer<typeof waypointParamsSchema>;
export type MuseumSlugParams = z.infer<typeof museumSlugParamsSchema>;
