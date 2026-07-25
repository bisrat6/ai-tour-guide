import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { createRateLimiter } from '../../middleware/rateLimit';
import { answerNarrationParamsSchema, roomNarrationParamsSchema } from './schemas';
import { streamAnswerNarration, streamRoomNarration } from './service';

export const narrateRouter = Router();

const narrateRateLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 60 });

narrateRouter.get(
  '/narrate/room/:roomId',
  narrateRateLimiter,
  asyncHandler(async (req, res) => {
    const { roomId } = roomNarrationParamsSchema.parse(req.params);
    await streamRoomNarration(roomId, res);
  })
);

narrateRouter.get(
  '/narrate/answer/:answerId',
  narrateRateLimiter,
  asyncHandler(async (req, res) => {
    const { answerId } = answerNarrationParamsSchema.parse(req.params);
    await streamAnswerNarration(answerId, res);
  })
);
