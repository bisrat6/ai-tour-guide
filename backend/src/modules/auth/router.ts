import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { loginRateLimiter } from '../../middleware/rateLimit.js';
import { loginRequestSchema } from './schemas.js';
import { login } from './service.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const body = loginRequestSchema.parse(req.body);
    const result = await login(body);
    res.json(result);
  }),
);
