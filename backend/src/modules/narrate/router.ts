import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { answerNarrationParamsSchema, roomNarrationParamsSchema } from './schemas.js';
import { streamAnswerNarration, streamRoomNarration } from './service.js';

export const narrateRouter = Router();

// Higher than the chat limit: a cache hit here is cheap, and a visitor walking a
// museum legitimately requests narration for every room.
const narrateRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: 'Too many narration requests. Please wait a moment.',
});

narrateRouter.get(
  '/narrate/room/:roomId',
  narrateRateLimiter,
  asyncHandler(async (req, res) => {
    const { roomId } = roomNarrationParamsSchema.parse(req.params);
    await streamRoomNarration(roomId, res);
  }),
);

narrateRouter.get(
  '/narrate/answer/:answerId',
  narrateRateLimiter,
  asyncHandler(async (req, res) => {
    const { answerId } = answerNarrationParamsSchema.parse(req.params);
    await streamAnswerNarration(answerId, res);
  }),
);
