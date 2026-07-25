import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { requireParam } from '../../lib/params.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireMuseumScope } from '../../middleware/requireMuseumScope.js';
import { reorderRoomItems } from '../items/service.js';
import {
  createRoomRequestSchema,
  deleteRoomQuerySchema,
  listRoomsQuerySchema,
  reorderItemsRequestSchema,
  updateRoomRequestSchema,
} from './schemas.js';
import {
  createRoom,
  deleteRoom,
  getRoom,
  listRooms,
  resolveRoomMuseumId,
  updateRoom,
} from './service.js';

export const roomsRouter = Router();

// §14.2: every route is scoped to the caller's museum. GET (list) and POST
// resolve scope inline (there's no existing record to check yet); the
// single-room routes below use requireMuseumScope against the DB record.
roomsRouter.use(requireAuth);

roomsRouter.get(
  '/rooms',
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const query = listRoomsQuerySchema.parse(req.query);
    res.json(await listRooms(req.admin, query));
  }),
);

roomsRouter.get(
  '/rooms/:id',
  requireMuseumScope(resolveRoomMuseumId),
  asyncHandler(async (req, res) => {
    res.json(await getRoom(requireParam(req, 'id')));
  }),
);

roomsRouter.post(
  '/rooms',
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const body = createRoomRequestSchema.parse(req.body);
    res.status(201).json(await createRoom(body, req.admin));
  }),
);

roomsRouter.patch(
  '/rooms/:id',
  requireMuseumScope(resolveRoomMuseumId),
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const body = updateRoomRequestSchema.parse(req.body);
    res.json(await updateRoom(requireParam(req, 'id'), body, req.admin.id));
  }),
);

roomsRouter.delete(
  '/rooms/:id',
  requireMuseumScope(resolveRoomMuseumId),
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const query = deleteRoomQuerySchema.parse(req.query);
    await deleteRoom(requireParam(req, 'id'), { force: query.force }, req.admin.id);
    res.status(204).send();
  }),
);

// §14.4 "New" route: lives under /rooms because the path does, but the
// reorder logic itself is an items concern (items/service.ts).
roomsRouter.patch(
  '/rooms/:id/items/order',
  requireMuseumScope(resolveRoomMuseumId),
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const body = reorderItemsRequestSchema.parse(req.body);
    await reorderRoomItems(requireParam(req, 'id'), body.itemIds, req.admin);
    res.json({ ok: true });
  }),
);
