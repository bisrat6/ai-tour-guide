import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signAuthToken } from '../../src/lib/jwt.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { requestId } from '../../src/middleware/requestId.js';
import { requireAuth } from '../../src/middleware/requireAuth.js';
import { requireMuseumScope } from '../../src/middleware/requireMuseumScope.js';
import { requireRole } from '../../src/middleware/requireRole.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetLoginAttemptsForTests } from '../../src/modules/auth/loginAttempts.js';
import { ensureTestSchema, resetDatabase, seedAdmin, seedMuseum, seedRoom } from '../helpers/db.js';

const PASSWORD = 'correct-horse-battery-staple';

describe('D1-3 authentication', () => {
  const app = createApp();

  beforeAll(() => {
    ensureTestSchema();
  });

  beforeEach(async () => {
    await resetDatabase();
    resetLoginAttemptsForTests();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /admin/login', () => {
    it('returns a JWT for valid SYSTEM_ADMIN credentials', async () => {
      const admin = await seedAdmin({
        email: 'system@example.com',
        password: PASSWORD,
        role: 'SYSTEM_ADMIN',
      });

      const res = await request(app)
        .post('/admin/login')
        .send({ email: 'system@example.com', password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        role: 'SYSTEM_ADMIN',
        museumId: null,
      });
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(20);
      expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const updated = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
      expect(updated.lastLoginAt).not.toBeNull();
    });

    it('returns a JWT with museumId for a MUSEUM_ADMIN', async () => {
      const museum = await seedMuseum({ name: 'Adwa', slug: 'adwa' });
      await seedAdmin({
        email: 'admin@adwa.test',
        password: PASSWORD,
        role: 'MUSEUM_ADMIN',
        museumId: museum.id,
      });

      const res = await request(app)
        .post('/admin/login')
        .send({ email: 'admin@adwa.test', password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('MUSEUM_ADMIN');
      expect(res.body.museumId).toBe(museum.id);
    });

    it('returns the same INVALID_CREDENTIALS body for wrong password and unknown email', async () => {
      await seedAdmin({
        email: 'known@example.com',
        password: PASSWORD,
        role: 'SYSTEM_ADMIN',
      });

      const wrongPassword = await request(app)
        .post('/admin/login')
        .send({ email: 'known@example.com', password: 'definitely-wrong' });
      const unknownEmail = await request(app)
        .post('/admin/login')
        .send({ email: 'nobody@example.com', password: 'definitely-wrong' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(unknownEmail.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    });

    it('keeps wrong-password and unknown-email response times within a similar band', async () => {
      await seedAdmin({
        email: 'timing@example.com',
        password: PASSWORD,
        role: 'SYSTEM_ADMIN',
      });

      // Warm bcrypt once so cold-start cost doesn't dominate the first sample.
      await request(app)
        .post('/admin/login')
        .send({ email: 'timing@example.com', password: 'warm-up-wrong' });
      resetLoginAttemptsForTests();

      async function medianMs(email: string): Promise<number> {
        const samples: number[] = [];
        for (let i = 0; i < 3; i++) {
          const start = performance.now();
          await request(app).post('/admin/login').send({ email, password: 'wrong-password' });
          samples.push(performance.now() - start);
          resetLoginAttemptsForTests();
        }
        samples.sort((a, b) => a - b);
        return samples[1]!;
      }

      const wrongPasswordMs = await medianMs('timing@example.com');
      const unknownEmailMs = await medianMs('ghost@example.com');
      const ratio =
        Math.max(wrongPasswordMs, unknownEmailMs) / Math.min(wrongPasswordMs, unknownEmailMs);

      // Dummy bcrypt on unknown email should keep timings in the same order
      // of magnitude. A 3x band absorbs Windows CI noise without accepting
      // a path that skips bcrypt entirely.
      expect(ratio).toBeLessThan(3);
    });

    it('locks an email out after 5 consecutive failures', async () => {
      await seedAdmin({
        email: 'lockout@example.com',
        password: PASSWORD,
        role: 'SYSTEM_ADMIN',
      });

      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/admin/login')
          .send({ email: 'lockout@example.com', password: 'wrong' });
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      }

      const locked = await request(app)
        .post('/admin/login')
        .send({ email: 'lockout@example.com', password: PASSWORD });

      expect(locked.status).toBe(429);
      expect(locked.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('requireAuth', () => {
    function probeApp() {
      const probe = express();
      probe.use(requestId);
      probe.use(express.json());
      probe.get('/probe', requireAuth, (req, res) => {
        res.json({ admin: req.admin });
      });
      probe.use(errorHandler);
      return probe;
    }

    it('accepts a valid token', async () => {
      const admin = await seedAdmin({
        email: 'valid@example.com',
        password: PASSWORD,
        role: 'SYSTEM_ADMIN',
      });
      const { token } = signAuthToken({ sub: admin.id, role: admin.role, museumId: null });

      const res = await request(probeApp()).get('/probe').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.admin).toEqual({
        id: admin.id,
        role: 'SYSTEM_ADMIN',
        museumId: null,
      });
    });

    it('returns 401 UNAUTHENTICATED for missing, malformed, and expired tokens', async () => {
      const probe = probeApp();

      const missing = await request(probe).get('/probe');
      expect(missing.status).toBe(401);
      expect(missing.body.error.code).toBe('UNAUTHENTICATED');

      const malformed = await request(probe).get('/probe').set('Authorization', 'Bearer not.a.jwt');
      expect(malformed.status).toBe(401);
      expect(malformed.body.error.code).toBe('UNAUTHENTICATED');

      const admin = await seedAdmin({
        email: 'expired@example.com',
        password: PASSWORD,
        role: 'SYSTEM_ADMIN',
      });
      // Sign with a 1ms TTL via the underlying library so we can wait it out.
      const jwt = await import('jsonwebtoken');
      const { env } = await import('../../src/config/env.js');
      const expiredToken = jwt.default.sign(
        { sub: admin.id, role: admin.role, museumId: null },
        env.JWT_SECRET,
        { expiresIn: '1ms' },
      );
      await new Promise((r) => setTimeout(r, 20));

      const expired = await request(probe)
        .get('/probe')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(expired.status).toBe(401);
      expect(expired.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects a MUSEUM_ADMIN token after the museum is suspended', async () => {
      const museum = await seedMuseum({ name: 'Louvre', slug: 'louvre' });
      const admin = await seedAdmin({
        email: 'admin@louvre.test',
        password: PASSWORD,
        role: 'MUSEUM_ADMIN',
        museumId: museum.id,
      });
      const { token } = signAuthToken({
        sub: admin.id,
        role: admin.role,
        museumId: museum.id,
      });

      const before = await request(probeApp())
        .get('/probe')
        .set('Authorization', `Bearer ${token}`);
      expect(before.status).toBe(200);

      await prisma.museum.update({
        where: { id: museum.id },
        data: { status: 'SUSPENDED' },
      });

      const after = await request(probeApp()).get('/probe').set('Authorization', `Bearer ${token}`);
      expect(after.status).toBe(403);
      expect(after.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('requireRole', () => {
    function probeApp() {
      const probe = express();
      probe.use(requestId);
      probe.use(express.json());
      probe.get('/system-only', requireAuth, requireRole('SYSTEM_ADMIN'), (_req, res) => {
        res.json({ ok: true });
      });
      probe.use(errorHandler);
      return probe;
    }

    it('returns 403 FORBIDDEN for the wrong role', async () => {
      const museum = await seedMuseum({ name: 'Adwa', slug: 'adwa' });
      const museumAdmin = await seedAdmin({
        email: 'museum@example.com',
        password: PASSWORD,
        role: 'MUSEUM_ADMIN',
        museumId: museum.id,
      });
      const systemAdmin = await seedAdmin({
        email: 'system@example.com',
        password: PASSWORD,
        role: 'SYSTEM_ADMIN',
      });

      const museumToken = signAuthToken({
        sub: museumAdmin.id,
        role: museumAdmin.role,
        museumId: museum.id,
      }).token;
      const systemToken = signAuthToken({
        sub: systemAdmin.id,
        role: systemAdmin.role,
        museumId: null,
      }).token;

      const denied = await request(probeApp())
        .get('/system-only')
        .set('Authorization', `Bearer ${museumToken}`);
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('FORBIDDEN');

      const allowed = await request(probeApp())
        .get('/system-only')
        .set('Authorization', `Bearer ${systemToken}`);
      expect(allowed.status).toBe(200);
    });
  });

  describe('requireMuseumScope', () => {
    function probeApp() {
      const probe = express();
      probe.use(requestId);
      probe.use(express.json());
      probe.get(
        '/rooms/:roomId',
        requireAuth,
        requireMuseumScope(async (req) => {
          const room = await prisma.room.findUnique({
            where: { id: req.params.roomId },
            select: { museumId: true },
          });
          return room?.museumId ?? null;
        }),
        (_req, res) => {
          res.json({ ok: true });
        },
      );
      probe.use(errorHandler);
      return probe;
    }

    it('returns 403 CROSS_TENANT_ACCESS when the room belongs to another museum', async () => {
      const adwa = await seedMuseum({ name: 'Adwa', slug: 'adwa' });
      const louvre = await seedMuseum({ name: 'Louvre', slug: 'louvre' });
      const louvreRoom = await seedRoom({
        museumId: louvre.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Antiquities',
      });
      const adwaAdmin = await seedAdmin({
        email: 'admin@adwa.test',
        password: PASSWORD,
        role: 'MUSEUM_ADMIN',
        museumId: adwa.id,
      });
      const token = signAuthToken({
        sub: adwaAdmin.id,
        role: adwaAdmin.role,
        museumId: adwa.id,
      }).token;

      const res = await request(probeApp())
        .get(`/rooms/${louvreRoom.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS');
    });

    it('returns 404 when the room does not exist', async () => {
      const adwa = await seedMuseum({ name: 'Adwa', slug: 'adwa' });
      const adwaAdmin = await seedAdmin({
        email: 'admin@adwa.test',
        password: PASSWORD,
        role: 'MUSEUM_ADMIN',
        museumId: adwa.id,
      });
      const token = signAuthToken({
        sub: adwaAdmin.id,
        role: adwaAdmin.role,
        museumId: adwa.id,
      }).token;

      const res = await request(probeApp())
        .get('/rooms/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('allows SYSTEM_ADMIN across museums', async () => {
      const louvre = await seedMuseum({ name: 'Louvre', slug: 'louvre' });
      const louvreRoom = await seedRoom({
        museumId: louvre.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Antiquities',
      });
      const systemAdmin = await seedAdmin({
        email: 'system@example.com',
        password: PASSWORD,
        role: 'SYSTEM_ADMIN',
      });
      const token = signAuthToken({
        sub: systemAdmin.id,
        role: systemAdmin.role,
        museumId: null,
      }).token;

      const res = await request(probeApp())
        .get(`/rooms/${louvreRoom.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
