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
import { healthResponseSchema } from '../src/modules/health/schemas.js';
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
import {
  createAdminRequestSchema,
  listAdminsQuerySchema,
  listAdminsResponseSchema,
  updateAdminRequestSchema,
} from '../src/modules/admins/schemas.js';
import {
  listAuditLogsQuerySchema,
  listAuditLogsResponseSchema,
} from '../src/modules/audit/schemas.js';
import {
  overviewQuerySchema,
  systemHealthSchema,
  tenantOverviewSchema,
} from '../src/modules/overview/schemas.js';
import {
  checkoutRequestSchema,
  manualTierRequestSchema,
  spendQuerySchema,
  spendResponseSchema,
} from '../src/modules/billing/schemas.js';
import {
  validateTicketRequestSchema,
  validateTicketResponseSchema,
} from '../src/modules/tickets/schemas.js';

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
    413: 'Request body exceeds the 100kb cap (VALIDATION_ERROR).',
    422: 'nextRoomId crosses museums or forms a cycle (INVALID_ROOM_SEQUENCE).',
    429: 'Rate limited (RATE_LIMITED).',
    503: 'A dependency is unreachable (UPSTREAM_UNAVAILABLE).',
  };
  for (const status of statuses) {
    responses[status] = {
      description: descriptions[status] ?? 'Error.',
      content: { 'application/json': { schema: errorEnvelopeSchema } },
    };
  }
  return responses;
}

// --- Health (D1-1) ------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Liveness and database reachability',
  description:
    'Unauthenticated. Performs a real SELECT 1, so a deployment with a broken connection string fails its health check instead of serving 500s on every other route.',
  responses: {
    200: {
      description: 'Service is up and the database answered.',
      content: { 'application/json': { schema: healthResponseSchema } },
    },
    ...errorResponses(503),
  },
});

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
    ...errorResponses(400, 401, 413, 429),
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
    ...errorResponses(400, 401, 403, 409, 413),
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
    ...errorResponses(400, 401, 403, 404, 413),
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
    ...errorResponses(400, 401, 403, 404, 409, 413),
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
    ...errorResponses(400, 401, 403, 409, 413, 422),
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
    ...errorResponses(400, 401, 403, 404, 409, 413, 422),
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
    // 400: force must be exactly "true" or "false" — anything else is
    // rejected rather than guessed at, since guessing wrong deletes data.
    ...errorResponses(400, 401, 403, 404, 409),
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
    ...errorResponses(400, 401, 403, 404, 413),
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
    // 404: the room named by ?roomId must be loaded before scope can be
    // checked against it, so an unknown roomId is an absence, not a 400.
    ...errorResponses(400, 401, 403, 404),
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
    ...errorResponses(400, 401, 403, 404, 413),
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
    ...errorResponses(400, 401, 403, 404, 413),
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

// --- Admin users ----------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/admin/admins',
  tags: ['Admins'],
  summary: 'List admin accounts',
  description:
    'A MUSEUM_ADMIN sees only its own museum\u2019s seats and never an operator account; scope comes from the token, not from ?museumId.',
  security: [{ [bearerAuth.name]: [] }],
  request: { query: listAdminsQuerySchema },
  responses: {
    200: {
      description: 'Paginated list of admin accounts.',
      content: { 'application/json': { schema: listAdminsResponseSchema } },
    },
    ...errorResponses(400, 401),
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/admins',
  tags: ['Admins'],
  summary: 'Create an admin account (SYSTEM_ADMIN only)',
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: createAdminRequestSchema } } } },
  responses: {
    201: {
      description: 'Account created, in INVITED status until its first login.',
      content: { 'application/json': { schema: adminUserSchema } },
    },
    ...errorResponses(400, 401, 403, 404, 409, 413),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/admins/{id}',
  tags: ['Admins'],
  summary: 'Update an admin\u2019s display name, status, or password',
  description:
    'Role is deliberately not editable: moving a seat across the tenant boundary in one PATCH would be a silent privilege change. Delete and re-create instead.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: updateAdminRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Updated account.',
      content: { 'application/json': { schema: adminUserSchema } },
    },
    ...errorResponses(400, 401, 403, 404, 409, 413),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/admins/{id}',
  tags: ['Admins'],
  summary: 'Delete an admin account',
  description:
    'Refused for your own account, and for a museum\u2019s last active administrator \u2014 both would strand someone.',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam },
  responses: {
    204: { description: 'Account deleted. Its audit trail is retained.' },
    ...errorResponses(401, 403, 404, 409),
  },
});

// --- Audit ----------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/admin/audit-logs',
  tags: ['Audit'],
  summary: 'Read the admin audit trail',
  description:
    'Newest first. A MUSEUM_ADMIN sees only its own museum\u2019s rows; control-plane events, which carry no museumId, stay invisible to it.',
  security: [{ [bearerAuth.name]: [] }],
  request: { query: listAuditLogsQuerySchema },
  responses: {
    200: {
      description: 'Paginated audit entries.',
      content: { 'application/json': { schema: listAuditLogsResponseSchema } },
    },
    ...errorResponses(400, 401),
  },
});

// --- Overview and system health -------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/admin/overview',
  tags: ['Overview'],
  summary: 'Authoring readiness for one museum',
  security: [{ [bearerAuth.name]: [] }],
  request: { query: overviewQuerySchema },
  responses: {
    200: {
      description: 'Counts plus a per-room readiness breakdown.',
      content: { 'application/json': { schema: tenantOverviewSchema } },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/system/health',
  tags: ['Overview'],
  summary: 'Outbound dependency status (SYSTEM_ADMIN only)',
  description:
    'Reports configuration and circuit-breaker state. It does not probe the vendors: pinging a paid API on every dashboard load is a bill, not a feature, so an adapter nothing has called yet reports "unknown".',
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: 'Adapter states as this process currently sees them.',
      content: { 'application/json': { schema: systemHealthSchema } },
    },
    ...errorResponses(401, 403, 503),
  },
});

// --- Billing (dev3 §12) ---------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/admin/billing/checkout',
  tags: ['Billing'],
  summary: 'Start a subscription checkout',
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: checkoutRequestSchema } } } },
  responses: {
    201: { description: 'Checkout created; redirect the caller to checkoutUrl.' },
    ...errorResponses(400, 401, 403, 404, 409, 413, 429, 503),
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/billing/spend',
  tags: ['Billing'],
  summary: 'Collected revenue per museum (SYSTEM_ADMIN only)',
  security: [{ [bearerAuth.name]: [] }],
  request: { query: spendQuerySchema },
  responses: {
    200: {
      description: 'Per-museum totals over the requested window.',
      content: { 'application/json': { schema: spendResponseSchema } },
    },
    ...errorResponses(400, 401, 403),
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/billing/tier',
  tags: ['Billing'],
  summary: 'Manually override a museum\u2019s tier (SYSTEM_ADMIN only)',
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: manualTierRequestSchema } } } },
  responses: {
    200: { description: 'Tier applied and recorded in the audit trail.' },
    ...errorResponses(400, 401, 403, 404, 413),
  },
});

// --- Tickets (visitor-facing, unauthenticated) ----------------------------

registry.registerPath({
  method: 'post',
  path: '/tickets/validate',
  tags: ['Tickets'],
  summary: 'Check a visitor ticket against the museum\u2019s vendor',
  description:
    'Unauthenticated and rate limited twice: per caller IP, and per museum so one tenant cannot exhaust the vendor allowance. ticketRequired=false means the museum has no gate configured, so valid is vacuously true.',
  request: { body: { content: { 'application/json': { schema: validateTicketRequestSchema } } } },
  responses: {
    200: {
      description: 'Validation result.',
      content: { 'application/json': { schema: validateTicketResponseSchema } },
    },
    ...errorResponses(400, 404, 413, 422, 429, 503),
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
      'The full admin surface: auth, museums, admin users, rooms, items, audit, overview, billing, and the visitor ticket check. Generated from Zod schemas — do not hand-edit. Every JSON request body is capped at 100kb globally; routes that accept a body therefore declare 413. See docs/backend-implementation-plan.md and developer1-detailed-plan.md.',
  },
  servers: [{ url: '/', description: 'Relative to wherever the API is deployed' }],
});

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'openapi');
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, 'openapi.yaml');
await writeFile(outFile, stringify(document), 'utf-8');

console.log(`Wrote ${outFile}`);
