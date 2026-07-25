import request from 'supertest';
import { app } from '../../src/app';
import { disconnectDb, resetDb } from '../helpers/db';
import { seedAdwaFixture } from '../helpers/fixtures';

describe('Visitor API — waypoints (§9)', () => {
  afterAll(async () => {
    await disconnectDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  describe('GET /waypoint/:id', () => {
    it('returns the room with its items for an active museum, without museumId or narrationScript', async () => {
      const { room1, treatyItem, mapItem, room2 } = await seedAdwaFixture();

      const res = await request(app).get(`/waypoint/${room1.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: room1.id,
        storyOrder: 1,
        title: 'The Gathering Storm',
        nextRoomId: room2.id,
      });
      expect(res.body.museumId).toBeUndefined();
      expect(res.body.narrationScript).toBeUndefined();
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items.map((i: { id: string }) => i.id).sort()).toEqual(
        [treatyItem.id, mapItem.id].sort()
      );
    });

    it('returns 404 for a room that does not exist', async () => {
      await seedAdwaFixture();
      const res = await request(app).get('/waypoint/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.requestId).toBeDefined();
    });

    it('returns 404 (not a special status) for a room belonging to a suspended museum', async () => {
      const { suspendedRoom } = await seedAdwaFixture();
      const res = await request(app).get(`/waypoint/${suspendedRoom.id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /museums/:slug', () => {
    it('returns the museum summary with ticketRequired derived from ticketValidationUrl', async () => {
      const { museum } = await seedAdwaFixture();
      const res = await request(app).get(`/museums/${museum.slug}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: museum.id, name: museum.name, slug: museum.slug, ticketRequired: false });
    });

    it('returns 404 for a suspended museum', async () => {
      const { suspendedMuseum } = await seedAdwaFixture();
      const res = await request(app).get(`/museums/${suspendedMuseum.slug}`);
      expect(res.status).toBe(404);
    });

    it('returns 404 for an unknown slug', async () => {
      const res = await request(app).get('/museums/does-not-exist');
      expect(res.status).toBe(404);
    });
  });
});
