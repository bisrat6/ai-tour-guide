import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { listAuditLogsQuerySchema } from './schemas.js';
import { listAuditLogs } from './service.js';

export const auditRouter = Router();

auditRouter.use(requireAuth);

/**
 * Scope is applied inside the service from req.admin, so there is no
 * requireMuseumScope here — there is no single resource to resolve, and a
 * museum admin's rows are filtered rather than refused.
 */
auditRouter.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const query = listAuditLogsQuerySchema.parse(req.query);
    res.json(await listAuditLogs(req.admin, query));
  }),
);
