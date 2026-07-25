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

import {
  buildFixtures,
  type FixtureStore,
  type MockAdminUser,
  type MockPayment,
} from './fixtures.js';
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
import {
  createAdminRequestSchema,
  listAdminsQuerySchema,
  updateAdminRequestSchema,
} from '../src/modules/admins/schemas.js';
import { listAuditLogsQuerySchema } from '../src/modules/audit/schemas.js';
import { overviewQuerySchema } from '../src/modules/overview/schemas.js';
import {
  checkoutRequestSchema,
  manualTierRequestSchema,
} from '../src/modules/billing/schemas.js';
import { TIER_LIMITS } from '../src/modules/billing/tiers.js';

const PORT = Number(process.env.MOCK_PORT ?? 4000);

/** Where the stand-in provider page sends the browser back to. */
const MOCK_RETURN_URL = process.env.MOCK_RETURN_URL ?? 'http://localhost:5173/billing/return';

/** Same best-effort label the real audit service derives from a snapshot. */
function readSnapshotLabel(snapshot: unknown): string | null {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return null;
  const record = snapshot as Record<string, unknown>;
  for (const key of ['title', 'name', 'email', 'slug']) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

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

// --- Readiness -----------------------------------------------------------

/**
 * The same per-room readiness the real overview service computes, used by both
 * the overview route and the museum stats block so the fleet screen and the
 * tenant screen never disagree about how many rooms are ready.
 */
function roomReadinessFor(museumId: string) {
  const rooms = store.rooms
    .filter((r) => r.museumId === museumId)
    .sort((a, b) => a.storyOrder - b.storyOrder);

  const reachable = new Set<string>();
  let cursor: string | null = rooms[0]?.id ?? null;
  while (cursor !== null && !reachable.has(cursor)) {
    reachable.add(cursor);
    cursor = rooms.find((r) => r.id === cursor)?.nextRoomId ?? null;
  }

  const readiness = rooms.map((room) => {
    const itemCount = store.items.filter((i) => i.roomId === room.id).length;
    const narrationChars = room.narrationScript.trim().length;
    return {
      id: room.id,
      storyOrder: room.storyOrder,
      title: room.title,
      readiness:
        narrationChars < 40 ? ('empty' as const) : itemCount === 0 ? ('incomplete' as const) : ('ready' as const),
      itemCount,
      narrationChars,
      hasAudio: room.roomAudioUrl !== null,
      inSequence: reachable.has(room.id),
      updatedAt: room.updatedAt,
    };
  });

  return { rooms, readiness, reachable };
}

function statsFor(museumId: string) {
  const { rooms, readiness, reachable } = roomReadinessFor(museumId);
  return {
    roomCount: rooms.length,
    itemCount: store.items.filter((i) => rooms.some((r) => r.id === i.roomId)).length,
    adminCount: store.adminUsers.filter((a) => a.museumId === museumId).length,
    roomsMissingNarration: readiness.filter((r) => r.readiness === 'empty').length,
    roomsWithoutItems: readiness.filter((r) => r.itemCount === 0).length,
    roomsReady: readiness.filter((r) => r.readiness === 'ready').length,
    roomsInSequence: reachable.size,
    lastEditedAt: rooms.reduce<string | null>(
      (latest, room) => (latest === null || room.updatedAt > latest ? room.updatedAt : latest),
      null,
    ),
  };
}

// --- Museums (§14.1) ------------------------------------------------------

app.get(
  '/admin/museums',
  requireAuth,
  requireRole('SYSTEM_ADMIN'),
  (req: Request, res: Response) => {
    const parsed = listMuseumsQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendZodError(res, parsed.error.issues);
    const { status, search, withStats, limit, cursor } = parsed.data;

    const needle = search?.trim().toLowerCase();
    const matching = store.museums.filter((museum) => {
      if (status && museum.status !== status) return false;
      if (!needle) return true;
      return `${museum.name} ${museum.slug}`.toLowerCase().includes(needle);
    });

    const page = paginate(matching, limit, cursor);
    res.json(
      withStats
        ? {
            ...page,
            data: page.data.map((museum) => ({ ...museum, stats: statsFor(museum.id) })),
          }
        : page,
    );
  },
);

app.get('/admin/museums/:id', requireAuth, (req: Request, res: Response) => {
  const museum = store.museums.find((m) => m.id === req.params.id);
  if (!museum) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Museum not found.');
  if (!assertMuseumScope(req, res, museum.id)) return;
  res.json(req.query.withStats === 'true' ? { ...museum, stats: statsFor(museum.id) } : museum);
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
      cityCountry: parsed.data.cityCountry ?? null,

      ticketValidationUrl: null,
      gateMode: 'TICKET_CODE',
      allowedTicketPrefix: null,
      graceWindowMinutes: 30,

      systemPrompt: null,
      personaName: null,
      guideStyleTone: 'CONVERSATIONAL',

      defaultVoiceId: null,
      speakingRate: 1,
      pronunciationHints: null,

      tier: 'BASIC',
      subscriptionStatus: 'ACTIVE',
      subscriptionRenewsAt: null,

      createdAt: now,
      updatedAt: now,
    };
    const admin: MockAdminUser = {
      id: randomUUID(),
      email: adminEmail,
      displayName: null,
      password: adminPassword,
      role: 'MUSEUM_ADMIN',
      status: 'INVITED',
      museumId: museum.id,
      lastLoginAt: null,
      createdAt: now,
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

// Scoped rather than operator-only: a museum staffs itself. The role is fixed
// and the museum comes from the path, so no operator can be minted here.
app.post(
  '/admin/museums/:id/admins',
  requireAuth,
  (req: Request, res: Response) => {
    const museum = store.museums.find((m) => m.id === req.params.id);
    if (!museum) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Museum not found.');
    if (!assertMuseumScope(req, res, museum.id)) return;

    const parsed = addMuseumAdminRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendZodError(res, parsed.error.issues);

    if (store.adminUsers.some((a) => a.email === parsed.data.email)) {
      return sendError(res, 409, ErrorCode.CONFLICT, 'An admin with this email already exists.');
    }

    const admin: MockAdminUser = {
      id: randomUUID(),
      email: parsed.data.email,
      displayName: parsed.data.displayName ?? null,
      password: parsed.data.password,
      role: 'MUSEUM_ADMIN',
      status: 'INVITED',
      museumId: museum.id,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
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
  const items = store.items
    .filter((i) => i.roomId === room.id)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  res.json({ ...room, items });
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

// --- Admin users ----------------------------------------------------------

function toAdminDto(admin: MockAdminUser) {
  return {
    id: admin.id,
    email: admin.email,
    displayName: admin.displayName,
    role: admin.role,
    status: admin.status,
    museumId: admin.museumId,
    museumName: store.museums.find((m) => m.id === admin.museumId)?.name ?? null,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
  };
}

app.get('/admin/admins', requireAuth, (req: Request, res: Response) => {
  const parsed = listAdminsQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  const isOperator = req.admin?.role === 'SYSTEM_ADMIN';
  const scopedMuseumId = isOperator ? parsed.data.museumId : req.admin?.museumId;

  const matching = store.adminUsers.filter((admin) => {
    if (scopedMuseumId && admin.museumId !== scopedMuseumId) return false;
    // A museum admin never sees operator accounts.
    if (!isOperator && admin.role !== 'MUSEUM_ADMIN') return false;
    if (!isOperator && admin.museumId !== req.admin?.museumId) return false;
    if (parsed.data.role && admin.role !== parsed.data.role) return false;
    if (parsed.data.status && admin.status !== parsed.data.status) return false;
    if (parsed.data.search) {
      const needle = parsed.data.search.toLowerCase();
      const haystack = `${admin.email} ${admin.displayName ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const page = paginate(matching, parsed.data.limit, parsed.data.cursor);
  res.json({ data: page.data.map(toAdminDto), nextCursor: page.nextCursor });
});

app.post('/admin/admins', requireAuth, requireRole('SYSTEM_ADMIN'), (req: Request, res: Response) => {
  const parsed = createAdminRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);
  if (store.adminUsers.some((a) => a.email === parsed.data.email)) {
    return sendError(res, 409, ErrorCode.CONFLICT, 'An admin with this email already exists.');
  }

  const admin: MockAdminUser = {
    id: randomUUID(),
    email: parsed.data.email,
    displayName: parsed.data.displayName ?? null,
    password: parsed.data.password,
    role: parsed.data.role,
    status: 'INVITED',
    museumId: parsed.data.role === 'SYSTEM_ADMIN' ? null : (parsed.data.museumId ?? null),
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
  };
  store.adminUsers.push(admin);
  res.status(201).json(toAdminDto(admin));
});

app.patch('/admin/admins/:id', requireAuth, (req: Request, res: Response) => {
  const admin = store.adminUsers.find((a) => a.id === req.params.id);
  if (!admin) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Admin user not found.');
  if (req.admin?.role !== 'SYSTEM_ADMIN' && admin.museumId !== req.admin?.museumId) {
    return sendError(res, 403, ErrorCode.CROSS_TENANT_ACCESS, 'This account belongs to another museum.');
  }

  const parsed = updateAdminRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);
  if (admin.id === req.admin?.id && parsed.data.status && parsed.data.status !== 'ACTIVE') {
    return sendError(res, 409, ErrorCode.CONFLICT, 'You cannot suspend your own account.');
  }

  if (parsed.data.displayName !== undefined) admin.displayName = parsed.data.displayName;
  if (parsed.data.status !== undefined) admin.status = parsed.data.status;
  if (parsed.data.password !== undefined) admin.password = parsed.data.password;
  res.json(toAdminDto(admin));
});

app.delete('/admin/admins/:id', requireAuth, (req: Request, res: Response) => {
  const admin = store.adminUsers.find((a) => a.id === req.params.id);
  if (!admin) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Admin user not found.');
  if (req.admin?.role !== 'SYSTEM_ADMIN' && admin.museumId !== req.admin?.museumId) {
    return sendError(res, 403, ErrorCode.CROSS_TENANT_ACCESS, 'This account belongs to another museum.');
  }
  if (admin.id === req.admin?.id) {
    return sendError(res, 409, ErrorCode.CONFLICT, 'You cannot delete your own account.');
  }

  store.adminUsers = store.adminUsers.filter((a) => a.id !== admin.id);
  res.status(204).send();
});

// --- Audit logs -----------------------------------------------------------

app.get('/admin/audit-logs', requireAuth, (req: Request, res: Response) => {
  const parsed = listAuditLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  const isOperator = req.admin?.role === 'SYSTEM_ADMIN';
  const scopedMuseumId = isOperator ? parsed.data.museumId : req.admin?.museumId;

  const matching = store.auditLogs
    .filter((log) => {
      if (!isOperator && log.museumId !== req.admin?.museumId) return false;
      if (scopedMuseumId && log.museumId !== scopedMuseumId) return false;
      if (parsed.data.entityType && log.entityType !== parsed.data.entityType) return false;
      if (parsed.data.action && log.action !== parsed.data.action) return false;
      if (parsed.data.actorId && log.adminUserId !== parsed.data.actorId) return false;
      if (parsed.data.since && log.createdAt < parsed.data.since) return false;
      if (parsed.data.until && log.createdAt >= parsed.data.until) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const page = paginate(matching, parsed.data.limit, parsed.data.cursor);
  res.json({
    data: page.data.map((log) => {
      const actor = store.adminUsers.find((a) => a.id === log.adminUserId);
      const label = readSnapshotLabel(log.after) ?? readSnapshotLabel(log.before) ?? log.entityId;
      return {
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        entityLabel: label,
        museumId: log.museumId,
        museumName: store.museums.find((m) => m.id === log.museumId)?.name ?? null,
        actorId: log.adminUserId,
        actorEmail: actor?.email ?? null,
        actorDisplayName: actor?.displayName ?? null,
        actorRole: actor?.role ?? null,
        before: log.before ?? null,
        after: log.after ?? null,
        createdAt: log.createdAt,
      };
    }),
    nextCursor: page.nextCursor,
  });
});

// --- Overview and system health -------------------------------------------

app.get('/admin/overview', requireAuth, (req: Request, res: Response) => {
  const parsed = overviewQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  const museumId =
    req.admin?.role === 'SYSTEM_ADMIN' ? parsed.data.museumId : req.admin?.museumId;
  if (!museumId) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'museumId is required for SYSTEM_ADMIN.');
  }
  const museum = store.museums.find((m) => m.id === museumId);
  if (!museum) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Museum not found.');

  res.json({
    museumId,
    museumName: museum.name,
    stats: statsFor(museumId),
    rooms: roomReadinessFor(museumId).readiness,
    tier: museum.tier,
    subscriptionStatus: museum.subscriptionStatus,
    limits: TIER_LIMITS[museum.tier],
  });
});

app.get(
  '/admin/system/health',
  requireAuth,
  requireRole('SYSTEM_ADMIN'),
  (_req: Request, res: Response) => {
    // Every adapter is a fake here by definition — this process talks to
    // nothing. Reporting them as healthy would make the mock look like
    // production, which is exactly the confusion this screen exists to prevent.
    const adapters = [
      ['payments', 'Payments adapter', 'In-process fake'],
      ['ticketing', 'Ticket validation adapter', 'In-process fake'],
      ['llm', 'Language model adapter', 'In-process fake'],
      ['tts', 'Speech synthesis adapter', 'In-process fake'],
      ['storage', 'Media storage adapter', 'In-memory'],
    ].map(([id, label, provider]) => ({
      id,
      label,
      provider,
      mode: 'fake' as const,
      state: 'degraded' as const,
      consecutiveFailures: 0,
      breakerOpenedAt: null,
      timeoutMs: null,
      note: 'Mock server: no real vendor is being called.',
    }));

    res.json({
      status: 'degraded',
      version: '0.1.0-mock',
      environment: 'mock',
      dbLatencyMs: 0,
      uptimeSeconds: Math.round(process.uptime()),
      adapters,
      checkedAt: new Date().toISOString(),
    });
  },
);

// --- Billing --------------------------------------------------------------

const MOCK_PLANS = [
  { tier: 'BASIC' as const, displayName: 'Basic', description: 'A single room, one administrator.', amountEtb: '1500.00' },
  { tier: 'PRO' as const, displayName: 'Pro', description: 'Up to three rooms and five administrators.', amountEtb: '4500.00' },
  { tier: 'ENTERPRISE' as const, displayName: 'Enterprise', description: 'Unlimited rooms, items, and administrators.', amountEtb: '12000.00' },
];

app.get('/admin/billing/plans', requireAuth, (_req: Request, res: Response) => {
  res.json({
    plans: MOCK_PLANS.map((plan) => ({
      ...plan,
      currency: 'ETB',
      periodDays: 30,
      limits: TIER_LIMITS[plan.tier],
    })),
  });
});

function paymentDto(payment: MockPayment) {
  return {
    id: payment.id,
    txRef: payment.txRef,
    tier: payment.tier,
    amountEtb: payment.amountEtb,
    status: payment.status,
    paidAt: payment.paidAt,
    chapaReference: payment.chapaReference,
    createdAt: payment.createdAt,
  };
}

function daysUntil(iso: string | null): number | null {
  if (iso === null) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

app.get('/admin/billing/status', requireAuth, (req: Request, res: Response) => {
  const museumId =
    req.admin?.role === 'SYSTEM_ADMIN'
      ? ((req.query.museumId as string | undefined) ?? req.admin?.museumId)
      : req.admin?.museumId;
  if (!museumId) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'museumId is required.');
  }
  const museum = store.museums.find((m) => m.id === museumId);
  if (!museum) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Museum not found.');

  const limit = Number(req.query.limit ?? 10);
  const payments = store.payments
    .filter((payment) => payment.museumId === museumId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({
    museumId,
    tier: museum.tier,
    subscriptionStatus: museum.subscriptionStatus,
    subscriptionRenewsAt: museum.subscriptionRenewsAt,
    daysUntilRenewal: daysUntil(museum.subscriptionRenewsAt),
    limits: TIER_LIMITS[museum.tier],
    usage: {
      rooms: store.rooms.filter((r) => r.museumId === museumId).length,
      adminUsers: store.adminUsers.filter((a) => a.museumId === museumId).length,
    },
    payments: payments.slice(0, limit).map(paymentDto),
    nextCursor: payments.length > limit ? (payments[limit - 1]?.id ?? null) : null,
  });
});

/**
 * Checkout, minus the money. The URL returned points back at this server's own
 * stand-in for the provider's hosted page, so the whole round trip — hand off,
 * pay or abandon, return, poll — can be walked through locally.
 */
app.post('/admin/billing/checkout', requireAuth, (req: Request, res: Response) => {
  const parsed = checkoutRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error.issues);

  const museumId =
    req.admin?.role === 'SYSTEM_ADMIN'
      ? (parsed.data.museumId ?? req.admin?.museumId)
      : req.admin?.museumId;
  if (!museumId) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'museumId is required.');
  }
  const museum = store.museums.find((m) => m.id === museumId);
  if (!museum) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Museum not found.');

  const alreadyOpen = store.payments.some(
    (payment) => payment.museumId === museumId && payment.status === 'PENDING',
  );
  if (alreadyOpen) {
    return sendError(
      res,
      409,
      ErrorCode.PAYMENT_ALREADY_PENDING,
      'A checkout for this museum is already open.',
    );
  }

  const plan = MOCK_PLANS.find((entry) => entry.tier === parsed.data.tier);
  if (!plan) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Tier pricing not found.');

  const txRef = `mock-${museum.slug}-${plan.tier}-${randomUUID()}`;
  store.payments.push({
    id: randomUUID(),
    museumId,
    txRef,
    tier: plan.tier,
    amountEtb: plan.amountEtb,
    status: 'PENDING',
    paidAt: null,
    chapaReference: null,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({
    txRef,
    checkoutUrl: `http://localhost:${PORT}/mock/checkout/${encodeURIComponent(txRef)}`,
    tier: plan.tier,
    amountEtb: plan.amountEtb,
    currency: 'ETB',
    expiresHint: 'Complete payment within 24 hours.',
  });
});

app.get('/admin/billing/payments/:txRef', requireAuth, (req: Request, res: Response) => {
  const payment = store.payments.find((entry) => entry.txRef === req.params.txRef);
  if (!payment) return sendError(res, 404, ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found.');
  if (!assertMuseumScope(req, res, payment.museumId)) return;

  const museum = store.museums.find((m) => m.id === payment.museumId);
  res.json({
    txRef: payment.txRef,
    status: payment.status,
    tier: payment.tier,
    amountEtb: payment.amountEtb,
    paidAt: payment.paidAt,
    chapaReference: payment.chapaReference,
    museumTier: museum?.tier ?? null,
    subscriptionRenewsAt: museum?.subscriptionRenewsAt ?? null,
  });
});

app.post(
  '/admin/billing/tier',
  requireAuth,
  requireRole('SYSTEM_ADMIN'),
  (req: Request, res: Response) => {
    const parsed = manualTierRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendZodError(res, parsed.error.issues);

    const museum = store.museums.find((m) => m.id === parsed.data.museumId);
    if (!museum) return sendError(res, 404, ErrorCode.NOT_FOUND, 'Museum not found.');

    const before = {
      tier: museum.tier,
      subscriptionStatus: museum.subscriptionStatus,
      subscriptionRenewsAt: museum.subscriptionRenewsAt,
    };

    museum.tier = parsed.data.tier;
    if (parsed.data.subscriptionStatus) museum.subscriptionStatus = parsed.data.subscriptionStatus;
    if (parsed.data.subscriptionRenewsAt) {
      museum.subscriptionRenewsAt = parsed.data.subscriptionRenewsAt;
    }
    museum.updatedAt = new Date().toISOString();

    store.auditLogs.push({
      id: randomUUID(),
      action: 'UPDATE',
      entityType: 'Museum',
      entityId: museum.id,
      museumId: museum.id,
      adminUserId: req.admin?.id ?? null,
      before,
      after: { name: museum.name, tier: museum.tier, reason: parsed.data.reason },
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true });
  },
);

/**
 * Stands in for the provider's hosted page. Two buttons, no money: paying
 * applies the tier the way the real verify path would, abandoning marks the
 * attempt failed. Both return to the console with the reference attached.
 */
app.get('/mock/checkout/:txRef', (req: Request, res: Response) => {
  const payment = store.payments.find((entry) => entry.txRef === req.params.txRef);
  if (!payment) return sendError(res, 404, ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found.');

  const back = `${MOCK_RETURN_URL}?trx_ref=${encodeURIComponent(payment.txRef)}`;
  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Mock payment</title>
<style>body{font:16px/1.5 system-ui;margin:0;display:grid;place-items:center;height:100vh;background:#f6f5f2}
main{background:#fff;padding:32px;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.12);max-width:420px}
form{display:flex;gap:12px;margin-top:24px}button{padding:12px 16px;border-radius:8px;border:1px solid #ccc;font:inherit;cursor:pointer}
button[value=pay]{background:#1c3f2f;color:#fff;border-color:#1c3f2f}</style></head>
<body><main>
<h1>Mock payment provider</h1>
<p>${payment.tier} plan, ${payment.amountEtb} ETB.</p>
<p><small>No money moves here. This page exists so the checkout round trip can be walked through without Chapa.</small></p>
<form method="post" action="/mock/checkout/${encodeURIComponent(payment.txRef)}">
<button name="outcome" value="pay">Pay</button>
<button name="outcome" value="abandon">Abandon</button>
</form>
<p><small>You will be returned to <code>${back}</code>.</small></p>
</main></body></html>`);
});

app.post(
  '/mock/checkout/:txRef',
  express.urlencoded({ extended: false }),
  (req: Request, res: Response) => {
    const payment = store.payments.find((entry) => entry.txRef === req.params.txRef);
    if (!payment) return sendError(res, 404, ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found.');

    if (req.body?.outcome === 'pay') {
      payment.status = 'PAID';
      payment.paidAt = new Date().toISOString();
      payment.chapaReference = `MOCK-${payment.id.slice(0, 8).toUpperCase()}`;

      const museum = store.museums.find((m) => m.id === payment.museumId);
      if (museum) {
        museum.tier = payment.tier;
        museum.subscriptionStatus = 'ACTIVE';
        museum.subscriptionRenewsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
        museum.updatedAt = new Date().toISOString();
      }
    } else {
      payment.status = 'FAILED';
    }

    res.redirect(`${MOCK_RETURN_URL}?trx_ref=${encodeURIComponent(payment.txRef)}`);
  },
);

app.get(
  '/admin/billing/spend',
  requireAuth,
  requireRole('SYSTEM_ADMIN'),
  (req: Request, res: Response) => {
    const window = (req.query.window as string | undefined) ?? '30d';
    res.json({
      window,
      since: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      currency: 'ETB',
      // No payments are ever taken here, so every total is honestly zero.
      totalEtb: '0.00',
      rows: store.museums.map((museum) => ({
        museumId: museum.id,
        museumName: museum.name,
        slug: museum.slug,
        cityCountry: museum.cityCountry,
        status: museum.status,
        tier: museum.tier,
        subscriptionStatus: museum.subscriptionStatus,
        paidAmountEtb: '0.00',
        paymentCount: 0,
        lastPaidAt: null,
      })),
    });
  },
);

// --- Health (unauthenticated deploy gate) ---------------------------------

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', dbLatencyMs: 0, version: '0.1.0-mock' });
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
