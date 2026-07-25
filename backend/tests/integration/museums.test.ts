import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signAuthToken } from '../../src/lib/jwt.js';
import { resetLoginAttemptsForTests } from '../../src/modules/auth/loginAttempts.js';
import { ensureTestSchema, resetDatabase, seedAdmin, seedMuseum } from '../helpers/db.js';

const PASSWORD = 'correct-horse-battery-staple';

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
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

async function seedMuseumWithAdmin(opts: { name: string; slug: string; email: string }) {
  const museum = await seedMuseum({ name: opts.name, slug: opts.slug });
  const admin = await seedAdmin({
    email: opts.email,
    password: PASSWORD,
    role: 'MUSEUM_ADMIN',
    museumId: museum.id,
  });
  const { token } = signAuthToken({ sub: admin.id, role: 'MUSEUM_ADMIN', museumId: museum.id });
  return { museum, admin, token };
}

describe('D1-4 museums', () => {
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

  describe('GET /admin/museums', () => {
    it('returns 401 without a token and 403 for a MUSEUM_ADMIN', async () => {
      const { token: museumToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });

      const noAuth = await request(app).get('/admin/museums');
      expect(noAuth.status).toBe(401);

      const wrongRole = await request(app).get('/admin/museums').set(authHeader(museumToken));
      expect(wrongRole.status).toBe(403);
      expect(wrongRole.body.error.code).toBe('FORBIDDEN');
    });

    it('paginates results for a SYSTEM_ADMIN across two pages', async () => {
      const { token } = await seedSystemAdmin();
      await seedMuseum({ name: 'Adwa', slug: 'adwa' });
      await seedMuseum({ name: 'Louvre', slug: 'louvre' });
      await seedMuseum({ name: 'Prado', slug: 'prado' });

      const page1 = await request(app)
        .get('/admin/museums')
        .query({ limit: 2 })
        .set(authHeader(token));
      expect(page1.status).toBe(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.nextCursor).not.toBeNull();

      const page2 = await request(app)
        .get('/admin/museums')
        .query({ limit: 2, cursor: page1.body.nextCursor })
        .set(authHeader(token));
      expect(page2.status).toBe(200);
      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.nextCursor).toBeNull();

      const allSlugs = [...page1.body.data, ...page2.body.data].map(
        (m: { slug: string }) => m.slug,
      );
      expect(new Set(allSlugs)).toEqual(new Set(['adwa', 'louvre', 'prado']));
    });
  });

  describe('GET /admin/museums/:id', () => {
    it('lets a SYSTEM_ADMIN read any museum and a MUSEUM_ADMIN read only their own', async () => {
      const { token: systemToken } = await seedSystemAdmin();
      const { museum: adwa, token: adwaToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const { museum: louvre } = await seedMuseumWithAdmin({
        name: 'Louvre',
        slug: 'louvre',
        email: 'admin@louvre.test',
      });

      const systemReadsLouvre = await request(app)
        .get(`/admin/museums/${louvre.id}`)
        .set(authHeader(systemToken));
      expect(systemReadsLouvre.status).toBe(200);
      expect(systemReadsLouvre.body.slug).toBe('louvre');

      const ownRead = await request(app)
        .get(`/admin/museums/${adwa.id}`)
        .set(authHeader(adwaToken));
      expect(ownRead.status).toBe(200);
      expect(ownRead.body.slug).toBe('adwa');

      const crossTenant = await request(app)
        .get(`/admin/museums/${louvre.id}`)
        .set(authHeader(adwaToken));
      expect(crossTenant.status).toBe(403);
      expect(crossTenant.body.error.code).toBe('CROSS_TENANT_ACCESS');
    });

    it('returns 404 for a museum that does not exist', async () => {
      const { token } = await seedSystemAdmin();
      const res = await request(app)
        .get('/admin/museums/00000000-0000-4000-8000-000000000000')
        .set(authHeader(token));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /admin/museums', () => {
    it('creates the museum and its first MUSEUM_ADMIN in one transaction, and that admin can log in', async () => {
      const { token, admin: systemAdmin } = await seedSystemAdmin();

      const res = await request(app).post('/admin/museums').set(authHeader(token)).send({
        name: 'Prado Museum',
        slug: 'prado',
        adminEmail: 'admin@prado.test',
        adminPassword: PASSWORD,
      });

      expect(res.status).toBe(201);
      expect(res.body.museum).toMatchObject({
        name: 'Prado Museum',
        slug: 'prado',
        status: 'ACTIVE',
      });
      expect(res.body.admin).toMatchObject({
        email: 'admin@prado.test',
        role: 'MUSEUM_ADMIN',
        museumId: res.body.museum.id,
      });

      const login = await request(app)
        .post('/admin/login')
        .send({ email: 'admin@prado.test', password: PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.museumId).toBe(res.body.museum.id);

      const logs = await prisma.adminAuditLog.findMany({
        where: { museumId: res.body.museum.id },
        orderBy: { entityType: 'asc' },
      });
      expect(logs).toHaveLength(2);
      expect(logs.map((l) => `${l.action}:${l.entityType}`).sort()).toEqual([
        'CREATE:AdminUser',
        'CREATE:Museum',
      ]);
      expect(logs.every((l) => l.adminUserId === systemAdmin.id)).toBe(true);
    });

    it('rejects a MUSEUM_ADMIN and returns 409 CONFLICT on duplicate slug or email', async () => {
      const { token: systemToken } = await seedSystemAdmin();
      const { token: museumToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });

      const forbidden = await request(app)
        .post('/admin/museums')
        .set(authHeader(museumToken))
        .send({
          name: 'X',
          slug: 'x-museum',
          adminEmail: 'x@example.com',
          adminPassword: PASSWORD,
        });
      expect(forbidden.status).toBe(403);

      const duplicateSlug = await request(app)
        .post('/admin/museums')
        .set(authHeader(systemToken))
        .send({
          name: 'Another Adwa',
          slug: 'adwa',
          adminEmail: 'new@example.com',
          adminPassword: PASSWORD,
        });
      expect(duplicateSlug.status).toBe(409);
      expect(duplicateSlug.body.error.code).toBe('CONFLICT');

      const duplicateEmail = await request(app)
        .post('/admin/museums')
        .set(authHeader(systemToken))
        .send({
          name: 'Brand New',
          slug: 'brand-new',
          adminEmail: 'admin@adwa.test',
          adminPassword: PASSWORD,
        });
      expect(duplicateEmail.status).toBe(409);
      expect(duplicateEmail.body.error.code).toBe('CONFLICT');
    });
  });

  describe('PATCH /admin/museums/:id', () => {
    it("lets a museum's own admin update content fields but not status", async () => {
      const { museum, token } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });

      const contentUpdate = await request(app)
        .patch(`/admin/museums/${museum.id}`)
        .set(authHeader(token))
        .send({ systemPrompt: 'You are the Adwa guide.', defaultVoiceId: 'voice-1' });
      expect(contentUpdate.status).toBe(200);
      expect(contentUpdate.body.systemPrompt).toBe('You are the Adwa guide.');
      expect(contentUpdate.body.defaultVoiceId).toBe('voice-1');
      expect(contentUpdate.body.status).toBe('ACTIVE');

      const statusAttempt = await request(app)
        .patch(`/admin/museums/${museum.id}`)
        .set(authHeader(token))
        .send({ status: 'SUSPENDED' });
      expect(statusAttempt.status).toBe(403);
      expect(statusAttempt.body.error.code).toBe('FORBIDDEN');
    });

    it('lets a SYSTEM_ADMIN suspend a museum and blocks cross-tenant patches', async () => {
      const { token: systemToken } = await seedSystemAdmin();
      const { museum: adwa, admin: adwaAdmin } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const { token: louvreToken } = await seedMuseumWithAdmin({
        name: 'Louvre',
        slug: 'louvre',
        email: 'admin@louvre.test',
      });

      const suspend = await request(app)
        .patch(`/admin/museums/${adwa.id}`)
        .set(authHeader(systemToken))
        .send({ status: 'SUSPENDED' });
      expect(suspend.status).toBe(200);
      expect(suspend.body.status).toBe('SUSPENDED');

      const crossTenant = await request(app)
        .patch(`/admin/museums/${adwa.id}`)
        .set(authHeader(louvreToken))
        .send({ systemPrompt: 'hijacked' });
      expect(crossTenant.status).toBe(403);
      expect(crossTenant.body.error.code).toBe('CROSS_TENANT_ACCESS');

      const log = await prisma.adminAuditLog.findFirst({
        where: { entityType: 'Museum', entityId: adwa.id, action: 'UPDATE' },
      });
      expect(log).not.toBeNull();
      expect((log?.before as { status: string }).status).toBe('ACTIVE');
      expect((log?.after as { status: string }).status).toBe('SUSPENDED');

      // The suspended museum's own admin is now locked out entirely (§8.2).
      const lockedOut = await request(app)
        .get(`/admin/museums/${adwa.id}`)
        .set(
          authHeader(
            signAuthToken({ sub: adwaAdmin.id, role: 'MUSEUM_ADMIN', museumId: adwa.id }).token,
          ),
        );
      expect(lockedOut.status).toBe(403);
    });
  });

  describe('POST /admin/museums/:id/admins', () => {
    it('adds a second admin who can then log in, and is scoped to one museum', async () => {
      const { token: systemToken } = await seedSystemAdmin();
      const { museum, token: museumToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const other = await seedMuseumWithAdmin({
        name: 'Other',
        slug: 'other',
        email: 'admin@other.test',
      });

      // A museum staffs itself, but only itself: the role is fixed to
      // MUSEUM_ADMIN and the museum comes from the path, so this can never mint
      // an operator or reach another tenant.
      const own = await request(app)
        .post(`/admin/museums/${museum.id}/admins`)
        .set(authHeader(museumToken))
        .send({ email: 'colleague@adwa.test', password: PASSWORD });
      expect(own.status).toBe(201);
      expect(own.body).toMatchObject({ role: 'MUSEUM_ADMIN', museumId: museum.id });

      const crossTenant = await request(app)
        .post(`/admin/museums/${other.museum.id}/admins`)
        .set(authHeader(museumToken))
        .send({ email: 'intruder@other.test', password: PASSWORD });
      expect(crossTenant.status).toBe(403);

      const added = await request(app)
        .post(`/admin/museums/${museum.id}/admins`)
        .set(authHeader(systemToken))
        .send({ email: 'second@adwa.test', password: PASSWORD });
      expect(added.status).toBe(201);
      expect(added.body).toMatchObject({
        email: 'second@adwa.test',
        role: 'MUSEUM_ADMIN',
        museumId: museum.id,
      });

      const login = await request(app)
        .post('/admin/login')
        .send({ email: 'second@adwa.test', password: PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.museumId).toBe(museum.id);
    });

    it('returns 409 on duplicate email and 404 for a museum that does not exist', async () => {
      const { token: systemToken } = await seedSystemAdmin();
      const { museum } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });

      const duplicate = await request(app)
        .post(`/admin/museums/${museum.id}/admins`)
        .set(authHeader(systemToken))
        .send({ email: 'admin@adwa.test', password: PASSWORD });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('CONFLICT');

      const missing = await request(app)
        .post('/admin/museums/00000000-0000-4000-8000-000000000000/admins')
        .set(authHeader(systemToken))
        .send({ email: 'new@example.com', password: PASSWORD });
      expect(missing.status).toBe(404);
    });
  });
});
