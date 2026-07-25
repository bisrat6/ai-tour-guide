/**
 * Tier limit enforcement. Ported from dev3's tier-limits.test.ts.
 *
 * dev3 exercised this through a POST /dev/rooms stub that existed only because
 * the real rooms routes had not been written yet. That stub is gone, and the
 * middleware is deliberately not mounted on the real routes (see
 * docs/d3-integration-audit.md), so these cases drive it through a minimal
 * app assembled here from the same middleware the real routes use.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asyncHandler } from '../../src/lib/asyncHandler.js';
import { ApiError } from '../../src/lib/errors.js';
import { signAuthToken } from '../../src/lib/jwt.js';
import { prisma } from '../../src/lib/prisma.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { requestId } from '../../src/middleware/requestId.js';
import { requireAuth } from '../../src/middleware/requireAuth.js';
import { requireWithinTierLimit } from '../../src/middleware/requireWithinTierLimit.js';
import { ensureTestSchema, resetDatabase, seedAdmin, seedMuseum, seedRoom } from '../helpers/db.js';

const PASSWORD = 'correct-horse-battery-staple';

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Mirrors how a real create route would wire the guard. */
function buildTierLimitApp(): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());

  app.post(
    '/test/rooms',
    requireAuth,
    requireWithinTierLimit('room', async (req) => {
      if (!req.admin) throw ApiError.unauthenticated();
      if (req.admin.role === 'SYSTEM_ADMIN') {
        const { museumId } = req.body as { museumId?: string };
        if (!museumId) throw ApiError.validation([{ path: 'museumId', message: 'Required.' }]);
        return museumId;
      }
      if (!req.admin.museumId) throw ApiError.forbidden('No museum on this account.');
      return req.admin.museumId;
    }),
    asyncHandler(async (req, res) => {
      const body = req.body as { title: string; storyOrder: number; museumId?: string };
      const museumId = req.admin?.role === 'SYSTEM_ADMIN' ? body.museumId! : req.admin!.museumId!;
      const room = await prisma.room.create({
        data: {
          museumId,
          title: body.title,
          storyOrder: body.storyOrder,
          roomOverviewText: `${body.title} overview`,
          narrationScript: `${body.title} narration`,
        },
      });
      res.status(201).json(room);
    }),
  );

  app.use(errorHandler);
  return app;
}

let counter = 0;

async function seedMuseumAtRoomCount(opts: {
  slug: string;
  tier: 'BASIC' | 'PRO' | 'ENTERPRISE';
  roomCount: number;
  subscriptionStatus?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
}) {
  const museum = await seedMuseum({
    name: opts.slug,
    slug: opts.slug,
    tier: opts.tier,
    ...(opts.subscriptionStatus ? { subscriptionStatus: opts.subscriptionStatus } : {}),
  });

  for (let i = 1; i <= opts.roomCount; i += 1) {
    await seedRoom({
      museumId: museum.id,
      legacyId: `room_${i}`,
      storyOrder: i,
      title: `Room ${i}`,
    });
  }

  counter += 1;
  const admin = await seedAdmin({
    email: `admin${counter}@${opts.slug}.test`,
    password: PASSWORD,
    role: 'MUSEUM_ADMIN',
    museumId: museum.id,
  });
  const { token } = signAuthToken({ sub: admin.id, role: 'MUSEUM_ADMIN', museumId: museum.id });
  return { museum, admin, token };
}

async function seedSystemAdmin() {
  const admin = await seedAdmin({
    email: 'system@example.com',
    password: PASSWORD,
    role: 'SYSTEM_ADMIN',
  });
  const { token } = signAuthToken({ sub: admin.id, role: 'SYSTEM_ADMIN', museumId: null });
  return { admin, token };
}

describe('requireWithinTierLimit', () => {
  const app = buildTierLimitApp();

  beforeAll(() => {
    ensureTestSchema();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects a second room on BASIC', async () => {
    const { token } = await seedMuseumAtRoomCount({ slug: 'basic', tier: 'BASIC', roomCount: 1 });

    const res = await request(app)
      .post('/test/rooms')
      .set(authHeader(token))
      .send({ title: 'Second room', storyOrder: 2 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TIER_LIMIT_EXCEEDED');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { path: 'limit', message: 'maxRooms' },
        { path: 'tier', message: 'BASIC' },
        { path: 'allowed', message: '1' },
        { path: 'current', message: '1' },
      ]),
    );
  });

  it('rejects a fourth room on PRO', async () => {
    const { token } = await seedMuseumAtRoomCount({ slug: 'pro', tier: 'PRO', roomCount: 3 });

    const res = await request(app)
      .post('/test/rooms')
      .set(authHeader(token))
      .send({ title: 'Fourth', storyOrder: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TIER_LIMIT_EXCEEDED');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { path: 'tier', message: 'PRO' },
        { path: 'allowed', message: '3' },
      ]),
    );
  });

  it('allows an unlimited tier past any threshold', async () => {
    const { token } = await seedMuseumAtRoomCount({
      slug: 'ent',
      tier: 'ENTERPRISE',
      roomCount: 9,
    });

    const res = await request(app)
      .post('/test/rooms')
      .set(authHeader(token))
      .send({ title: 'Tenth', storyOrder: 10 });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Tenth');
  });

  it('allows a create below the limit', async () => {
    const { token } = await seedMuseumAtRoomCount({ slug: 'room', tier: 'PRO', roomCount: 1 });

    const res = await request(app)
      .post('/test/rooms')
      .set(authHeader(token))
      .send({ title: 'Second', storyOrder: 2 });

    expect(res.status).toBe(201);
  });

  it('blocks all creates while the subscription is not active', async () => {
    const { token } = await seedMuseumAtRoomCount({
      slug: 'pastdue',
      tier: 'PRO',
      roomCount: 1,
      subscriptionStatus: 'PAST_DUE',
    });

    const res = await request(app)
      .post('/test/rooms')
      .set(authHeader(token))
      .send({ title: 'Blocked', storyOrder: 2 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_INACTIVE');
  });

  // A limit binds the museum, not the caller.
  it('limits a system admin acting on a museum at its cap', async () => {
    const { museum } = await seedMuseumAtRoomCount({ slug: 'syslim', tier: 'PRO', roomCount: 3 });
    const { token } = await seedSystemAdmin();

    const res = await request(app)
      .post('/test/rooms')
      .set(authHeader(token))
      .send({ title: 'Sys fourth', storyOrder: 4, museumId: museum.id });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TIER_LIMIT_EXCEEDED');
  });

  it('keeps existing rooms after a downgrade but refuses new ones', async () => {
    const { museum, token } = await seedMuseumAtRoomCount({
      slug: 'down',
      tier: 'PRO',
      roomCount: 3,
    });

    await prisma.museum.update({ where: { id: museum.id }, data: { tier: 'BASIC' } });

    expect(await prisma.room.count({ where: { museumId: museum.id } })).toBe(3);

    const res = await request(app)
      .post('/test/rooms')
      .set(authHeader(token))
      .send({ title: 'Fourth after downgrade', storyOrder: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([{ path: 'tier', message: 'BASIC' }]),
    );
  });
});
