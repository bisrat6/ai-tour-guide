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

describe('D1-6 items', () => {
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

  describe('GET /admin/items', () => {
    it("returns only the requested room's items, ordered by displayOrder, and blocks cross-tenant access", async () => {
      const { museum: adwa, token: adwaToken } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const { token: louvreToken } = await seedMuseumWithAdmin({
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
      await seedItem({ roomId: room.id, name: 'Second', displayOrder: 1 });
      await seedItem({ roomId: room.id, name: 'First', displayOrder: 0 });

      const res = await request(app)
        .get('/admin/items')
        .query({ roomId: room.id })
        .set(authHeader(adwaToken));
      expect(res.status).toBe(200);
      expect(res.body.data.map((i: { name: string }) => i.name)).toEqual(['First', 'Second']);

      const crossTenant = await request(app)
        .get('/admin/items')
        .query({ roomId: room.id })
        .set(authHeader(louvreToken));
      expect(crossTenant.status).toBe(403);
      expect(crossTenant.body.error.code).toBe('CROSS_TENANT_ACCESS');
    });

    it('returns 404 for a room that does not exist', async () => {
      const { token } = await seedMuseumWithAdmin({
        name: 'Adwa',
        slug: 'adwa',
        email: 'admin@adwa.test',
      });
      const res = await request(app)
        .get('/admin/items')
        .query({ roomId: '00000000-0000-4000-8000-000000000000' })
        .set(authHeader(token));
      expect(res.status).toBe(404);
    });
  });

  describe('POST /admin/items', () => {
    it('creates the item under the correct room and tenant, and purges the room chat cache', async () => {
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

      const res = await request(app).post('/admin/items').set(authHeader(adwaToken)).send({
        roomId: room.id,
        name: 'A new item',
        shortDescription: 'short',
        detailText: 'detail',
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ roomId: room.id, name: 'A new item', displayOrder: 0 });

      const remaining = await prisma.chatAnswer.count({ where: { roomId: room.id } });
      expect(remaining).toBe(0);
    });

    it("rejects creating an item in another museum's room with 403", async () => {
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

      const res = await request(app).post('/admin/items').set(authHeader(adwaToken)).send({
        roomId: louvreRoom.id,
        name: 'Sneaky item',
        shortDescription: 'short',
        detailText: 'detail',
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS');
    });
  });

  describe('PATCH /admin/items/:id', () => {
    it('updates an item and purges the room chat cache', async () => {
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
      const item = await seedItem({ roomId: room.id, name: 'Original' });
      await seedChatAnswer({ roomId: room.id, questionHash: 'hash-1' });

      const res = await request(app)
        .patch(`/admin/items/${item.id}`)
        .set(authHeader(adwaToken))
        .send({ name: 'Updated name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated name');

      const remaining = await prisma.chatAnswer.count({ where: { roomId: room.id } });
      expect(remaining).toBe(0);
    });

    it('cannot touch another museum\u2019s item by id', async () => {
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
      const louvreItem = await seedItem({ roomId: louvreRoom.id, name: 'Louvre item' });

      const res = await request(app)
        .patch(`/admin/items/${louvreItem.id}`)
        .set(authHeader(adwaToken))
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS');
    });
  });

  describe('DELETE /admin/items/:id', () => {
    it('deletes the item, nulls its ChatAnswer.itemId, and purges the room cache', async () => {
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
      const item = await seedItem({ roomId: room.id, name: 'Doomed item' });
      await seedChatAnswer({
        roomId: room.id,
        itemId: item.id,
        questionHash: 'hash-item',
      });

      const res = await request(app).delete(`/admin/items/${item.id}`).set(authHeader(adwaToken));
      expect(res.status).toBe(204);

      const remainingAnswers = await prisma.chatAnswer.count({ where: { roomId: room.id } });
      expect(remainingAnswers).toBe(0);

      const gone = await prisma.item.findUnique({ where: { id: item.id } });
      expect(gone).toBeNull();
    });

    it('returns 403 for a cross-tenant delete and 404 for a missing item', async () => {
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
      const louvreItem = await seedItem({ roomId: louvreRoom.id, name: 'Louvre item' });

      const crossTenant = await request(app)
        .delete(`/admin/items/${louvreItem.id}`)
        .set(authHeader(adwaToken));
      expect(crossTenant.status).toBe(403);

      const missing = await request(app)
        .delete('/admin/items/00000000-0000-4000-8000-000000000000')
        .set(authHeader(adwaToken));
      expect(missing.status).toBe(404);
    });
  });

  describe('PATCH /admin/rooms/:id/items/order', () => {
    it('reorders items atomically', async () => {
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
      const first = await seedItem({ roomId: room.id, name: 'First', displayOrder: 0 });
      const second = await seedItem({ roomId: room.id, name: 'Second', displayOrder: 1 });
      const third = await seedItem({ roomId: room.id, name: 'Third', displayOrder: 2 });

      const res = await request(app)
        .patch(`/admin/rooms/${room.id}/items/order`)
        .set(authHeader(adwaToken))
        .send({ itemIds: [third.id, first.id, second.id] });

      expect(res.status).toBe(200);

      const reordered = await prisma.item.findMany({
        where: { roomId: room.id },
        orderBy: { displayOrder: 'asc' },
      });
      expect(reordered.map((i) => i.id)).toEqual([third.id, first.id, second.id]);
      expect(reordered.map((i) => i.displayOrder)).toEqual([0, 1, 2]);
    });

    it('rejects a set of itemIds that does not exactly match the room\u2019s items', async () => {
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
      const first = await seedItem({ roomId: room.id, name: 'First', displayOrder: 0 });
      await seedItem({ roomId: room.id, name: 'Second', displayOrder: 1 });

      const missingOne = await request(app)
        .patch(`/admin/rooms/${room.id}/items/order`)
        .set(authHeader(adwaToken))
        .send({ itemIds: [first.id] });
      expect(missingOne.status).toBe(400);
      expect(missingOne.body.error.code).toBe('VALIDATION_ERROR');

      const foreignId = await request(app)
        .patch(`/admin/rooms/${room.id}/items/order`)
        .set(authHeader(adwaToken))
        .send({ itemIds: [first.id, '00000000-0000-4000-8000-000000000000'] });
      expect(foreignId.status).toBe(400);
    });

    it('blocks a cross-tenant reorder with 403', async () => {
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
      const louvreItem = await seedItem({ roomId: louvreRoom.id, name: 'Louvre item' });

      const res = await request(app)
        .patch(`/admin/rooms/${louvreRoom.id}/items/order`)
        .set(authHeader(adwaToken))
        .send({ itemIds: [louvreItem.id] });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CROSS_TENANT_ACCESS');
    });
  });
});
