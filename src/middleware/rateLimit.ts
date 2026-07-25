import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Per-IP sliding-window rate limiter (§13.1). A shared museum Wi-Fi network
 * puts many visitors behind one IP, so these are starting values to tune
 * against real traffic, not final ones.
 */
export function createRateLimiter(options: { windowMs: number; max: number }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.setHeader('Retry-After', String(Math.ceil(options.windowMs / 1000)));
      res.status(429).json({
        error: {
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMITED',
          requestId: req.requestId,
        },
      });
    },
  });
}
