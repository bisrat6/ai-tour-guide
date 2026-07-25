/**
 * D1-7: the §17.2 tenant isolation matrix, consolidated into one canonical
 * suite instead of scattered across each module's own tests. Case 5 in
 * particular asserts response *contents*, not just status — a route that
 * returns 200 with the wrong museum's rooms is exactly the bug this exists
 * to catch (§17.2).
 *
 * Case 9 covers the visitor side of suspension across all four visitor entry
 * points; it was an it.todo until Developer 2's routes were integrated.
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetLoginAttemptsForTests } from '../../src/modules/auth/loginAttempts.js';
import { ensureTestSchema, resetDatabase, seedItem, seedRoom } from '../helpers/db.js';
import { authHeader, seedSystemAdmin, seedTenantAdmin } from '../helpers/scenario.js';

describe('D1-7 tenant isolation matrix (§17.2)', () => {
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

  async function seedScenario() {
    const system = await seedSystemAdmin();
    const tenantA = await seedTenantAdmin({ name: 'Adwa', slug: 'adwa', email: 'admin@adwa.test' });
    const tenantB = await seedTenantAdmin({
      name: 'Louvre',
      slug: 'louvre',
      email: 'admin@louvre.test',
    });
    const roomA1 = await seedRoom({
      museumId: tenantA.museum.id,
      legacyId: 'room_1',
      storyOrder: 1,
      title: 'A Room 1',
    });
    const roomB1 = await seedRoom({
      museumId: tenantB.museum.id,
      legacyId: 'room_1',
      storyOrder: 1,
      title: 'B Room 1',
    });
    const itemB1 = await seedItem({ roomId: roomB1.id, name: 'B Item 1' });
    return { system, tenantA, tenantB, roomA1, roomB1, itemB1 };
  }

  it('Case 1: museum A admin GETs a room belonging to museum B by ID -> 403 CROSS_TENANT_ACCESS', async () => {
    const { tenantA, roomB1 } = await seedScenario();
    const res = await request(app).get(`/admin/rooms/${roomB1.id}`).set(authHeader(tenantA.token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS');
  });

  it('Case 2: museum A admin PATCHes museum B\u2019s room -> 403', async () => {
    const { tenantA, roomB1 } = await seedScenario();
    const res = await request(app)
      .patch(`/admin/rooms/${roomB1.id}`)
      .set(authHeader(tenantA.token))
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS');
  });

  it('Case 3: museum A admin DELETEs museum B\u2019s item -> 403', async () => {
    const { tenantA, itemB1 } = await seedScenario();
    const res = await request(app)
      .delete(`/admin/items/${itemB1.id}`)
      .set(authHeader(tenantA.token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS');

    const stillThere = await prisma.item.findUnique({ where: { id: itemB1.id } });
    expect(stillThere).not.toBeNull();
  });

  it('Case 4: museum A admin creates a room with nextRoomId in museum B -> 422 INVALID_ROOM_SEQUENCE', async () => {
    const { tenantA, roomB1 } = await seedScenario();
    const res = await request(app).post('/admin/rooms').set(authHeader(tenantA.token)).send({
      title: 'A Room 2',
      roomOverviewText: 'overview',
      narrationScript: 'script',
      storyOrder: 2,
      nextRoomId: roomB1.id,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_ROOM_SEQUENCE');
  });

  it('Case 5: museum A admin\u2019s GET /admin/rooms?museumId=<B> returns 200 with ONLY museum A\u2019s rooms', async () => {
    const { tenantA, tenantB, roomA1, roomB1 } = await seedScenario();
    const roomA2 = await seedRoom({
      museumId: tenantA.museum.id,
      legacyId: 'room_2',
      storyOrder: 2,
      title: 'A Room 2',
    });

    const res = await request(app)
      .get('/admin/rooms')
      .query({ museumId: tenantB.museum.id }) // ignored — MUSEUM_ADMIN scope always wins
      .set(authHeader(tenantA.token));

    expect(res.status).toBe(200);
    const returnedIds = res.body.data.map((r: { id: string }) => r.id);
    expect(new Set(returnedIds)).toEqual(new Set([roomA1.id, roomA2.id]));
    expect(returnedIds).not.toContain(roomB1.id);
    for (const room of res.body.data as { museumId: string }[]) {
      expect(room.museumId).toBe(tenantA.museum.id);
    }
  });

  it('Case 6: museum A admin PATCHes museum B\u2019s ticketValidationUrl -> 403', async () => {
    const { tenantA, tenantB } = await seedScenario();
    const res = await request(app)
      .patch(`/admin/museums/${tenantB.museum.id}`)
      .set(authHeader(tenantA.token))
      .send({ ticketValidationUrl: 'https://example.com/validate' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS');
  });

  it('Case 7: museum A admin sets status on their own museum -> 403 FORBIDDEN (system-only field)', async () => {
    const { tenantA } = await seedScenario();
    const res = await request(app)
      .patch(`/admin/museums/${tenantA.museum.id}`)
      .set(authHeader(tenantA.token))
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Case 8: SYSTEM_ADMIN reads and writes any museum\u2019s resources -> 200', async () => {
    const { system, tenantB, roomB1 } = await seedScenario();

    const read = await request(app).get(`/admin/rooms/${roomB1.id}`).set(authHeader(system.token));
    expect(read.status).toBe(200);

    const write = await request(app)
      .patch(`/admin/museums/${tenantB.museum.id}`)
      .set(authHeader(system.token))
      .send({ status: 'SUSPENDED' });
    expect(write.status).toBe(200);
    expect(write.body.status).toBe('SUSPENDED');
  });

  it("Case 9: suspended museum's room via GET /waypoint/:id -> 404", async () => {
    const { system, tenantB, roomB1 } = await seedScenario();

    // Reachable before suspension, which is what makes the 404 afterwards
    // meaningful rather than a room that was never visible.
    const before = await request(app).get(`/waypoint/${roomB1.id}`);
    expect(before.status).toBe(200);

    const suspend = await request(app)
      .patch(`/admin/museums/${tenantB.museum.id}`)
      .set(authHeader(system.token))
      .send({ status: 'SUSPENDED' });
    expect(suspend.status).toBe(200);

    // 404 rather than 403: a visitor must not be able to tell a suspended
    // museum from one that never existed.
    const after = await request(app).get(`/waypoint/${roomB1.id}`);
    expect(after.status).toBe(404);
    expect(after.body.error.code).toBe('NOT_FOUND');

    // The same must hold for every other visitor entry point into that tenant.
    expect((await request(app).get(`/museums/${tenantB.museum.slug}`)).status).toBe(404);
    expect((await request(app).get(`/narrate/room/${roomB1.id}`)).status).toBe(404);
    expect(
      (
        await request(app)
          .post('/chat')
          .send({ waypointId: roomB1.id, question: 'Is this reachable?' })
      ).status,
    ).toBe(404);
  });

  it("Case 10: suspended museum's admin using a token issued before suspension -> 403", async () => {
    const { system, tenantB } = await seedScenario();

    const before = await request(app)
      .get(`/admin/museums/${tenantB.museum.id}`)
      .set(authHeader(tenantB.token));
    expect(before.status).toBe(200);

    const suspend = await request(app)
      .patch(`/admin/museums/${tenantB.museum.id}`)
      .set(authHeader(system.token))
      .send({ status: 'SUSPENDED' });
    expect(suspend.status).toBe(200);

    const after = await request(app)
      .get(`/admin/museums/${tenantB.museum.id}`)
      .set(authHeader(tenantB.token));
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe('FORBIDDEN');
  });

  it('Case 11: room create/update with nextRoomId forming a cycle -> 422', async () => {
    const { tenantA, roomA1 } = await seedScenario();
    const roomA2 = await seedRoom({
      museumId: tenantA.museum.id,
      legacyId: 'room_2',
      storyOrder: 2,
      title: 'A Room 2',
    });

    const link = await request(app)
      .patch(`/admin/rooms/${roomA1.id}`)
      .set(authHeader(tenantA.token))
      .send({ nextRoomId: roomA2.id });
    expect(link.status).toBe(200);

    const cycle = await request(app)
      .patch(`/admin/rooms/${roomA2.id}`)
      .set(authHeader(tenantA.token))
      .send({ nextRoomId: roomA1.id });
    expect(cycle.status).toBe(422);
    expect(cycle.body.error.code).toBe('INVALID_ROOM_SEQUENCE');
  });

  it('Case 12: expired, malformed, and missing tokens all return 401', async () => {
    const { tenantA } = await seedScenario();

    const missing = await request(app).get('/admin/rooms').query({ museumId: tenantA.museum.id });
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('UNAUTHENTICATED');

    const malformed = await request(app)
      .get('/admin/rooms')
      .query({ museumId: tenantA.museum.id })
      .set('Authorization', 'Bearer not.a.jwt');
    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe('UNAUTHENTICATED');

    const expiredToken = jwt.sign(
      { sub: tenantA.admin.id, role: tenantA.admin.role, museumId: tenantA.museum.id },
      env.JWT_SECRET,
      { expiresIn: '1ms' },
    );
    await new Promise((r) => setTimeout(r, 20));
    const expired = await request(app)
      .get('/admin/rooms')
      .query({ museumId: tenantA.museum.id })
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe('UNAUTHENTICATED');
  });
});
