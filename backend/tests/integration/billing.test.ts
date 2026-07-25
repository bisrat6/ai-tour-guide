/**
 * Billing: checkout, the shared entitlement path, and the reconciler.
 * Ported from dev3's checkout.test.ts onto this repo's test harness.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signAuthToken } from '../../src/lib/jwt.js';
import { prisma } from '../../src/lib/prisma.js';
import {
  emptyStats,
  expireAbandoned,
  runReconciler,
  UNVERIFIABLE_AGE_MS,
} from '../../src/modules/billing/reconcile.js';
import { applyPaidPayment } from '../../src/modules/billing/service.js';
import { fakePayment } from '../../src/providers/payments/fake.js';
import { resetBreakersForTests } from '../../src/providers/resilience.js';
import {
  ensureTestSchema,
  resetDatabase,
  seedAdmin,
  seedMuseum,
  seedPayment,
  seedTierPricing,
} from '../helpers/db.js';

const PASSWORD = 'correct-horse-battery-staple';

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

let emailCounter = 0;

/** A museum plus its admin and a signed token, which every case here needs. */
async function seedMuseumWithAdmin(opts: {
  slug: string;
  name?: string;
  tier?: 'BASIC' | 'PRO' | 'ENTERPRISE';
  subscriptionRenewsAt?: Date | null;
  subscriptionStatus?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
}) {
  const museum = await seedMuseum({
    name: opts.name ?? opts.slug,
    slug: opts.slug,
    tier: opts.tier ?? 'BASIC',
    ...(opts.subscriptionRenewsAt !== undefined
      ? { subscriptionRenewsAt: opts.subscriptionRenewsAt }
      : {}),
    ...(opts.subscriptionStatus ? { subscriptionStatus: opts.subscriptionStatus } : {}),
  });
  emailCounter += 1;
  const admin = await seedAdmin({
    email: `admin${emailCounter}@${opts.slug}.test`,
    password: PASSWORD,
    role: 'MUSEUM_ADMIN',
    museumId: museum.id,
  });
  const { token } = signAuthToken({ sub: admin.id, role: 'MUSEUM_ADMIN', museumId: museum.id });
  return { museum, admin, token };
}

async function seedSystemAdmin() {
  const admin = await seedAdmin({
    email: 'system@example.com',
    password: PASSWORD,
    role: 'SYSTEM_ADMIN',
  });
  const { token } = signAuthToken({ sub: admin.id, role: 'SYSTEM_ADMIN', museumId: null });
  return { admin, token };
}

describe('billing', () => {
  const app = createApp();

  beforeAll(() => {
    ensureTestSchema();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedTierPricing();
    fakePayment.reset();
    // The breaker is process-global, so a suite that trips it would otherwise
    // fail every later case.
    resetBreakersForTests();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /admin/billing/checkout', () => {
    it('returns a checkout URL and leaves a PENDING payment row', async () => {
      const { museum, token } = await seedMuseumWithAdmin({ slug: 'adwa', tier: 'BASIC' });

      const res = await request(app)
        .post('/admin/billing/checkout')
        .set(authHeader(token))
        .send({ tier: 'PRO' });

      expect(res.status).toBe(201);
      expect(res.body.checkoutUrl).toMatch(/^https:\/\/fake-chapa\.test\/checkout\//);
      expect(res.body.txRef).toMatch(/^adwa-adwa-PRO-/);
      expect(res.body.amountEtb).toBe('4500.00');

      const payment = await prisma.payment.findUnique({ where: { txRef: res.body.txRef } });
      expect(payment?.status).toBe('PENDING');
      expect(payment?.museumId).toBe(museum.id);
    });

    it('ignores a museumId in the body for a museum admin', async () => {
      const a = await seedMuseumWithAdmin({ slug: 'muse-a' });
      const b = await seedMuseumWithAdmin({ slug: 'muse-b' });

      const res = await request(app)
        .post('/admin/billing/checkout')
        .set(authHeader(a.token))
        .send({ tier: 'PRO', museumId: b.museum.id });

      expect(res.status).toBe(201);
      const payment = await prisma.payment.findUnique({ where: { txRef: res.body.txRef } });
      expect(payment?.museumId).toBe(a.museum.id);
    });

    it('lets a system admin check out for an explicit museum', async () => {
      const { museum } = await seedMuseumWithAdmin({ slug: 'sys' });
      const { token } = await seedSystemAdmin();

      const res = await request(app)
        .post('/admin/billing/checkout')
        .set(authHeader(token))
        .send({ tier: 'ENTERPRISE', museumId: museum.id });

      expect(res.status).toBe(201);
      const payment = await prisma.payment.findUnique({ where: { txRef: res.body.txRef } });
      expect(payment?.museumId).toBe(museum.id);
      expect(payment?.tier).toBe('ENTERPRISE');
    });

    it('rejects a duplicate checkout for a tier that is already active and not due', async () => {
      const { museum, token } = await seedMuseumWithAdmin({
        slug: 'dupe',
        tier: 'PRO',
        subscriptionRenewsAt: new Date(Date.now() + 30 * 86_400_000),
      });
      await seedPayment({ museumId: museum.id, txRef: 'adwa-dupe-PRO-existing', tier: 'PRO' });

      const res = await request(app)
        .post('/admin/billing/checkout')
        .set(authHeader(token))
        .send({ tier: 'PRO' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PAYMENT_ALREADY_PENDING');
    });

    it('rejects an unauthenticated caller and an unknown tier', async () => {
      const { token } = await seedMuseumWithAdmin({ slug: 'validate' });

      const anon = await request(app).post('/admin/billing/checkout').send({ tier: 'PRO' });
      expect(anon.status).toBe(401);

      const bad = await request(app)
        .post('/admin/billing/checkout')
        .set(authHeader(token))
        .send({ tier: 'PLATINUM' });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('applyPaidPayment', () => {
    it('upgrades the museum and writes one audit entry on success', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'up' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-up-PRO-1',
        initiatedByAdminId: admin.id,
      });
      fakePayment.setMode('success');

      expect(await applyPaidPayment(payment.txRef)).toEqual({ applied: true });

      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('PAID');

      const updated = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(updated?.tier).toBe('PRO');
      expect(updated?.subscriptionStatus).toBe('ACTIVE');
      expect(updated?.subscriptionRenewsAt).toBeTruthy();

      const audits = await prisma.adminAuditLog.findMany({
        where: { museumId: museum.id, entityType: 'Museum' },
      });
      expect(audits).toHaveLength(1);
      expect(audits[0]?.adminUserId).toBe(admin.id);
    });

    it.each([
      ['amount mismatch', 'amount_mismatch' as const],
      ['currency mismatch', 'currency_mismatch' as const],
      ['a failed verify', 'fail' as const],
    ])('marks the payment FAILED without upgrading on %s', async (_label, mode) => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: `mm-${mode}` });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: `adwa-${mode}-PRO-1`,
        initiatedByAdminId: admin.id,
      });
      fakePayment.setMode(mode);

      const result = await applyPaidPayment(payment.txRef);

      expect(result).toEqual({ applied: false, reason: 'verify_mismatch' });
      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('FAILED');
      const unchanged = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(unchanged?.tier).toBe('BASIC');
    });

    it('leaves the payment PENDING while the provider still reports pending', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'pd' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-pd-PRO-1',
        initiatedByAdminId: admin.id,
      });
      fakePayment.setMode('pending');

      expect(await applyPaidPayment(payment.txRef)).toEqual({
        applied: false,
        reason: 'still_pending',
      });

      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('PENDING');
      const unchanged = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(unchanged?.tier).toBe('BASIC');
    });

    it('applies only once when called twice', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'twice' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-twice-PRO-1',
        initiatedByAdminId: admin.id,
      });
      fakePayment.setMode('success');

      const first = await applyPaidPayment(payment.txRef);
      const second = await applyPaidPayment(payment.txRef);

      expect(first.applied).toBe(true);
      expect(second).toEqual({ applied: false, reason: 'already_processed' });

      const audits = await prisma.adminAuditLog.findMany({
        where: { museumId: museum.id, entityType: 'Museum' },
      });
      expect(audits).toHaveLength(1);
    });

    it('applies only once under concurrent calls', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'race' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-race-PRO-1',
        initiatedByAdminId: admin.id,
      });
      fakePayment.setMode('success');

      const results = await Promise.all([
        applyPaidPayment(payment.txRef),
        applyPaidPayment(payment.txRef),
      ]);

      expect(results.filter((r) => r.applied)).toHaveLength(1);
      const audits = await prisma.adminAuditLog.findMany({
        where: { museumId: museum.id, entityType: 'Museum' },
      });
      expect(audits).toHaveLength(1);
    });

    it('extends from the existing expiry rather than truncating it', async () => {
      const renewsAt = new Date(Date.now() + 10 * 86_400_000);
      const { museum, admin } = await seedMuseumWithAdmin({
        slug: 'extend',
        tier: 'PRO',
        subscriptionRenewsAt: renewsAt,
      });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-extend-PRO-1',
        initiatedByAdminId: admin.id,
      });
      fakePayment.setMode('success');

      await applyPaidPayment(payment.txRef);

      const updated = await prisma.museum.findUnique({ where: { id: museum.id } });
      // 10 remaining days plus a fresh 30-day period.
      expect(updated?.subscriptionRenewsAt?.getTime()).toBe(renewsAt.getTime() + 30 * 86_400_000);
    });

    it('reports payment_not_found for an unknown txRef', async () => {
      expect(await applyPaidPayment('adwa-does-not-exist')).toEqual({
        applied: false,
        reason: 'payment_not_found',
      });
    });

    it('leaves the payment PENDING when verify throws', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'to' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-to-PRO-1',
        initiatedByAdminId: admin.id,
      });
      fakePayment.setMode('timeout');

      await expect(applyPaidPayment(payment.txRef)).rejects.toThrow();

      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('PENDING');
    });
  });

  // PAID is the only terminal status. EXPIRED and FAILED mean "we stopped
  // waiting", so money that did arrive must still be recoverable from either.
  describe('recovering a wrongly retired payment', () => {
    it.each([['EXPIRED' as const], ['FAILED' as const]])(
      'applies a %s payment the provider reports as paid',
      async (status) => {
        const { museum, admin } = await seedMuseumWithAdmin({
          slug: `rec-${status.toLowerCase()}`,
        });
        const payment = await seedPayment({
          museumId: museum.id,
          txRef: `adwa-rec-${status}-PRO-1`,
          initiatedByAdminId: admin.id,
          status,
        });
        await prisma.payment.update({
          where: { id: payment.id },
          data: { failureReason: 'Abandoned: no successful payment within 24 hours' },
        });
        fakePayment.setMode('success');

        expect(await applyPaidPayment(payment.txRef)).toEqual({ applied: true });

        const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
        expect(fresh?.status).toBe('PAID');
        expect(fresh?.paidAt).not.toBeNull();
        // The stale reason would otherwise make a paid row still read as failed.
        expect(fresh?.failureReason).toBeNull();

        const updated = await prisma.museum.findUnique({ where: { id: museum.id } });
        expect(updated?.tier).toBe('PRO');
      },
    );

    it('never re-applies a PAID payment', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'paid-terminal', tier: 'PRO' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-paid-terminal-PRO-1',
        initiatedByAdminId: admin.id,
        status: 'PAID',
      });
      fakePayment.setMode('success');

      expect(await applyPaidPayment(payment.txRef)).toEqual({
        applied: false,
        reason: 'already_processed',
      });
      expect(fakePayment.getVerifyCallCount()).toBe(0);

      const unchanged = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(unchanged?.subscriptionRenewsAt).toBeNull();
    });

    it('still applies when an expiry sweep retires the payment mid-flight', async () => {
      // The race that used to strand paid transactions: the sweep wins, and the
      // apply then finds nothing left in PENDING to update.
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'sweeprace' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-sweeprace-PRO-1',
        initiatedByAdminId: admin.id,
        createdAt: new Date(Date.now() - 25 * 3_600_000),
      });
      fakePayment.setMode('success');

      const stats = emptyStats();
      const [applyResult] = await Promise.all([
        applyPaidPayment(payment.txRef),
        expireAbandoned(stats),
      ]);

      // Whichever order they interleave in, the payment ends PAID and upgraded.
      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('PAID');
      const updated = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(updated?.tier).toBe('PRO');
      // Exactly one of the two paths credited it.
      const credits = (applyResult.applied ? 1 : 0) + stats.applied;
      expect(credits).toBe(1);

      const audits = await prisma.adminAuditLog.findMany({
        where: { museumId: museum.id, entityType: 'Museum' },
      });
      expect(audits).toHaveLength(1);
    });
  });

  describe('amount verification', () => {
    it('rejects an amount that only matches once rounded', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'round' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-round-PRO-1',
        initiatedByAdminId: admin.id,
      });
      // Rounds to the expected 4500.00 at two decimal places, so a float
      // comparison would have accepted it.
      fakePayment.setVerifyAmount('4500.004');

      expect(await applyPaidPayment(payment.txRef)).toEqual({
        applied: false,
        reason: 'verify_mismatch',
      });
      const unchanged = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(unchanged?.tier).toBe('BASIC');
    });

    it('rejects a non-numeric amount instead of throwing', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'garbage' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-garbage-PRO-1',
        initiatedByAdminId: admin.id,
      });
      // parseFloat would read this as 4500 and upgrade the museum.
      fakePayment.setVerifyAmount('4500-not-a-number');

      expect(await applyPaidPayment(payment.txRef)).toEqual({
        applied: false,
        reason: 'verify_mismatch',
      });
      const unchanged = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(unchanged?.tier).toBe('BASIC');
    });
  });

  describe('GET /admin/billing/payments/:txRef', () => {
    it('does not verify a payment younger than the poll threshold', async () => {
      const { museum, admin, token } = await seedMuseumWithAdmin({ slug: 'young' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-young-PRO-1',
        initiatedByAdminId: admin.id,
      });

      const res = await request(app)
        .get(`/admin/billing/payments/${payment.txRef}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING');
      expect(fakePayment.getVerifyCallCount()).toBe(0);
    });

    it('verifies and applies a payment older than the poll threshold', async () => {
      const { museum, admin, token } = await seedMuseumWithAdmin({ slug: 'oldpoll' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-oldpoll-PRO-1',
        initiatedByAdminId: admin.id,
        createdAt: new Date(Date.now() - 6000),
      });
      fakePayment.setMode('success');

      const res = await request(app)
        .get(`/admin/billing/payments/${payment.txRef}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAID');
      expect(fakePayment.getVerifyCallCount()).toBeGreaterThanOrEqual(1);
      // The response must reflect the upgrade it just applied, not the tier
      // read before verification.
      expect(res.body.museumTier).toBe('PRO');

      const updated = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(updated?.tier).toBe('PRO');
    });

    it('refuses to show another museum a payment, and 404s an unknown txRef', async () => {
      const a = await seedMuseumWithAdmin({ slug: 'own' });
      const b = await seedMuseumWithAdmin({ slug: 'other' });
      const payment = await seedPayment({ museumId: b.museum.id, txRef: 'adwa-other-PRO-1' });

      const cross = await request(app)
        .get(`/admin/billing/payments/${payment.txRef}`)
        .set(authHeader(a.token));
      expect(cross.status).toBe(403);
      expect(cross.body.error.code).toBe('CROSS_TENANT_ACCESS');

      const missing = await request(app)
        .get('/admin/billing/payments/adwa-nope')
        .set(authHeader(a.token));
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('PAYMENT_NOT_FOUND');
    });
  });

  describe('GET /admin/billing/status and /plans', () => {
    it('reports the current tier, limits, and usage for the caller\u2019s own museum', async () => {
      const { museum, token } = await seedMuseumWithAdmin({ slug: 'status', tier: 'PRO' });

      const res = await request(app).get('/admin/billing/status').set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.museumId).toBe(museum.id);
      expect(res.body.tier).toBe('PRO');
      expect(res.body.limits.maxRooms).toBe(3);
      expect(res.body.usage).toEqual({ rooms: 0, adminUsers: 1 });
    });

    it('ignores a museumId a museum admin asks for', async () => {
      const a = await seedMuseumWithAdmin({ slug: 'mine' });
      const b = await seedMuseumWithAdmin({ slug: 'theirs', tier: 'ENTERPRISE' });

      const res = await request(app)
        .get('/admin/billing/status')
        .query({ museumId: b.museum.id })
        .set(authHeader(a.token));

      expect(res.status).toBe(200);
      expect(res.body.museumId).toBe(a.museum.id);
      expect(res.body.tier).toBe('BASIC');
    });

    it('lists the active plans with prices and limits', async () => {
      const { token } = await seedMuseumWithAdmin({ slug: 'plans' });

      const res = await request(app).get('/admin/billing/plans').set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.plans).toHaveLength(3);
      expect(res.body.plans[0]).toMatchObject({
        tier: 'BASIC',
        amountEtb: '1500.00',
        currency: 'ETB',
        periodDays: 30,
      });
    });
  });

  describe('POST /admin/billing/tier', () => {
    it('lets a system admin override the tier and records the reason', async () => {
      const { museum } = await seedMuseumWithAdmin({ slug: 'override' });
      const { admin, token } = await seedSystemAdmin();

      const res = await request(app).post('/admin/billing/tier').set(authHeader(token)).send({
        museumId: museum.id,
        tier: 'ENTERPRISE',
        reason: 'Sponsored partnership agreed offline.',
      });

      expect(res.status).toBe(200);
      const updated = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(updated?.tier).toBe('ENTERPRISE');

      const audit = await prisma.adminAuditLog.findFirst({
        where: { museumId: museum.id, entityType: 'Museum' },
      });
      expect(audit?.adminUserId).toBe(admin.id);
      expect(audit?.after).toMatchObject({ reason: 'Sponsored partnership agreed offline.' });
    });

    it('refuses a museum admin, and a reason that is too short', async () => {
      const { museum, token } = await seedMuseumWithAdmin({ slug: 'nope' });

      const forbidden = await request(app)
        .post('/admin/billing/tier')
        .set(authHeader(token))
        .send({ museumId: museum.id, tier: 'ENTERPRISE', reason: 'Because I said so.' });
      expect(forbidden.status).toBe(403);

      const { token: systemToken } = await seedSystemAdmin();
      const invalid = await request(app)
        .post('/admin/billing/tier')
        .set(authHeader(systemToken))
        .send({ museumId: museum.id, tier: 'ENTERPRISE', reason: 'short' });
      expect(invalid.status).toBe(400);
    });
  });

  describe('reconciler', () => {
    it('applies a payment the return page missed', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'mid' });
      await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-mid-PRO-1',
        initiatedByAdminId: admin.id,
        // Inside the 5 minute to 24 hour window.
        createdAt: new Date(Date.now() - 10 * 60_000),
      });
      fakePayment.setMode('success');

      const stats = await runReconciler();

      expect(stats.applied).toBe(1);
      const updated = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(updated?.tier).toBe('PRO');
    });

    it('expires a payment still pending after 24 hours', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'exp' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-exp-PRO-1',
        initiatedByAdminId: admin.id,
        createdAt: new Date(Date.now() - 25 * 3_600_000),
      });
      fakePayment.setMode('pending');

      const stats = emptyStats();
      await expireAbandoned(stats);

      expect(stats.expired).toBe(1);
      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('EXPIRED');
      const unchanged = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(unchanged?.tier).toBe('BASIC');
    });

    it('recovers a late success at the expiry cutoff', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'late' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-late-PRO-1',
        initiatedByAdminId: admin.id,
        createdAt: new Date(Date.now() - 25 * 3_600_000),
      });
      fakePayment.setMode('success');

      const stats = emptyStats();
      await expireAbandoned(stats);

      expect(stats.applied).toBe(1);
      expect(stats.expired).toBe(0);
      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('PAID');
      const updated = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(updated?.tier).toBe('PRO');
    });

    it('sweeps a lapsed subscription to PAST_DUE', async () => {
      const { museum } = await seedMuseumWithAdmin({
        slug: 'lapsed',
        tier: 'PRO',
        subscriptionRenewsAt: new Date(Date.now() - 60_000),
      });

      const stats = await runReconciler({ sweep: true });

      expect(stats.sweptToPastDue).toBe(1);
      const updated = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(updated?.subscriptionStatus).toBe('PAST_DUE');
    });

    it('changes nothing on a dry run', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'dry' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-dry-PRO-1',
        initiatedByAdminId: admin.id,
        createdAt: new Date(Date.now() - 10 * 60_000),
      });
      fakePayment.setMode('success');

      const stats = await runReconciler({ dryRun: true });

      expect(stats.applied).toBe(0);
      expect(fakePayment.getVerifyCallCount()).toBe(0);
      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('PENDING');
    });

    it('does not expire a stale payment when the verify call errors', async () => {
      // The vendor being unreachable says nothing about whether the visitor
      // paid, so expiring on it is how paid money used to be thrown away.
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'vendordown' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-vendordown-PRO-1',
        initiatedByAdminId: admin.id,
        createdAt: new Date(Date.now() - 25 * 3_600_000),
      });
      fakePayment.setMode('timeout');

      const stats = emptyStats();
      await expireAbandoned(stats);

      expect(stats.expired).toBe(0);
      expect(stats.verifyErrors).toBe(1);
      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('PENDING');
      expect(fresh?.failureReason).toBeNull();
    });

    it('recovers that same payment on a later run once the vendor answers', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'vendorback' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-vendorback-PRO-1',
        initiatedByAdminId: admin.id,
        createdAt: new Date(Date.now() - 25 * 3_600_000),
      });

      fakePayment.setMode('timeout');
      await expireAbandoned(emptyStats());
      resetBreakersForTests();

      fakePayment.setMode('success');
      const second = emptyStats();
      await expireAbandoned(second);

      expect(second.applied).toBe(1);
      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('PAID');
      const updated = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(updated?.tier).toBe('PRO');
    });

    it('expires an unverifiable payment once waiting longer is pointless', async () => {
      const { museum, admin } = await seedMuseumWithAdmin({ slug: 'unverifiable' });
      const payment = await seedPayment({
        museumId: museum.id,
        txRef: 'adwa-unverifiable-PRO-1',
        initiatedByAdminId: admin.id,
        createdAt: new Date(Date.now() - UNVERIFIABLE_AGE_MS - 3_600_000),
      });
      fakePayment.setMode('timeout');

      const stats = emptyStats();
      await expireAbandoned(stats);

      expect(stats.expired).toBe(1);
      const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(fresh?.status).toBe('EXPIRED');
      // The reason must not claim the visitor never paid — we never found out.
      expect(fresh?.failureReason).toMatch(/could not be verified/);
      const unchanged = await prisma.museum.findUnique({ where: { id: museum.id } });
      expect(unchanged?.tier).toBe('BASIC');
    });
  });
});
