import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { requireParam } from '../../lib/params.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireMuseumScope } from '../../middleware/requireMuseumScope.js';
import {
  createItemRequestSchema,
  listItemsQuerySchema,
  updateItemRequestSchema,
} from './schemas.js';
import { createItem, deleteItem, listItems, resolveItemMuseumId, updateItem } from './service.js';

export const itemsRouter = Router();

// §14.4: every route is scoped through item.room.museumId. GET and POST
// resolve the room from a query/body field, so scope is checked inline in
// the service after that room is loaded; PATCH/DELETE resolve straight from
// the path param via requireMuseumScope, same as rooms.
itemsRouter.use(requireAuth);

itemsRouter.get(
  '/items',
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const query = listItemsQuerySchema.parse(req.query);
    res.json(await listItems(req.admin, query));
  }),
);

itemsRouter.post(
  '/items',
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const body = createItemRequestSchema.parse(req.body);
    res.status(201).json(await createItem(body, req.admin));
  }),
);

itemsRouter.patch(
  '/items/:id',
  requireMuseumScope(resolveItemMuseumId),
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    const body = updateItemRequestSchema.parse(req.body);
    res.json(await updateItem(requireParam(req, 'id'), body, req.admin));
  }),
);

itemsRouter.delete(
  '/items/:id',
  requireMuseumScope(resolveItemMuseumId),
  asyncHandler(async (req, res) => {
    if (!req.admin) throw ApiError.unauthenticated();
    await deleteItem(requireParam(req, 'id'), req.admin);
    res.status(204).send();
  }),
);
