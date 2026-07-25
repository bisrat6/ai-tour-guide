import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signAuthToken } from '../../src/lib/jwt.js';
import { resetLoginAttemptsForTests } from '../../src/modules/auth/loginAttempts.js';
import {
  ensureTestSchema,
  resetDatabase,
  seedAdmin,
  seedChatAnswer,
  seedItem,
  seedMuseum,
  seedRoom,
} from '../helpers/db.js';

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
  return signAuthToken({ sub: admin.id, role: 'SYSTEM_ADMIN', museumId: null }).token;
}

async function seedMuseumWithAdmin(opts: { name: string; slug: string; email: string }) {
  const museum = await seedMuseum({ name: opts.name, slug: opts.slug });
  const admin = await seedAdmin({
    email: opts.email,
    password: PASSWORD,
    role: 'MUSEUM_ADMIN',
    museumId: museum.id,
  });
  const token = signAuthToken({ sub: admin.id, role: 'MUSEUM_ADMIN', museumId: museum.id }).token;
  return { museum, admin, token };
}

describe('D1-5 rooms', () => {
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

  describe('GET /admin/rooms', () => {
    it("ignores a MUSEUM_ADMIN's museumId query param and returns only their own museum's rooms", async () => {
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
      await seedRoom({
        museumId: adwa.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Adwa Room 1',
      });
      await seedRoom({
        museumId: louvre.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Louvre Room 1',
      });

      const res = await request(app)
        .get('/admin/rooms')
        .query({ museumId: louvre.id })
        .set(authHeader(adwaToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ title: 'Adwa Room 1', museumId: adwa.id });
    });

    it('requires museumId for a SYSTEM_ADMIN and lets it query any museum', async () => {
      const systemToken = await seedSystemAdmin();
      const { museum: adwa } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      await seedRoom({
        museumId: adwa.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Adwa Room 1',
      });

      const missing = await request(app).get('/admin/rooms').set(authHeader(systemToken));
      expect(missing.status).toBe(400);
      expect(missing.body.error.code).toBe('VALIDATION_ERROR');

      const withMuseum = await request(app)
        .get('/admin/rooms')
        .query({ museumId: adwa.id })
        .set(authHeader(systemToken));
      expect(withMuseum.status).toBe(200);
      expect(withMuseum.body.data).toHaveLength(1);
    });
  });

  describe('GET /admin/rooms/:id', () => {
    it('includes items ordered by displayOrder and enforces museum scope', async () => {
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
      const room = await seedRoom({
        museumId: adwa.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Room 1',
      });
      await seedItem({ roomId: room.id, name: 'Second Item', displayOrder: 1 });
      await seedItem({ roomId: room.id, name: 'First Item', displayOrder: 0 });
      const louvreRoom = await seedRoom({
        museumId: louvre.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Louvre Room 1',
      });

      const res = await request(app).get(`/admin/rooms/${room.id}`).set(authHeader(adwaToken));
      expect(res.status).toBe(200);
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual([
        'First Item',
        'Second Item',
      ]);

      const crossTenant = await request(app)
        .get(`/admin/rooms/${louvreRoom.id}`)
        .set(authHeader(adwaToken));
      expect(crossTenant.status).toBe(403);
      expect(crossTenant.body.error.code).toBe('CROSS_TENANT_ACCESS');
    });
  });

  describe('POST /admin/rooms', () => {
    it("creates the room under the caller's own museum regardless of the body's museumId", async () => {
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

      const res = await request(app).post('/admin/rooms').set(authHeader(adwaToken)).send({
        museumId: louvre.id,
        title: 'Sneaky Room',
        roomOverviewText: 'overview',
        narrationScript: 'script',
        storyOrder: 1,
      });

      expect(res.status).toBe(201);
      expect(res.body.museumId).toBe(adwa.id);
    });

    it('requires museumId for SYSTEM_ADMIN and rejects duplicate storyOrder with 409', async () => {
      const systemToken = await seedSystemAdmin();
      const { museum: adwa } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      await seedRoom({ museumId: adwa.id, legacyId: 'room_1', storyOrder: 1, title: 'Room 1' });

      const missingMuseum = await request(app)
        .post('/admin/rooms')
        .set(authHeader(systemToken))
        .send({ title: 'X', roomOverviewText: 'o', narrationScript: 's', storyOrder: 2 });
      expect(missingMuseum.status).toBe(400);

      const duplicateOrder = await request(app)
        .post('/admin/rooms')
        .set(authHeader(systemToken))
        .send({
          museumId: adwa.id,
          title: 'Room 1 Again',
          roomOverviewText: 'o',
          narrationScript: 's',
          storyOrder: 1,
        });
      expect(duplicateOrder.status).toBe(409);
      expect(duplicateOrder.body.error.code).toBe('CONFLICT');
    });

    it('rejects a nextRoomId that belongs to another museum with 422', async () => {
      const { token: adwaToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const { museum: louvre } = await seedMuseumWithAdmin({
        name: 'Louvre',
        slug: 'louvre',
        email: 'admin@louvre.test',
      });
      const louvreRoom = await seedRoom({
        museumId: louvre.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Louvre Room 1',
      });

      const res = await request(app).post('/admin/rooms').set(authHeader(adwaToken)).send({
        title: 'Adwa Room',
        roomOverviewText: 'o',
        narrationScript: 's',
        storyOrder: 1,
        nextRoomId: louvreRoom.id,
      });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_ROOM_SEQUENCE');
    });
  });

  describe('PATCH /admin/rooms/:id', () => {
    it('purges cached chat answers on a content update', async () => {
      const { museum: adwa, token: adwaToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const room = await seedRoom({
        museumId: adwa.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Room 1',
      });
      await seedChatAnswer({ roomId: room.id, questionHash: 'hash-1' });

      const res = await request(app)
        .patch(`/admin/rooms/${room.id}`)
        .set(authHeader(adwaToken))
        .send({ narrationScript: 'Updated narration.' });

      expect(res.status).toBe(200);
      expect(res.body.narrationScript).toBe('Updated narration.');

      const remaining = await prisma.chatAnswer.count({ where: { roomId: room.id } });
      expect(remaining).toBe(0);
    });

    it('detects a cycle across nextRoomId updates and rejects with 422', async () => {
      const { museum: adwa, token: adwaToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const roomA = await seedRoom({
        museumId: adwa.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'A',
      });
      const roomB = await seedRoom({
        museumId: adwa.id,
        legacyId: 'room_2',
        storyOrder: 2,
        title: 'B',
      });

      const linkAtoB = await request(app)
        .patch(`/admin/rooms/${roomA.id}`)
        .set(authHeader(adwaToken))
        .send({ nextRoomId: roomB.id });
      expect(linkAtoB.status).toBe(200);

      const cycle = await request(app)
        .patch(`/admin/rooms/${roomB.id}`)
        .set(authHeader(adwaToken))
        .send({ nextRoomId: roomA.id });
      expect(cycle.status).toBe(422);
      expect(cycle.body.error.code).toBe('INVALID_ROOM_SEQUENCE');
    });

    it('blocks a cross-tenant patch with 403', async () => {
      const { token: adwaToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const { museum: louvre } = await seedMuseumWithAdmin({
        name: 'Louvre',
        slug: 'louvre',
        email: 'admin@louvre.test',
      });
      const louvreRoom = await seedRoom({
        museumId: louvre.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Louvre Room 1',
      });

      const res = await request(app)
        .patch(`/admin/rooms/${louvreRoom.id}`)
        .set(authHeader(adwaToken))
        .send({ title: 'Hijacked' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS');
    });
  });

  describe('DELETE /admin/rooms/:id', () => {
    it('returns 409 ROOM_REFERENCED unless force=true, then cascades items and nulls the pointer', async () => {
      const { museum: adwa, token: adwaToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const target = await seedRoom({
        museumId: adwa.id,
        legacyId: 'room_2',
        storyOrder: 2,
        title: 'Target',
      });
      const referencing = await seedRoom({
        museumId: adwa.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Referencing',
        nextRoomId: target.id,
      });
      const item = await seedItem({ roomId: target.id, name: 'An item' });

      const blocked = await request(app)
        .delete(`/admin/rooms/${target.id}`)
        .set(authHeader(adwaToken));
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('ROOM_REFERENCED');

      const forced = await request(app)
        .delete(`/admin/rooms/${target.id}`)
        .query({ force: 'true' })
        .set(authHeader(adwaToken));
      expect(forced.status).toBe(204);

      const stillThere = await prisma.room.findUnique({ where: { id: target.id } });
      expect(stillThere).toBeNull();

      const updatedReferencing = await prisma.room.findUniqueOrThrow({
        where: { id: referencing.id },
      });
      expect(updatedReferencing.nextRoomId).toBeNull();

      const orphanedItem = await prisma.item.findUnique({ where: { id: item.id } });
      expect(orphanedItem).toBeNull();
    });

    it('treats force=false as "do not force", and rejects any other value', async () => {
      // Regression: force was parsed with z.coerce.boolean(), i.e.
      // Boolean('false') === true, so ?force=false silently force-deleted —
      // the opposite of what the caller asked for.
      const { museum: adwa, token: adwaToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const target = await seedRoom({
        museumId: adwa.id,
        legacyId: 'room_2',
        storyOrder: 2,
        title: 'Target',
      });
      const referencing = await seedRoom({
        museumId: adwa.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Referencing',
        nextRoomId: target.id,
      });

      for (const force of ['false', 'False', '0', 'no']) {
        const res = await request(app)
          .delete(`/admin/rooms/${target.id}`)
          .query({ force })
          .set(authHeader(adwaToken));

        // 'false' is honoured as a refusal; the rest are rejected outright
        // rather than guessed at, because guessing wrong destroys data.
        const expected = force === 'false' ? 409 : 400;
        expect(res.status, `force=${force}`).toBe(expected);
        expect(res.body.error.code).toBe(expected === 409 ? 'ROOM_REFERENCED' : 'VALIDATION_ERROR');
      }

      // Nothing was deleted and no pointer was nulled by any of the above.
      expect(await prisma.room.findUnique({ where: { id: target.id } })).not.toBeNull();
      const stillPointing = await prisma.room.findUniqueOrThrow({ where: { id: referencing.id } });
      expect(stillPointing.nextRoomId).toBe(target.id);
    });

    it('returns 403 for a cross-tenant delete and 404 for a missing room', async () => {
      const { token: adwaToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const { museum: louvre } = await seedMuseumWithAdmin({
        name: 'Louvre',
        slug: 'louvre',
        email: 'admin@louvre.test',
      });
      const louvreRoom = await seedRoom({
        museumId: louvre.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Louvre Room 1',
      });

      const crossTenant = await request(app)
        .delete(`/admin/rooms/${louvreRoom.id}`)
        .set(authHeader(adwaToken));
      expect(crossTenant.status).toBe(403);

      const missing = await request(app)
        .delete('/admin/rooms/00000000-0000-4000-8000-000000000000')
        .set(authHeader(adwaToken));
      expect(missing.status).toBe(404);
    });
  });
});
