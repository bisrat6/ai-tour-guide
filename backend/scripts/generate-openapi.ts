/**
 * Generates backend/openapi/openapi.yaml from the Zod schemas under
 * backend/src/modules/*\/schemas.ts, so the contract cannot drift from the
 * code (D1-0, §2.5 Process changes P3 in docs/backend-implementation-plan.md).
 *
 * Run with: npm run generate:openapi
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { stringify } from 'yaml';
import { z } from 'zod';

import { errorEnvelopeSchema } from '../src/shared/errorEnvelope.js';
import { loginRequestSchema, loginResponseSchema } from '../src/modules/auth/schemas.js';
import {
  addMuseumAdminRequestSchema,
  adminUserSchema,
  createMuseumRequestSchema,
  createMuseumResponseSchema,
  listMuseumsQuerySchema,
  listMuseumsResponseSchema,
  museumSchema,
  updateMuseumRequestSchema,
} from '../src/modules/museums/schemas.js';
import {
  createRoomRequestSchema,
  deleteRoomQuerySchema,
  listRoomsQuerySchema,
  listRoomsResponseSchema,
  reorderItemsRequestSchema,
  roomSchema,
  roomWithItemsSchema,
  updateRoomRequestSchema,
} from '../src/modules/rooms/schemas.js';
import {
  createItemRequestSchema,
  itemSchema,
  listItemsQuerySchema,
  listItemsResponseSchema,
  updateItemRequestSchema,
} from '../src/modules/items/schemas.js';

const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Admin JWT from POST /admin/login. See §8.',
});

const idParam = z.object({ id: z.uuid() });

/** Standard error responses shared by every admin route (§7.2). */
function errorResponses(...statuses: number[]) {
  const responses: Record<
    number,
    { description: string; content: { 'application/json': { schema: typeof errorEnvelopeSchema } } }
  > = {};
  const descriptions: Record<number, string> = {
    400: 'Malformed or missing request fields (VALIDATION_ERROR).',
    401: 'Missing, invalid, or expired token (UNAUTHENTICATED / INVALID_CREDENTIALS).',
    403: 'Wrong role or wrong museum scope (FORBIDDEN / CROSS_TENANT_ACCESS).',
    404: 'Resource does not exist.',
    409: 'Unique constraint conflict, or a room delete blocked by a reference (CONFLICT / ROOM_REFERENCED).',
    422: 'nextRoomId crosses museums or forms a cycle (INVALID_ROOM_SEQUENCE).',
    429: 'Rate limited (RATE_LIMITED).',
  };
  for (const status of statuses) {
    responses[status] = {
      description: descriptions[status] ?? 'Error.',
      content: { 'application/json': { schema: errorEnvelopeSchema } },
    };
  }
  return responses;
}

// --- Auth (§8) --------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/admin/login',
  tags: ['Auth'],
  summary: 'Admin login',
  request: {
    body: { content: { 'application/json': { schema: loginRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Login succeeded.',
      content: { 'application/json': { schema: loginResponseSchema } },
    },
    ...errorResponses(400, 401, 429),
  },
});

// --- Museums (§14.1) ----------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/admin/museums',
  tags: ['Museums'],
  summary: 'List museums (SYSTEM_ADMIN only)',
  security: [{ [bearerAuth.name]: [] }],
  request: { query: listMuseumsQuerySchema },
  responses: {
    200: {
      description: 'Paginated list of museums.',
      content: { 'application/json': { schema: listMuseumsResponseSchema } },
    },
    ...errorResponses(401, 403),
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/museums/{id}',
  tags: ['Museums'],
  summary: 'Get a museum by id',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam },
  responses: {
    200: {
      description: 'The museum.',
      content: { 'application/json': { schema: museumSchema } },
    },
    ...errorResponses(401, 403, 404),
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/museums',
  tags: ['Museums'],
  summary: 'Create a museum and its first MUSEUM_ADMIN (SYSTEM_ADMIN only)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: { content: { 'application/json': { schema: createMuseumRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Museum and admin created in one transaction.',
      content: { 'application/json': { schema: createMuseumResponseSchema } },
    },
    ...errorResponses(400, 401, 403, 409),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/museums/{id}',
  tags: ['Museums'],
  summary:
    'Update a museum. status is SYSTEM_ADMIN-only; the rest are writable by the museum\u2019s own admin.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: updateMuseumRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Updated museum.',
      content: { 'application/json': { schema: museumSchema } },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/museums/{id}/admins',
  tags: ['Museums'],
  summary: 'Add a further admin to an existing museum (SYSTEM_ADMIN only)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: addMuseumAdminRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Admin created.',
      content: { 'application/json': { schema: adminUserSchema } },
    },
    ...errorResponses(400, 401, 403, 404, 409),
  },
});

// --- Rooms (§14.2, §14.3) ------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/admin/rooms',
  tags: ['Rooms'],
  summary: 'List rooms, scoped to the caller\u2019s museum unless SYSTEM_ADMIN',
  security: [{ [bearerAuth.name]: [] }],
  request: { query: listRoomsQuerySchema },
  responses: {
    200: {
      description: 'Paginated list of rooms.',
      content: { 'application/json': { schema: listRoomsResponseSchema } },
    },
    ...errorResponses(400, 401, 403),
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/rooms/{id}',
  tags: ['Rooms'],
  summary: 'Get a room by id, including items',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam },
  responses: {
    200: {
      description: 'The room, with its items.',
      content: { 'application/json': { schema: roomWithItemsSchema } },
    },
    ...errorResponses(401, 403, 404),
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/rooms',
  tags: ['Rooms'],
  summary: 'Create a room',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: { content: { 'application/json': { schema: createRoomRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Room created.',
      content: { 'application/json': { schema: roomSchema } },
    },
    ...errorResponses(400, 401, 403, 409, 422),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/rooms/{id}',
  tags: ['Rooms'],
  summary: 'Update a room',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: updateRoomRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Updated room.',
      content: { 'application/json': { schema: roomSchema } },
    },
    ...errorResponses(400, 401, 403, 404, 409, 422),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/rooms/{id}',
  tags: ['Rooms'],
  summary: 'Delete a room',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam, query: deleteRoomQuerySchema },
  responses: {
    204: { description: 'Room deleted.' },
    ...errorResponses(401, 403, 404, 409),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/rooms/{id}/items/order',
  tags: ['Rooms'],
  summary: 'Bulk-reorder a room\u2019s items in one transaction',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: reorderItemsRequestSchema } } },
  },
  responses: {
    200: { description: 'Items reordered.' },
    ...errorResponses(400, 401, 403, 404),
  },
});

// --- Items (§14.4) -------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/admin/items',
  tags: ['Items'],
  summary: 'List items for a room',
  security: [{ [bearerAuth.name]: [] }],
  request: { query: listItemsQuerySchema },
  responses: {
    200: {
      description: 'Paginated list of items.',
      content: { 'application/json': { schema: listItemsResponseSchema } },
    },
    ...errorResponses(400, 401, 403),
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/items',
  tags: ['Items'],
  summary: 'Create an item',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: { content: { 'application/json': { schema: createItemRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Item created.',
      content: { 'application/json': { schema: itemSchema } },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/items/{id}',
  tags: ['Items'],
  summary: 'Update an item',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: updateItemRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Updated item.',
      content: { 'application/json': { schema: itemSchema } },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/items/{id}',
  tags: ['Items'],
  summary: 'Delete an item',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam },
  responses: {
    204: { description: 'Item deleted.' },
    ...errorResponses(401, 403, 404),
  },
});

// --- Generate -------------------------------------------------------------

const generator = new OpenApiGeneratorV31(registry.definitions);

const document = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    version: '0.1.0',
    title: 'Adwa AI Tour Guide — Admin API',
    description:
      'Developer 1\u2019s admin surface (auth, museums, rooms, items). Generated from Zod schemas — do not hand-edit. See docs/backend-implementation-plan.md and developer1-detailed-plan.md.',
  },
  servers: [{ url: '/', description: 'Relative to wherever the API is deployed' }],
});

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'openapi');
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, 'openapi.yaml');
await writeFile(outFile, stringify(document), 'utf-8');

console.log(`Wrote ${outFile}`);
