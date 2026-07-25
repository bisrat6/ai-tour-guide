import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { requireParam } from '../../lib/params.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireMuseumScope } from '../../middleware/requireMuseumScope.js';
import { requireRole } from '../../middleware/requireRole.js';
import {
  addMuseumAdminRequestSchema,
  createMuseumRequestSchema,
  getMuseumQuerySchema,
  listMuseumsQuerySchema,
  updateMuseumRequestSchema,
} from './schemas.js';
import {
  addMuseumAdmin,
  createMuseum,
  getMuseum,
  listMuseums,
  resolveMuseumIdFromParam,
  updateMuseum,
} from './service.js';

export const museumsRouter = Router();

// §14.1: every route below requires an authenticated admin; per-route
// requireRole/requireMuseumScope calls layer the finer-grained access rules.
museumsRouter.use(requireAuth);

museumsRouter.get(
  '/museums',
  requireRole('SYSTEM_ADMIN'),
  asyncHandler(async (req, res) => {
    const query = listMuseumsQuerySchema.parse(req.query);
    res.json(await listMuseums(query));
  }),
);

museumsRouter.get(
  '/museums/:id',
  requireMuseumScope(resolveMuseumIdFromParam),
  asyncHandler(async (req, res) => {
    const query = getMuseumQuerySchema.parse(req.query);
    res.json(await getMuseum(requireParam(req, 'id'), query.withStats));
  }),
);

museumsRouter.post(
  '/museums',
  requireRole('SYSTEM_ADMIN'),
  asyncHandler(async (req, res) => {
    const body = createMuseumRequestSchema.parse(req.body);
    if (!req.admin) throw ApiError.unauthenticated();
    res.status(201).json(await createMuseum(body, req.admin.id));
  }),
);

museumsRouter.patch(
  '/museums/:id',
  requireMuseumScope(resolveMuseumIdFromParam),
  asyncHandler(async (req, res) => {
    const body = updateMuseumRequestSchema.parse(req.body);
    if (!req.admin) throw ApiError.unauthenticated();
    res.json(await updateMuseum(requireParam(req, 'id'), body, req.admin));
  }),
);

// Scoped, not operator-only: a museum has to be able to staff itself without
// filing a ticket. The role is hard-coded to MUSEUM_ADMIN and the museum comes
// from the path, so this can only ever mint a seat inside the caller's own
// tenant — minting an operator stays behind POST /admin/admins.
museumsRouter.post(
  '/museums/:id/admins',
  requireMuseumScope(resolveMuseumIdFromParam),
  asyncHandler(async (req, res) => {
    const body = addMuseumAdminRequestSchema.parse(req.body);
    if (!req.admin) throw ApiError.unauthenticated();
    res.status(201).json(await addMuseumAdmin(requireParam(req, 'id'), body, req.admin.id));
  }),
);
