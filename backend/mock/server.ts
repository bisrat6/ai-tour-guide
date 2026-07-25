/**
 * D1-0 mock server: implements the admin surface documented in
 * backend/openapi/openapi.yaml against in-memory fixtures derived from
 * data/*.json (see mock/fixtures.ts), so Developers 2 and 3 can write and
 * run real client code before the real Express app (D1-1+) exists.
 *
 * This is intentionally not the real implementation — no Postgres, no
 * Prisma, no real JWTs, no bcrypt. It exists to prove out and freeze the
 * request/response contract. Run with: npm run mock
 */
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { z } from 'zod';

import './types.js';
import { buildFixtures, type FixtureStore, type MockAdminUser } from './fixtures.js';
import { deterministicUuid } from './deterministicId.js';
import { ErrorCode } from '../src/shared/errorEnvelope.js';
import { loginRequestSchema } from '../src/modules/auth/schemas.js';
import {
  addMuseumAdminRequestSchema,
  createMuseumRequestSchema,
  listMuseumsQuerySchema,
  updateMuseumRequestSchema,
  type Museum,
} from '../src/modules/museums/schemas.js';
import {
  createRoomRequestSchema,
  deleteRoomQuerySchema,
  listRoomsQuerySchema,
  reorderItemsRequestSchema,
  updateRoomRequestSchema,
  type Room,
} from '../src/modules/rooms/schemas.js';
import {
  createItemRequestSchema,
  listItemsQuerySchema,
  updateItemRequestSchema,
} from '../src/modules/items/schemas.js';

const PORT = Number(process.env.MOCK_PORT ?? 4000);

const store: FixtureStore = await buildFixtures();

interface IssuedToken {
  adminUserId: string;
  role: 'SYSTEM_ADMIN' | 'MUSEUM_ADMIN';
  museumId: string | null;
  expiresAt: number;
}
const issuedTokens = new Map<string, IssuedToken>();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req: Request, _res: Response, next: NextFunction) => {
  req.requestId = randomUUID();
  next();
});

function sendError(
  res: Response,
  status: number,
  code: (typeof ErrorCode)[keyof typeof ErrorCode],
  message: string,
  details?: { path: string; message: string }[],
) {
  res.status(status).json({
    error: {
      message,
      code,
      requestId: res.req.requestId,
      ...(details ? { details } : {}),
    },
  });
}

function sendZodError(res: Response, issues: z.ZodIssue[]) {
  sendError(
    res,
    400,
    ErrorCode.VALIDATION_ERROR,
    'Request failed validation.',
    issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
}

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// --- Auth -------------------------------------------------------------

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Missing bearer token.');
    return;
  }
  const token = header.slice('Bearer '.length);
  const issued = issuedTokens.get(token);
  if (!issued || issued.expiresAt < Date.now()) {
    sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Invalid or expired token.');
    return;
  }
  // §8.2 M3: a token issued before suspension stops working immediately.
  if (issued.museumId) {
    const museum = store.museums.find((m) => m.id === issued.museumId);
    if (museum?.status === 'SUSPENDED') {
      sendError(res, 403, ErrorCode.FORBIDDEN, 'Museum is suspended.');
      return;
    }
  }
  req.admin = { id: issued.adminUserId, role: issued.role, museumId: issued.museumId };
  next();
}

function requireRole(role: 'SYSTEM_ADMIN') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.admin?.role !== role) {
      sendError(res, 403, ErrorCode.FORBIDDEN, `Requires ${role}.`);
      return;
    }
    next();
  };
}

/** §8.4 — the resolved museum id must come from the record, never the request. */
function assertMuseumScope(req: Request, res: Response, resolvedMuseumId: string): boolean {
  if (req.admin?.role === 'SYSTEM_ADMIN') return true;
  if (req.admin?.museumId === resolvedMuseumId) return true;
  sendError(res, 403, ErrorCode.CROSS_TENANT_ACCESS, 'This resource belongs to another museum.');
  return false;
}

app.post('/admin/login', (req: Request, res: Response) => {
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    sendZodError(res, parsed.error.issues);
    return;
  }
  const { email, password } = parsed.data;
  const admin = store.adminUsers.find((a) => a.email === email);
  // Deliberately generic: don't distinguish unknown email from wrong password (§8.1).
  if (!admin || admin.password !== password) {
    sendError(res, 401, ErrorCode.INVALID_CREDENTIALS, 'Invalid credentials.');
    return;
  }
  const token = randomUUID();
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  issuedTokens.set(token, {
    adminUserId: admin.id,
    role: admin.role,
    museumId: admin.museumId,
    expiresAt,
  });
  res.json({
    token,
    role: admin.role,
    museumId: admin.museumId,
    expiresAt: new Date(expiresAt).toISOString(),
  });
});

// --- Pagination helper --------------------------------------------------

function paginate<T extends { id: string }>(all: T[], limit: number, cursor?: string) {
  let startIndex = 0;
  if (cursor) {
    const idx = all.findIndex((item) => item.id === cursor);
    startIndex = idx === -1 ? 0 : idx + 1;
  }
  const page = all.slice(startIndex, startIndex + limit);
  const nextCursor = startIndex + limit < all.length ? (page.at(-1)?.id ?? null) : null;
  return { data: page, nextCursor };
}

// --- Museums (§14.1) ------------------------------------------------------

app.get(
  '/admin/museums',
  requireAuth,
  requireRole('SYSTEM_ADMIN'),
  (req: Request, res: Response) => {
    const parsed = listMuseumsQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendZodError(res, parsed.error.issues);
    res.json(paginate(store.museums, parsed.data.limit, parsed.data.cursor));
  },
);

app.get('/admin/museums/:id', requireAuth, (req: Request, res: Response) => {
  const museum = store.museums.find((m) => m.id === req.params.id);
  if (!museum) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Museum not found.');
  if (!assertMuseumScope(req, res, museum.id)) return;
  res.json(museum);
});

app.post(
  '/admin/museums',
  requireAuth,
  requireRole('SYSTEM_ADMIN'),
  (req: Request, res: Response) => {
    const parsed = createMuseumRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendZodError(res, parsed.error.issues);
    const { name, slug, adminEmail, adminPassword } = parsed.data;

    if (store.museums.some((m) => m.slug === slug)) {
      return sendError(res, 409, ErrorCode.CONFLICT, 'A museum with this slug already exists.');
    }
    if (store.adminUsers.some((a) => a.email === adminEmail)) {
      return sendError(res, 409, ErrorCode.CONFLICT, 'An admin with this email already exists.');
    }

    const now = new Date().toISOString();
    const museum: Museum = {
      id: deterministicUuid(`museum:${slug}:${randomUUID()}`),
      name,
      slug,
      status: 'ACTIVE',
      ticketValidationUrl: null,
      systemPrompt: null,
      defaultVoiceId: null,
      createdAt: now,
      updatedAt: now,
    };
    const admin: MockAdminUser = {
      id: randomUUID(),
      email: adminEmail,
      password: adminPassword,
      role: 'MUSEUM_ADMIN',
      museumId: museum.id,
    };
    store.museums.push(museum);
    store.adminUsers.push(admin);

    res.status(201).json({
      museum,
      admin: { id: admin.id, email: admin.email, role: admin.role, museumId: admin.museumId },
    });
  },
);

app.patch('/admin/museums/:id', requireAuth, (req: Request, res: Response) => {
  const museum = store.museums.find((m) => m.id === req.params.id);
  if (!museum) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Museum not found.');
  if (!assertMuseumScope(req, res, museum.id)) return;

  const parsed = updateMuseumRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  // status is SYSTEM_ADMIN-only (§14.1); the rest are writable by the museum's own admin.
  if (parsed.data.status !== undefined && req.admin?.role !== 'SYSTEM_ADMIN') {
    return sendError(res, 403, ErrorCode.FORBIDDEN, 'Only SYSTEM_ADMIN may change status.');
  }

  Object.assign(museum, parsed.data, { updatedAt: new Date().toISOString() });
  res.json(museum);
});

app.post(
  '/admin/museums/:id/admins',
  requireAuth,
  requireRole('SYSTEM_ADMIN'),
  (req: Request, res: Response) => {
    const museum = store.museums.find((m) => m.id === req.params.id);
    if (!museum) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Museum not found.');

    const parsed = addMuseumAdminRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendZodError(res, parsed.error.issues);

    if (store.adminUsers.some((a) => a.email === parsed.data.email)) {
      return sendError(res, 409, ErrorCode.CONFLICT, 'An admin with this email already exists.');
    }

    const admin: MockAdminUser = {
      id: randomUUID(),
      email: parsed.data.email,
      password: parsed.data.password,
      role: 'MUSEUM_ADMIN',
      museumId: museum.id,
    };
    store.adminUsers.push(admin);
    res
      .status(201)
      .json({ id: admin.id, email: admin.email, role: admin.role, museumId: admin.museumId });
  },
);

// --- Rooms (§14.2, §14.3) -------------------------------------------------

function wouldCreateCycle(rooms: Room[], roomId: string, nextRoomId: string): boolean {
  let current: string | null = nextRoomId;
  const visited = new Set<string>();
  while (current) {
    if (current === roomId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = rooms.find((r) => r.id === current)?.nextRoomId ?? null;
  }
  return false;
}

app.get('/admin/rooms', requireAuth, (req: Request, res: Response) => {
  const parsed = listRoomsQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  let museumId: string | undefined;
  if (req.admin?.role === 'SYSTEM_ADMIN') {
    if (!parsed.data.museumId) {
      return sendError(
        res,
        400,
        ErrorCode.VALIDATION_ERROR,
        'museumId is required for SYSTEM_ADMIN.',
      );
    }
    museumId = parsed.data.museumId;
  } else {
    // §14.2: ignore any supplied museumId for a MUSEUM_ADMIN — use the token's.
    museumId = req.admin?.museumId ?? undefined;
  }

  const scoped = store.rooms.filter((r) => r.museumId === museumId);
  res.json(paginate(scoped, parsed.data.limit, parsed.data.cursor));
});

app.get('/admin/rooms/:id', requireAuth, (req: Request, res: Response) => {
  const room = store.rooms.find((r) => r.id === req.params.id);
  if (!room) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Room not found.');
  if (!assertMuseumScope(req, res, room.museumId)) return;
  res.json(room);
});

app.post('/admin/rooms', requireAuth, (req: Request, res: Response) => {
  const parsed = createRoomRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  let museumId: string;
  if (req.admin?.role === 'SYSTEM_ADMIN') {
    if (!parsed.data.museumId) {
      return sendError(
        res,
        400,
        ErrorCode.VALIDATION_ERROR,
        'museumId is required for SYSTEM_ADMIN.',
      );
    }
    museumId = parsed.data.museumId;
  } else {
    museumId = req.admin?.museumId as string;
  }

  if (store.rooms.some((r) => r.museumId === museumId && r.storyOrder === parsed.data.storyOrder)) {
    return sendError(res, 409, ErrorCode.CONFLICT, 'storyOrder already used in this museum.');
  }

  const now = new Date().toISOString();
  const room: Room = {
    id: randomUUID(),
    legacyId: null,
    museumId,
    storyOrder: parsed.data.storyOrder,
    title: parsed.data.title,
    roomOverviewText: parsed.data.roomOverviewText,
    narrationScript: parsed.data.narrationScript,
    roomAudioUrl: null,
    nextRoomId: parsed.data.nextRoomId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  if (room.nextRoomId) {
    const target = store.rooms.find((r) => r.id === room.nextRoomId);
    if (!target || target.museumId !== museumId) {
      return sendError(
        res,
        422,
        ErrorCode.INVALID_ROOM_SEQUENCE,
        'nextRoomId must belong to the same museum.',
      );
    }
    if (wouldCreateCycle(store.rooms, room.id, room.nextRoomId)) {
      return sendError(
        res,
        422,
        ErrorCode.INVALID_ROOM_SEQUENCE,
        'nextRoomId would create a cycle.',
      );
    }
  }

  store.rooms.push(room);
  res.status(201).json(room);
});

app.patch('/admin/rooms/:id', requireAuth, (req: Request, res: Response) => {
  const room = store.rooms.find((r) => r.id === req.params.id);
  if (!room) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Room not found.');
  if (!assertMuseumScope(req, res, room.museumId)) return;

  const parsed = updateRoomRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  if (parsed.data.nextRoomId) {
    const target = store.rooms.find((r) => r.id === parsed.data.nextRoomId);
    if (!target || target.museumId !== room.museumId) {
      return sendError(
        res,
        422,
        ErrorCode.INVALID_ROOM_SEQUENCE,
        'nextRoomId must belong to the same museum.',
      );
    }
    if (wouldCreateCycle(store.rooms, room.id, parsed.data.nextRoomId)) {
      return sendError(
        res,
        422,
        ErrorCode.INVALID_ROOM_SEQUENCE,
        'nextRoomId would create a cycle.',
      );
    }
  }

  Object.assign(room, parsed.data, { updatedAt: new Date().toISOString() });
  res.json(room);
});

app.delete('/admin/rooms/:id', requireAuth, (req: Request, res: Response) => {
  const room = store.rooms.find((r) => r.id === req.params.id);
  if (!room) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Room not found.');
  if (!assertMuseumScope(req, res, room.museumId)) return;

  const parsedQuery = deleteRoomQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) return sendZodError(res, parsedQuery.error.issues);

  const referencing = store.rooms.filter((r) => r.nextRoomId === room.id);
  if (referencing.length > 0 && !parsedQuery.data.force) {
    return sendError(
      res,
      409,
      ErrorCode.ROOM_REFERENCED,
      'Other rooms point at this room. Pass ?force=true to null those pointers.',
    );
  }
  for (const r of referencing) r.nextRoomId = null;

  store.rooms = store.rooms.filter((r) => r.id !== room.id);
  store.items = store.items.filter((i) => i.roomId !== room.id);
  res.status(204).send();
});

app.patch('/admin/rooms/:id/items/order', requireAuth, (req: Request, res: Response) => {
  const room = store.rooms.find((r) => r.id === req.params.id);
  if (!room) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Room not found.');
  if (!assertMuseumScope(req, res, room.museumId)) return;

  const parsed = reorderItemsRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  const roomItemIds = new Set(store.items.filter((i) => i.roomId === room.id).map((i) => i.id));
  const allBelongToRoom = parsed.data.itemIds.every((id) => roomItemIds.has(id));
  if (!allBelongToRoom || parsed.data.itemIds.length !== roomItemIds.size) {
    return sendError(
      res,
      400,
      ErrorCode.VALIDATION_ERROR,
      'itemIds must be exactly the set of items already in this room.',
    );
  }

  parsed.data.itemIds.forEach((id, index) => {
    const item = store.items.find((i) => i.id === id);
    if (item) {
      item.displayOrder = index;
      item.updatedAt = new Date().toISOString();
    }
  });
  res.json({ ok: true });
});

// --- Items (§14.4) --------------------------------------------------------

app.get('/admin/items', requireAuth, (req: Request, res: Response) => {
  const parsed = listItemsQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  const room = store.rooms.find((r) => r.id === parsed.data.roomId);
  if (!room) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Room not found.');
  if (!assertMuseumScope(req, res, room.museumId)) return;

  const scoped = store.items
    .filter((i) => i.roomId === parsed.data.roomId)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  res.json(paginate(scoped, parsed.data.limit, parsed.data.cursor));
});

app.post('/admin/items', requireAuth, (req: Request, res: Response) => {
  const parsed = createItemRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  const room = store.rooms.find((r) => r.id === parsed.data.roomId);
  if (!room) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Room not found.');
  if (!assertMuseumScope(req, res, room.museumId)) return;

  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    legacyId: null,
    roomId: parsed.data.roomId,
    name: parsed.data.name,
    shortDescription: parsed.data.shortDescription,
    detailText: parsed.data.detailText,
    imageUrl: parsed.data.imageUrl ?? null,
    displayOrder:
      parsed.data.displayOrder ?? store.items.filter((i) => i.roomId === room.id).length,
    createdAt: now,
    updatedAt: now,
  };
  store.items.push(item);
  res.status(201).json(item);
});

app.patch('/admin/items/:id', requireAuth, (req: Request, res: Response) => {
  const item = store.items.find((i) => i.id === req.params.id);
  if (!item) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Item not found.');
  const room = store.rooms.find((r) => r.id === item.roomId);
  if (!room || !assertMuseumScope(req, res, room.museumId)) return;

  const parsed = updateItemRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  Object.assign(item, parsed.data, { updatedAt: new Date().toISOString() });
  res.json(item);
});

app.delete('/admin/items/:id', requireAuth, (req: Request, res: Response) => {
  const item = store.items.find((i) => i.id === req.params.id);
  if (!item) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Item not found.');
  const room = store.rooms.find((r) => r.id === item.roomId);
  if (!room || !assertMuseumScope(req, res, room.museumId)) return;

  store.items = store.items.filter((i) => i.id !== item.id);
  res.status(204).send();
});

// --- Fallbacks ------------------------------------------------------------

app.use((req: Request, res: Response) => {
  sendError(res, 404, ErrorCode.NOT_FOUND, `No mock route for ${req.method} ${req.path}.`);
});

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[${req.requestId}]`, err);
  sendError(res, 500, ErrorCode.INTERNAL_ERROR, 'Unexpected mock server error.');
});

app.listen(PORT, () => {
  console.log(`Mock admin API listening on http://localhost:${PORT}`);
  console.log(`Seeded admins:`);
  for (const admin of store.adminUsers) {
    console.log(`  ${admin.role.padEnd(13)} ${admin.email} / ${admin.password}`);
  }
});
