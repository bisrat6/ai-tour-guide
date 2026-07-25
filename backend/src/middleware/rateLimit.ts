import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../lib/errors.js';

/**
 * Generic per-IP limiter factory (§8.1, reused by §13.1 for /chat later).
 * In-memory store — fine for the single-instance deployment this plan
 * targets (§8.5's "reasonable cuts for an internal tool"); would need a
 * shared store (e.g. Redis) behind a load balancer with multiple instances.
 *
 * Skipped in NODE_ENV=test so integration tests can exercise lockout and
 * credential failures without also tripping the per-IP cap.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  /**
   * Buckets by something other than IP — e.g. the museum a request names, so
   * one busy tenant cannot exhaust the shared allowance. Setting this disables
   * express-rate-limit's IP-shape validation, which only applies to IP keys.
   */
  keyGenerator?: (req: Request) => string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    ...(options.keyGenerator ? { keyGenerator: options.keyGenerator, validate: false } : {}),
    handler: (_req, _res, next) => {
      next(ApiError.rateLimited(options.message));
    },
  });
}

// §8.1: 10 login attempts per IP per 15 minutes.
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts from this address. Try again later.',
});
