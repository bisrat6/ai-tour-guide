import { z } from 'zod';

export const roomNarrationParamsSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
});

export const answerNarrationParamsSchema = z.object({
  answerId: z.string().min(1, 'answerId is required'),
});
