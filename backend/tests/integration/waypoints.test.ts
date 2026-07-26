/**
 * Visitor waypoint and museum lookup (dev2 §9).
 * Ported from dev2's waypoints.test.ts onto this repo's test harness.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { ensureTestSchema, resetDatabase } from '../helpers/db.js';
import { seedVisitorFixture } from '../helpers/visitorFixture.js';

describe('visitor waypoints', () => {
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

  describe('GET /waypoint/:id', () => {
    it('returns the room and its items without leaking museumId or the narration script', async () => {
      const { room1, room2, treatyItem, mapItem } = await seedVisitorFixture();

      const res = await request(app).get(`/waypoint/${room1.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: room1.id,
        storyOrder: 1,
        title: 'The Gathering Storm',
        nextRoomId: room2.id,
      });
      // The script is for TTS, not for the client, and museumId is platform state.
      expect(res.body.museumId).toBeUndefined();
      expect(res.body.narrationScript).toBeUndefined();
      // museumScope stands in for it: enough for the client to group rooms by
      // museum for its ticket cache, without being the id itself.
      expect(res.body.museumScope).toEqual(expect.any(String));
      expect(res.body.museumScope).not.toBe(room1.museumId);
      expect(res.body.items).toHaveLength(2);
      // displayOrder decides the sequence, so this is an assertion about order.
      expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([
        treatyItem.id,
        mapItem.id,
      ]);
    });

    it('404s an unknown room, with the standard error envelope', async () => {
      await seedVisitorFixture();

      const res = await request(app).get('/waypoint/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.requestId).toBeDefined();
    });

    it('404s a room in a suspended museum rather than revealing the suspension', async () => {
      const { suspendedRoom } = await seedVisitorFixture();

      const res = await request(app).get(`/waypoint/${suspendedRoom.id}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /museums/:slug', () => {
    it('derives ticketRequired from whether a validation URL is configured', async () => {
      const { museum } = await seedVisitorFixture();

      const res = await request(app).get(`/museums/${museum.slug}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: museum.id,
        name: museum.name,
        slug: museum.slug,
        ticketRequired: false,
      });
    });

    it('reports ticketRequired once a museum has a validation URL', async () => {
      const { museum } = await seedVisitorFixture();
      await prisma.museum.update({
        where: { id: museum.id },
        data: { ticketValidationUrl: 'https://tickets.example.test/validate' },
      });

      const res = await request(app).get(`/museums/${museum.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.ticketRequired).toBe(true);
    });

    it('404s a suspended museum and an unknown slug alike', async () => {
      const { suspendedMuseum } = await seedVisitorFixture();

      expect((await request(app).get(`/museums/${suspendedMuseum.slug}`)).status).toBe(404);
      expect((await request(app).get('/museums/does-not-exist')).status).toBe(404);
    });
  });
});
