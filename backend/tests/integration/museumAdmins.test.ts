import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { ensureTestSchema, resetDatabase, seedAdmin } from '../helpers/db.js';
import {
  ISOLATION_PASSWORD,
  authHeader,
  seedSystemAdmin,
  seedTenantAdmin,
} from '../helpers/scenario.js';

/**
 * Unlike the POST on the same path, this is scoped rather than
 * SYSTEM_ADMIN-only — so the two cases that matter are that a museum admin can
 * read its own, and cannot read anyone else's.
 */
describe('GET /admin/museums/:id/admins', () => {
  const app = createApp();

  beforeAll(() => {
    ensureTestSchema();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects an anonymous caller', async () => {
    const tenant = await seedTenantAdmin({ name: 'A', slug: 'a', email: 'a@test.local' });
    const response = await request(app).get(`/admin/museums/${tenant.museum.id}/admins`);
    expect(response.status).toBe(401);
  });

  it('lets a museum admin read its own museum', async () => {
    const tenant = await seedTenantAdmin({ name: 'Adwa', slug: 'adwa', email: 'a@adwa.test' });
    await seedAdmin({
      email: 'second@adwa.test',
      password: ISOLATION_PASSWORD,
      role: 'MUSEUM_ADMIN',
      museumId: tenant.museum.id,
    });

    const response = await request(app)
      .get(`/admin/museums/${tenant.museum.id}/admins`)
      .set(authHeader(tenant.token));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data.map((row: { email: string }) => row.email)).toContain(
      'second@adwa.test',
    );
  });

  it('never returns the password hash', async () => {
    const tenant = await seedTenantAdmin({ name: 'Adwa', slug: 'adwa', email: 'a@adwa.test' });

    const response = await request(app)
      .get(`/admin/museums/${tenant.museum.id}/admins`)
      .set(authHeader(tenant.token));

    expect(response.body.data[0]).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('$2b$');
  });

  it('refuses one museum admin reading another museum', async () => {
    const tenantA = await seedTenantAdmin({ name: 'A', slug: 'a', email: 'a@test.local' });
    const tenantB = await seedTenantAdmin({ name: 'B', slug: 'b', email: 'b@test.local' });

    const response = await request(app)
      .get(`/admin/museums/${tenantB.museum.id}/admins`)
      .set(authHeader(tenantA.token));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CROSS_TENANT_ACCESS');
  });

  it('lets a system admin read any museum', async () => {
    const system = await seedSystemAdmin();
    const tenant = await seedTenantAdmin({ name: 'A', slug: 'a', email: 'a@test.local' });

    const response = await request(app)
      .get(`/admin/museums/${tenant.museum.id}/admins`)
      .set(authHeader(system.token));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].lastLoginAt).toBeNull();
    expect(response.body.data[0].createdAt).toEqual(expect.any(String));
  });

  it('404s for a museum that does not exist', async () => {
    const system = await seedSystemAdmin();

    const response = await request(app)
      .get('/admin/museums/11111111-1111-4111-8111-111111111111/admins')
      .set(authHeader(system.token));

    expect(response.status).toBe(404);
  });

  it('walks pages with the cursor without repeating a row', async () => {
    const tenant = await seedTenantAdmin({ name: 'A', slug: 'a', email: 'a@test.local' });
    for (let index = 0; index < 2; index += 1) {
      await seedAdmin({
        email: `extra${index}@test.local`,
        password: ISOLATION_PASSWORD,
        role: 'MUSEUM_ADMIN',
        museumId: tenant.museum.id,
      });
    }

    const first = await request(app)
      .get(`/admin/museums/${tenant.museum.id}/admins`)
      .query({ limit: 2 })
      .set(authHeader(tenant.token));
    expect(first.body.data).toHaveLength(2);
    expect(first.body.nextCursor).not.toBeNull();

    const second = await request(app)
      .get(`/admin/museums/${tenant.museum.id}/admins`)
      .query({ limit: 2, cursor: first.body.nextCursor })
      .set(authHeader(tenant.token));
    expect(second.body.data).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();

    const ids = [...first.body.data, ...second.body.data].map((row: { id: string }) => row.id);
    expect(new Set(ids).size).toBe(3);
  });
});
