import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { requireParam } from '../../lib/params.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import {
  createAdminRequestSchema,
  listAdminsQuerySchema,
  updateAdminRequestSchema,
} from './schemas.js';
import { createAdmin, deleteAdmin, listAdmins, updateAdmin } from './service.js';

export const adminsRouter = Router();

// Row-level scope is enforced in the service (a museum admin never sees an
// operator account), so these routes only require authentication — except
// creation, which can mint an operator and is therefore role-gated.
adminsRouter.use(requireAuth);

adminsRouter.get(
  '/admins',
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const query = listAdminsQuerySchema.parse(req.query);
    res.json(await listAdmins(req.admin, query));
  }),
);

adminsRouter.post(
  '/admins',
  requireRole('SYSTEM_ADMIN'),
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const body = createAdminRequestSchema.parse(req.body);
    res.status(201).json(await createAdmin(req.admin, body));
  }),
);

adminsRouter.patch(
  '/admins/:id',
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const body = updateAdminRequestSchema.parse(req.body);
    res.json(await updateAdmin(req.admin, requireParam(req, 'id'), body));
  }),
);

adminsRouter.delete(
  '/admins/:id',
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    await deleteAdmin(req.admin, requireParam(req, 'id'));
    res.status(204).send();
  }),
);
