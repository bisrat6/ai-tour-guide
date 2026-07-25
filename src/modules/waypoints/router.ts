import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { museumSlugParamsSchema, waypointParamsSchema } from './schemas';
import { getMuseumBySlug, getWaypoint } from './service';

export const waypointsRouter = Router();

waypointsRouter.get(
  '/waypoint/:id',
  asyncHandler(async (req, res) => {
    const { id } = waypointParamsSchema.parse(req.params);
    const waypoint = await getWaypoint(id);
    res.json(waypoint);
  })
);

waypointsRouter.get(
  '/museums/:slug',
  asyncHandler(async (req, res) => {
    const { slug } = museumSlugParamsSchema.parse(req.params);
    const museum = await getMuseumBySlug(slug);
    res.json(museum);
  })
);
