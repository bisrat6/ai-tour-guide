import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { createRateLimiter } from '../../middleware/rateLimit';
import { env } from '../../config/env';
import { chatRequestSchema } from './schemas';
import { answerChat } from './service';

export const chatRouter = Router();

const chatRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: env.CHAT_RATE_LIMIT_PER_5MIN,
});

chatRouter.post(
  '/chat',
  chatRateLimiter,
  asyncHandler(async (req, res) => {
    const body = chatRequestSchema.parse(req.body);
    const result = await answerChat(body);
    res.json(result);
  })
);
