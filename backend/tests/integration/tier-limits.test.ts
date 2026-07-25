import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, resetFakes } from '../helpers/app.js';
import { authHeader, mintToken } from '../helpers/auth.js';
import { prisma, resetDb, seedMuseum, seedSystemAdmin } from '../helpers/db.js';

describe('tier isolation + limits', () => {
  beforeEach(async () => {
    await resetDb();
    resetFakes();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. museum A checkout with museumId=B still charges A only', async () => {
    const a = await seedMuseum({ slug: 'a', name: 'A', tier: 'BASIC', roomCount: 1 });
    const b = await seedMuseum({ slug: 'b', name: 'B', tier: 'BASIC', roomCount: 1 });
    const token = mintToken({ id: a.adminId, role: 'MUSEUM_ADMIN', museumId: a.id });

    const res = await api()
      .post('/admin/billing/checkout')
      .set(authHeader(token))
      .send({ tier: 'PRO', museumId: b.id });

    expect(res.status).toBe(201);
    const payment = await prisma.payment.findUnique({ where: { txRef: res.body.txRef } });
    expect(payment?.museumId).toBe(a.id);
  });

  it('2. museum A status?museumId=B returns only A data (contents, not just status)', async () => {
    const a = await seedMuseum({ slug: 'a2', name: 'Museum A', tier: 'BASIC', roomCount: 1 });
    const b = await seedMuseum({ slug: 'b2', name: 'Museum B', tier: 'PRO', roomCount: 3 });
    const token = mintToken({ id: a.adminId, role: 'MUSEUM_ADMIN', museumId: a.id });

    const res = await api()
      .get(`/admin/billing/status?museumId=${b.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.museumId).toBe(a.id);
    expect(res.body.museumId).not.toBe(b.id);
    expect(res.body.tier).toBe('BASIC');
    expect(res.body.usage.rooms).toBe(1);
  });

  it('3. museum A cannot read B payment → 403 CROSS_TENANT_ACCESS', async () => {
    const a = await seedMuseum({ slug: 'a3', name: 'A3', tier: 'BASIC', roomCount: 1 });
    const b = await seedMuseum({ slug: 'b3', name: 'B3', tier: 'BASIC', roomCount: 1 });
    const payment = await prisma.payment.create({
      data: {
        museumId: b.id,
        tier: 'PRO',
        amountEtb: 4500,
        txRef: 'adwa-b3-secret-tx',
        status: 'PENDING',
        initiatedByAdminId: b.adminId,
      },
    });
    const token = mintToken({ id: a.adminId, role: 'MUSEUM_ADMIN', museumId: a.id });

    const res = await api()
      .get(`/admin/billing/payments/${payment.txRef}`)
      .set(authHeader(token));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS');
  });

  it('4. museum admin cannot POST /admin/billing/tier → 403 FORBIDDEN', async () => {
    const a = await seedMuseum({ slug: 'a4', name: 'A4', tier: 'BASIC', roomCount: 1 });
    const token = mintToken({ id: a.adminId, role: 'MUSEUM_ADMIN', museumId: a.id });

    const res = await api()
      .post('/admin/billing/tier')
      .set(authHeader(token))
      .send({
        museumId: a.id,
        tier: 'ENTERPRISE',
        reason: 'Trying to self-upgrade without paying',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('5. SYSTEM_ADMIN can read any museum billing status', async () => {
    const a = await seedMuseum({ slug: 'a5', name: 'A5', tier: 'PRO', roomCount: 2 });
    const system = await seedSystemAdmin();
    const token = mintToken({ id: system.id, role: 'SYSTEM_ADMIN', museumId: null });

    const res = await api()
      .get(`/admin/billing/status?museumId=${a.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.museumId).toBe(a.id);
    expect(res.body.tier).toBe('PRO');
  });

  it('6. BASIC museum at 1 room → second create is 403 TIER_LIMIT_EXCEEDED', async () => {
    const a = await seedMuseum({ slug: 'basic', name: 'Basic', tier: 'BASIC', roomCount: 1 });
    const token = mintToken({ id: a.adminId, role: 'MUSEUM_ADMIN', museumId: a.id });

    const res = await api()
      .post('/dev/rooms')
      .set(authHeader(token))
      .send({ title: 'Second room', storyOrder: 2 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TIER_LIMIT_EXCEEDED');
    expect(res.body.error.details?.[0]).toMatchObject({
      limit: 'maxRooms',
      tier: 'BASIC',
      allowed: 1,
      current: 1,
    });
  });

  it('7. PRO museum at 3 rooms → fourth create is 403 TIER_LIMIT_EXCEEDED', async () => {
    const a = await seedMuseum({ slug: 'pro', name: 'Pro', tier: 'PRO', roomCount: 3 });
    const token = mintToken({ id: a.adminId, role: 'MUSEUM_ADMIN', museumId: a.id });

    const res = await api()
      .post('/dev/rooms')
      .set(authHeader(token))
      .send({ title: 'Fourth', storyOrder: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TIER_LIMIT_EXCEEDED');
    expect(res.body.error.details?.[0]).toMatchObject({
      limit: 'maxRooms',
      tier: 'PRO',
      allowed: 3,
      current: 3,
    });
  });

  it('8. ENTERPRISE museum can create a tenth room', async () => {
    const a = await seedMuseum({
      slug: 'ent',
      name: 'Enterprise',
      tier: 'ENTERPRISE',
      roomCount: 9,
    });
    const token = mintToken({ id: a.adminId, role: 'MUSEUM_ADMIN', museumId: a.id });

    const res = await api()
      .post('/dev/rooms')
      .set(authHeader(token))
      .send({ title: 'Tenth', storyOrder: 10 });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Tenth');
  });

  it('9. PAST_DUE museum cannot create a room → 403 SUBSCRIPTION_INACTIVE', async () => {
    const a = await seedMuseum({
      slug: 'pastdue',
      name: 'Past Due',
      tier: 'PRO',
      roomCount: 1,
      subscriptionStatus: 'PAST_DUE',
    });
    const token = mintToken({ id: a.adminId, role: 'MUSEUM_ADMIN', museumId: a.id });

    const res = await api()
      .post('/dev/rooms')
      .set(authHeader(token))
      .send({ title: 'Blocked', storyOrder: 2 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_INACTIVE');
  });

  it.skip('10. PAST_DUE museum GET /waypoint/:id still 200 — needs Dev 2 visitor routes', () => {
    // Visitor path must stay open when billing lapses. Re-enable when Dev 2 lands.
  });

  it.skip('11. PAST_DUE museum PATCH room still 200 — needs Dev 1 admin update route', () => {
    // Edits are not gated. Re-enable when PATCH /admin/rooms/:id exists.
  });

  it('12. PRO downgraded to BASIC keeps rooms; a fourth create is rejected', async () => {
    const a = await seedMuseum({ slug: 'down', name: 'Down', tier: 'PRO', roomCount: 3 });
    const system = await seedSystemAdmin();
    const sysToken = mintToken({ id: system.id, role: 'SYSTEM_ADMIN', museumId: null });

    const downgrade = await api()
      .post('/admin/billing/tier')
      .set(authHeader(sysToken))
      .send({
        museumId: a.id,
        tier: 'BASIC',
        reason: 'Offline downgrade after refund negotiation',
      });
    expect(downgrade.status).toBe(200);

    const rooms = await prisma.room.count({ where: { museumId: a.id } });
    expect(rooms).toBe(3);

    const adminToken = mintToken({ id: a.adminId, role: 'MUSEUM_ADMIN', museumId: a.id });
    const res = await api()
      .post('/dev/rooms')
      .set(authHeader(adminToken))
      .send({ title: 'Fourth after downgrade', storyOrder: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TIER_LIMIT_EXCEEDED');
    expect(res.body.error.details?.[0].tier).toBe('BASIC');
  });

  it('13. SYSTEM_ADMIN creating a fourth room on PRO museum is still limited', async () => {
    const a = await seedMuseum({ slug: 'syslim', name: 'SysLim', tier: 'PRO', roomCount: 3 });
    const system = await seedSystemAdmin();
    const token = mintToken({ id: system.id, role: 'SYSTEM_ADMIN', museumId: null });

    const res = await api()
      .post('/dev/rooms')
      .set(authHeader(token))
      .send({ title: 'Sys fourth', storyOrder: 4, museumId: a.id });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TIER_LIMIT_EXCEEDED');
  });

  it('unauthenticated billing status → 401', async () => {
    const res = await api().get('/admin/billing/status');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('garbage token → 401', async () => {
    const res = await api()
      .get('/admin/billing/status')
      .set(authHeader('garbage.token.here'));
    expect(res.status).toBe(401);
  });
});
