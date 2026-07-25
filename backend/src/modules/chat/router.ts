import { Router } from 'express';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { chatRequestSchema } from './schemas.js';
import { answerChat } from './service.js';

export const chatRouter = Router();

// Every uncached question costs an LLM call, so this limit is a spend control as
// much as an abuse control (dev2 §13.5).
const chatRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: env.CHAT_RATE_LIMIT_PER_5MIN,
  message: 'Too many questions. Please wait a moment before asking again.',
});

chatRouter.post(
  '/chat',
  chatRateLimiter,
  asyncHandler(async (req, res) => {
    const body = chatRequestSchema.parse(req.body);
    res.json(await answerChat(body));
  }),
);
