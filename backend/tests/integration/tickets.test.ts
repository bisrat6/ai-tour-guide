/**
 * Ticket validation and the SSRF guard that protects outbound vendor calls.
 * Ported from dev3's tickets.test.ts onto this repo's test harness.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { ssrfGuard } from '../../src/lib/ssrfGuard.js';
import { resetBreakersForTests } from '../../src/providers/resilience.js';
import { fakeTicket } from '../../src/providers/ticketing/fake.js';
import { museumScopeFor } from '../../src/shared/museumScope.js';
import { ensureTestSchema, resetDatabase, seedMuseum, seedRoom } from '../helpers/db.js';

const VENDOR_URL = 'https://tickets.example.com/validate';

describe('POST /tickets/validate', () => {
  const app = createApp();

  beforeAll(() => {
    ensureTestSchema();
  });

  beforeEach(async () => {
    await resetDatabase();
    fakeTicket.reset();
    resetBreakersForTests();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('makes no outbound call when the museum has no ticket gate', async () => {
    const museum = await seedMuseum({
      name: 'Open Gate',
      slug: 'open-gate',
      ticketValidationUrl: null,
    });

    const res = await request(app)
      .post('/tickets/validate')
      .send({ museumId: museum.id, ticketCode: 'ANYTHING' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      valid: true,
      ticketRequired: false,
      museumScope: museumScopeFor(museum.id),
    });
    expect(fakeTicket.getCallCount()).toBe(0);
  });

  it('returns the vendor verdict for a gated museum', async () => {
    const museum = await seedMuseum({
      name: 'Gated',
      slug: 'gated',
      ticketValidationUrl: VENDOR_URL,
    });
    fakeTicket.setMode('valid');

    const res = await request(app)
      .post('/tickets/validate')
      .send({ museumId: museum.id, ticketCode: 'DEMO-1234' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      valid: true,
      ticketRequired: true,
      museumScope: museumScopeFor(museum.id),
    });
    expect(fakeTicket.getCallCount()).toBe(1);
  });

  it('passes an invalid code through as valid:false', async () => {
    const museum = await seedMuseum({
      name: 'Gated Bad',
      slug: 'gated-bad',
      ticketValidationUrl: VENDOR_URL,
    });
    fakeTicket.setMode('invalid');

    const res = await request(app)
      .post('/tickets/validate')
      .send({ museumId: museum.id, ticketCode: 'NOPE' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      valid: false,
      ticketRequired: true,
      museumScope: museumScopeFor(museum.id),
    });
  });

  // The important property: a broken vendor must never mean free admission.
  it.each([
    ['a vendor timeout', 'timeout' as const],
    ['a vendor 500', 'error' as const],
  ])('fails closed with 502 on %s', async (_label, mode) => {
    const museum = await seedMuseum({
      name: `Gated ${mode}`,
      slug: `gated-${mode}`,
      ticketValidationUrl: VENDOR_URL,
    });
    fakeTicket.setMode(mode);

    const res = await request(app)
      .post('/tickets/validate')
      .send({ museumId: museum.id, ticketCode: 'X' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILURE');
    expect(res.body.valid).toBeUndefined();
  });

  it('treats a suspended museum as missing', async () => {
    const museum = await seedMuseum({
      name: 'Suspended',
      slug: 'suspended',
      status: 'SUSPENDED',
      ticketValidationUrl: VENDOR_URL,
    });

    const res = await request(app)
      .post('/tickets/validate')
      .send({ museumId: museum.id, ticketCode: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('404s an unknown museum and 400s a malformed body', async () => {
    const missing = await request(app)
      .post('/tickets/validate')
      .send({ museumId: '00000000-0000-4000-8000-000000000000', ticketCode: 'X' });
    expect(missing.status).toBe(404);

    const malformed = await request(app).post('/tickets/validate').send({ ticketCode: 'X' });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
  });

  // The visitor app never holds a museum id — a QR code carries a room id, and
  // GET /waypoint/:id withholds the museum on purpose. These cover that path.
  describe('identified by waypointId', () => {
    it('resolves the museum from the scanned room', async () => {
      const museum = await seedMuseum({
        name: 'Gated By Room',
        slug: 'gated-by-room',
        ticketValidationUrl: VENDOR_URL,
      });
      const room = await seedRoom({
        museumId: museum.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'The Gathering Storm',
      });
      fakeTicket.setMode('valid');

      const res = await request(app)
        .post('/tickets/validate')
        .send({ waypointId: room.id, ticketCode: 'DEMO-1234' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        valid: true,
        ticketRequired: true,
        museumScope: museumScopeFor(museum.id),
      });
    });

    it('returns the same scope as the waypoint, for every room of a museum', async () => {
      const museum = await seedMuseum({
        name: 'Two Rooms',
        slug: 'two-rooms',
        ticketValidationUrl: null,
      });
      const first = await seedRoom({
        museumId: museum.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'First',
      });
      const second = await seedRoom({
        museumId: museum.id,
        legacyId: 'room_2',
        storyOrder: 2,
        title: 'Second',
      });

      const waypoint = await request(app).get(`/waypoint/${first.id}`);
      const ticket = await request(app)
        .post('/tickets/validate')
        .send({ waypointId: second.id, ticketCode: 'X' });

      // One grant has to cover the whole museum, so a scope read off any room
      // must match the one every other surface reports.
      expect(waypoint.body.museumScope).toBe(ticket.body.museumScope);
      // And it must not be the museum's actual id.
      expect(ticket.body.museumScope).not.toBe(museum.id);
    });

    it('gives different museums different scopes', async () => {
      const [a, b] = await Promise.all([
        seedMuseum({ name: 'A', slug: 'scope-a', ticketValidationUrl: null }),
        seedMuseum({ name: 'B', slug: 'scope-b', ticketValidationUrl: null }),
      ]);

      const [resA, resB] = await Promise.all([
        request(app).post('/tickets/validate').send({ museumId: a.id, ticketCode: 'X' }),
        request(app).post('/tickets/validate').send({ museumId: b.id, ticketCode: 'X' }),
      ]);

      expect(resA.body.museumScope).not.toBe(resB.body.museumScope);
    });

    it('404s an unknown room', async () => {
      const res = await request(app)
        .post('/tickets/validate')
        .send({ waypointId: '00000000-0000-4000-8000-000000000000', ticketCode: 'X' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('400s when both or neither identifier is supplied', async () => {
      const museum = await seedMuseum({
        name: 'Ambiguous',
        slug: 'ambiguous',
        ticketValidationUrl: null,
      });
      const room = await seedRoom({
        museumId: museum.id,
        legacyId: 'room_1',
        storyOrder: 1,
        title: 'Only Room',
      });

      const both = await request(app)
        .post('/tickets/validate')
        .send({ museumId: museum.id, waypointId: room.id, ticketCode: 'X' });
      expect(both.status).toBe(400);
      expect(both.body.error.code).toBe('VALIDATION_ERROR');

      const neither = await request(app).post('/tickets/validate').send({ ticketCode: 'X' });
      expect(neither.status).toBe(400);
      expect(neither.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('ssrfGuard', () => {
  it.each([
    ['the cloud metadata endpoint', 'http://169.254.169.254/latest/meta-data/'],
    ['localhost by name', 'http://localhost:5432/'],
    ['loopback', 'http://127.0.0.1/'],
    ['a private 10/8 address', 'http://10.0.0.5/'],
    ['a private 192.168/16 address', 'http://192.168.1.1/'],
    ['a private 172.16/12 address', 'http://172.16.0.1/'],
    ['an IPv6 loopback', 'http://[::1]/'],
    ['a non-HTTP scheme', 'file:///etc/passwd'],
    ['a malformed URL', 'not-a-url'],
  ])('rejects %s', async (_label, url) => {
    await expect(ssrfGuard(url)).rejects.toMatchObject({ code: 'TICKET_URL_INVALID' });
  });

  it('allows a public address', async () => {
    // A literal rather than a hostname, so the test does not depend on DNS.
    await expect(ssrfGuard('https://93.184.216.34/validate')).resolves.toBeUndefined();
  });

  it('still allows a public 172 address outside the private range', async () => {
    await expect(ssrfGuard('https://172.32.0.1/validate')).resolves.toBeUndefined();
  });
});
