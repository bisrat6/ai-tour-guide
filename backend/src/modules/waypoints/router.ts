import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { museumSlugParamsSchema, waypointParamsSchema } from './schemas.js';
import { getMuseumBySlug, getWaypoint } from './service.js';

export const waypointsRouter = Router();

waypointsRouter.get(
  '/waypoint/:id',
  asyncHandler(async (req, res) => {
    const { id } = waypointParamsSchema.parse(req.params);
    res.json(await getWaypoint(id));
  }),
);

waypointsRouter.get(
  '/museums/:slug',
  asyncHandler(async (req, res) => {
    const { slug } = museumSlugParamsSchema.parse(req.params);
    res.json(await getMuseumBySlug(slug));
  }),
);
