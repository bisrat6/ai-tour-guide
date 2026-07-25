import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { appVersion } from '../../lib/version.js';
import { prisma } from '../../lib/prisma.js';

export const healthRouter = Router();

/**
 * Real database round-trip, deliberately — a deploy with a broken
 * connection string must fail its health check instead of serving 500s on
 * every other route (§D1-1 exit criteria).
 */
healthRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const start = performance.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      req.log.error({ err }, 'Health check database ping failed.');
      throw ApiError.upstreamUnavailable('Database is unreachable.');
    }
    const dbLatencyMs = Math.round(performance.now() - start);
    res.json({ status: 'ok', dbLatencyMs, version: appVersion });
  }),
);
