/**
 * D1-8 hardening: the §7.1 envelope must come out of errorHandler.ts even
 * for failures that never reach a route handler — body-parser rejections
 * and unmatched routes. These paths aren't exercised by any module's own
 * tests, so they get a dedicated file.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetLoginAttemptsForTests } from '../../src/modules/auth/loginAttempts.js';
import { ensureTestSchema, resetDatabase } from '../helpers/db.js';
import { authHeader, seedTenantAdmin } from '../helpers/scenario.js';

describe('D1-8 error envelope consistency', () => {
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

  function expectEnvelope(body: unknown, code: string) {
    expect(body).toMatchObject({ error: { code } });
    const error = (body as { error: { requestId?: unknown; message?: unknown } }).error;
    expect(typeof error.requestId).toBe('string');
    expect(typeof error.message).toBe('string');
  }

  it('unmatched route, unauthenticated -> 401 (each router\u2019s requireAuth runs before the 404 catch-all), standard envelope', async () => {
    const res = await request(app).get('/admin/this-route-does-not-exist');
    expect(res.status).toBe(401);
    expectEnvelope(res.body, 'UNAUTHENTICATED');
  });

  it('unmatched route, authenticated -> falls through every router to the 404 catch-all, standard envelope', async () => {
    const tenant = await seedTenantAdmin({ name: 'Adwa', slug: 'adwa', email: 'admin@adwa.test' });
    const res = await request(app)
      .get('/admin/this-route-does-not-exist')
      .set(authHeader(tenant.token));
    expect(res.status).toBe(404);
    expectEnvelope(res.body, 'NOT_FOUND');
  });

  it('malformed JSON body -> 400 VALIDATION_ERROR, not a 500', async () => {
    const res = await request(app)
      .post('/admin/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "broken", "password": }');
    expect(res.status).toBe(400);
    expectEnvelope(res.body, 'VALIDATION_ERROR');
  });

  it('oversized body -> 413, not a 500', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send({ email: 'admin@adwa.test', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expectEnvelope(res.body, 'VALIDATION_ERROR');
  });

  it('missing Authorization on a protected route -> 401 UNAUTHENTICATED, standard envelope', async () => {
    const res = await request(app).get('/admin/rooms');
    expect(res.status).toBe(401);
    expectEnvelope(res.body, 'UNAUTHENTICATED');
  });
});
