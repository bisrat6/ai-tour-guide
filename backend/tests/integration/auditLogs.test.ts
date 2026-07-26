import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { ensureTestSchema, resetDatabase } from '../helpers/db.js';
import { authHeader, seedSystemAdmin, seedTenantAdmin } from '../helpers/scenario.js';

/**
 * The audit trail was written on every admin mutation but never readable. These
 * cover the two things that make it safe to expose: a museum admin cannot widen
 * its own view, and the before/after snapshots stay behind.
 */
describe('GET /admin/audit-logs', () => {
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

  async function seedEntry(opts: {
    museumId: string | null;
    adminUserId: string | null;
    action?: string;
    entityType?: string;
    createdAt?: Date;
  }) {
    return prisma.adminAuditLog.create({
      data: {
        museumId: opts.museumId,
        adminUserId: opts.adminUserId,
        action: opts.action ?? 'UPDATE',
        entityType: opts.entityType ?? 'Room',
        entityId: 'entity-1',
        before: { title: 'Before' },
        after: { title: 'After' },
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      },
    });
  }

  it('rejects an anonymous caller', async () => {
    const response = await request(app).get('/admin/audit-logs');
    expect(response.status).toBe(401);
  });

  it('returns newest first with the actor and the museum named', async () => {
    const { token, admin, museum } = await seedTenantAdmin({
      name: 'Adwa',
      slug: 'adwa',
      email: 'admin@adwa.test',
    });

    await seedEntry({
      museumId: museum.id,
      adminUserId: admin.id,
      action: 'CREATE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await seedEntry({
      museumId: museum.id,
      adminUserId: admin.id,
      action: 'DELETE',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    const response = await request(app).get('/admin/audit-logs').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].action).toBe('DELETE');
    expect(response.body.data[0].adminEmail).toBe('admin@adwa.test');
    expect(response.body.data[0].museumName).toBe('Adwa');
  });

  it('does not return the before and after snapshots', async () => {
    const { token, admin, museum } = await seedTenantAdmin({
      name: 'Adwa',
      slug: 'adwa',
      email: 'admin@adwa.test',
    });
    await seedEntry({ museumId: museum.id, adminUserId: admin.id });

    const response = await request(app).get('/admin/audit-logs').set(authHeader(token));

    expect(response.body.data[0]).not.toHaveProperty('before');
    expect(response.body.data[0]).not.toHaveProperty('after');
  });

  /** The isolation case: the trail is the one place a leak reveals other tenants' activity. */
  it('never shows a museum admin another museum, even when it asks by id', async () => {
    const tenantA = await seedTenantAdmin({ name: 'A', slug: 'a', email: 'a@test.local' });
    const tenantB = await seedTenantAdmin({ name: 'B', slug: 'b', email: 'b@test.local' });

    await seedEntry({ museumId: tenantA.museum.id, adminUserId: tenantA.admin.id });
    await seedEntry({ museumId: tenantB.museum.id, adminUserId: tenantB.admin.id });

    const response = await request(app)
      .get('/admin/audit-logs')
      .query({ museumId: tenantB.museum.id })
      .set(authHeader(tenantA.token));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].museumId).toBe(tenantA.museum.id);
  });

  it('shows a system admin every museum, and narrows to one on request', async () => {
    const system = await seedSystemAdmin();
    const tenantA = await seedTenantAdmin({ name: 'A', slug: 'a', email: 'a@test.local' });
    const tenantB = await seedTenantAdmin({ name: 'B', slug: 'b', email: 'b@test.local' });

    await seedEntry({ museumId: tenantA.museum.id, adminUserId: tenantA.admin.id });
    await seedEntry({ museumId: tenantB.museum.id, adminUserId: tenantB.admin.id });

    const all = await request(app).get('/admin/audit-logs').set(authHeader(system.token));
    expect(all.body.data).toHaveLength(2);

    const narrowed = await request(app)
      .get('/admin/audit-logs')
      .query({ museumId: tenantB.museum.id })
      .set(authHeader(system.token));
    expect(narrowed.body.data).toHaveLength(1);
    expect(narrowed.body.data[0].museumId).toBe(tenantB.museum.id);
  });

  /** The reconciler acts with nobody behind it, and its rows must still render. */
  it('returns an entry with no actor rather than dropping it', async () => {
    const system = await seedSystemAdmin();
    const tenant = await seedTenantAdmin({ name: 'A', slug: 'a', email: 'a@test.local' });
    await seedEntry({
      museumId: tenant.museum.id,
      adminUserId: null,
      entityType: 'Payment',
    });

    const response = await request(app).get('/admin/audit-logs').set(authHeader(system.token));

    expect(response.status).toBe(200);
    expect(response.body.data[0].adminUserId).toBeNull();
    expect(response.body.data[0].adminEmail).toBeNull();
    expect(response.body.data[0].entityType).toBe('Payment');
  });

  it('walks pages with the cursor without repeating a row', async () => {
    const tenant = await seedTenantAdmin({ name: 'A', slug: 'a', email: 'a@test.local' });
    for (let index = 0; index < 3; index += 1) {
      await seedEntry({
        museumId: tenant.museum.id,
        adminUserId: tenant.admin.id,
        createdAt: new Date(Date.UTC(2026, 0, index + 1)),
      });
    }

    const first = await request(app)
      .get('/admin/audit-logs')
      .query({ limit: 2 })
      .set(authHeader(tenant.token));
    expect(first.body.data).toHaveLength(2);
    expect(first.body.nextCursor).not.toBeNull();

    const second = await request(app)
      .get('/admin/audit-logs')
      .query({ limit: 2, cursor: first.body.nextCursor })
      .set(authHeader(tenant.token));
    expect(second.body.data).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();

    const ids = [...first.body.data, ...second.body.data].map((row: { id: string }) => row.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('rejects a limit past the cap rather than silently clamping', async () => {
    const tenant = await seedTenantAdmin({ name: 'A', slug: 'a', email: 'a@test.local' });

    const response = await request(app)
      .get('/admin/audit-logs')
      .query({ limit: 500 })
      .set(authHeader(tenant.token));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
