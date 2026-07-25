import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ssrfGuard } from '../../src/lib/ssrfGuard.js';
import { api, bypassRateLimit, fakeTicket, resetFakes } from '../helpers/app.js';
import { prisma, resetDb, seedMuseum } from '../helpers/db.js';

describe('POST /tickets/validate', () => {
  beforeEach(async () => {
    await resetDb();
    resetFakes();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('museum with no URL returns ticketRequired:false and makes zero outbound calls', async () => {
    const museum = await seedMuseum({
      slug: 'open-gate',
      name: 'Open Gate',
      tier: 'BASIC',
      roomCount: 1,
      ticketValidationUrl: null,
    });

    const res = await api()
      .post('/tickets/validate')
      .set(bypassRateLimit)
      .send({ museumId: museum.id, ticketCode: 'ANYTHING' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true, ticketRequired: false });
    expect(fakeTicket.getCallCount()).toBe(0);
  });

  it('valid code against a configured museum returns valid:true', async () => {
    const museum = await seedMuseum({
      slug: 'gated',
      name: 'Gated',
      tier: 'BASIC',
      roomCount: 1,
      ticketValidationUrl: 'https://tickets.example.com/validate',
    });
    fakeTicket.setMode('valid');

    const res = await api()
      .post('/tickets/validate')
      .set(bypassRateLimit)
      .send({ museumId: museum.id, ticketCode: 'DEMO-1234' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true, ticketRequired: true });
    expect(fakeTicket.getCallCount()).toBe(1);
  });

  it('invalid code returns valid:false', async () => {
    const museum = await seedMuseum({
      slug: 'gated-bad',
      name: 'Gated Bad',
      tier: 'BASIC',
      roomCount: 1,
      ticketValidationUrl: 'https://tickets.example.com/validate',
    });
    fakeTicket.setMode('invalid');

    const res = await api()
      .post('/tickets/validate')
      .set(bypassRateLimit)
      .send({ museumId: museum.id, ticketCode: 'NOPE' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: false, ticketRequired: true });
  });

  it('vendor timeout produces 502, never valid:true', async () => {
    const museum = await seedMuseum({
      slug: 'gated-timeout',
      name: 'Gated Timeout',
      tier: 'BASIC',
      roomCount: 1,
      ticketValidationUrl: 'https://tickets.example.com/validate',
    });
    fakeTicket.setMode('timeout');

    const res = await api()
      .post('/tickets/validate')
      .set(bypassRateLimit)
      .send({ museumId: museum.id, ticketCode: 'TIMEOUT-ALWAYS' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILURE');
    expect(res.body.valid).toBeUndefined();
  });

  it('vendor 500 produces 502', async () => {
    const museum = await seedMuseum({
      slug: 'gated-err',
      name: 'Gated Err',
      tier: 'BASIC',
      roomCount: 1,
      ticketValidationUrl: 'https://tickets.example.com/validate',
    });
    fakeTicket.setMode('error');

    const res = await api()
      .post('/tickets/validate')
      .set(bypassRateLimit)
      .send({ museumId: museum.id, ticketCode: 'X' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILURE');
  });

  it('suspended museum produces 404', async () => {
    const museum = await seedMuseum({
      slug: 'suspended',
      name: 'Suspended',
      tier: 'BASIC',
      roomCount: 1,
      status: 'SUSPENDED',
    });

    const res = await api()
      .post('/tickets/validate')
      .set(bypassRateLimit)
      .send({ museumId: museum.id, ticketCode: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('unknown museum produces 404', async () => {
    const res = await api()
      .post('/tickets/validate')
      .set(bypassRateLimit)
      .send({ museumId: '00000000-0000-4000-8000-000000000000', ticketCode: 'X' });

    expect(res.status).toBe(404);
  });

  it('rate limit produces 429 after 10 requests from the same IP', async () => {
    const museum = await seedMuseum({
      slug: 'rate',
      name: 'Rate',
      tier: 'BASIC',
      roomCount: 1,
    });

    // Intentionally omit bypass header
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await api()
        .post('/tickets/validate')
        .send({ museumId: museum.id, ticketCode: `code-${i}` });
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});

describe('ssrfGuard', () => {
  const previous = process.env['OUTBOUND_HTTP_ALLOW_PRIVATE_IPS'];

  beforeEach(() => {
    process.env['OUTBOUND_HTTP_ALLOW_PRIVATE_IPS'] = 'false';
  });

  afterAll(() => {
    if (previous === undefined) delete process.env['OUTBOUND_HTTP_ALLOW_PRIVATE_IPS'];
    else process.env['OUTBOUND_HTTP_ALLOW_PRIVATE_IPS'] = previous;
  });

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:5432/',
    'http://127.0.0.1/',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'file:///etc/passwd',
  ])('rejects %s', async (url) => {
    await expect(ssrfGuard(url)).rejects.toMatchObject({ code: 'TICKET_URL_INVALID' });
  });

  it('allows a public https URL', async () => {
    await expect(ssrfGuard('https://api.chapa.co/v1')).resolves.toBeUndefined();
  });
});
