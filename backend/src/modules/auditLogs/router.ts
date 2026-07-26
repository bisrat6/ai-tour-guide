import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { listAuditLogsQuerySchema } from './schemas.js';
import { listAuditLogs } from './service.js';

export const auditLogsRouter = Router();

auditLogsRouter.use(requireAuth);

/**
 * No requireMuseumScope here: there is no single resource to resolve a museum
 * from. Scope is applied inside the query instead, which narrows a museum
 * admin to its own rows rather than refusing the request.
 */
auditLogsRouter.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const query = listAuditLogsQuerySchema.parse(req.query);
    if (!req.admin) throw ApiError.unauthenticated();
    res.json(await listAuditLogs(req.admin, query));
  }),
);
