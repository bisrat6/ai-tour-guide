import { z } from 'zod';

export const chatRequestSchema = z.object({
  waypointId: z.string().min(1, 'waypointId is required'),
  itemId: z.string().min(1).nullable().optional(),
  question: z.string('question is required'),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
