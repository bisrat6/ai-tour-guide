import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { overviewQuerySchema } from './schemas.js';
import { getSystemHealth, getTenantOverview } from './service.js';

export const overviewRouter = Router();

overviewRouter.use(requireAuth);

overviewRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const query = overviewQuerySchema.parse(req.query);
    res.json(await getTenantOverview(req.admin, query.museumId));
  }),
);

/**
 * Operator-only, and deliberately separate from the unauthenticated /health
 * used as a deploy gate: this one names the vendors and reports breaker state,
 * which is not something to publish to anonymous callers.
 */
overviewRouter.get(
  '/system/health',
  requireRole('SYSTEM_ADMIN'),
  asyncHandler(async (_req, res) => {
    res.json(await getSystemHealth());
  }),
);
