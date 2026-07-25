import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { applyPaidPayment } from '../../src/modules/billing/service.js';
import { expireAbandoned, emptyStats, runReconciler } from '../../src/modules/billing/reconcile.js';
import { api, fakePayment, resetFakes } from '../helpers/app.js';
import { authHeader, mintToken } from '../helpers/auth.js';
import { prisma, resetDb, seedMuseum, seedSystemAdmin } from '../helpers/db.js';

async function createPendingPayment(opts: {
  museumId: string;
  adminId: string;
  tier?: 'BASIC' | 'PRO' | 'ENTERPRISE';
  amountEtb?: number;
  createdAt?: Date;
  txRef?: string;
}) {
  const tier = opts.tier ?? 'PRO';
  const amount = opts.amountEtb ?? 4500;
  return prisma.payment.create({
    data: {
      museumId: opts.museumId,
      tier,
      amountEtb: amount,
      currency: 'ETB',
      txRef: opts.txRef ?? `adwa-test-${tier}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'PENDING',
      initiatedByAdminId: opts.adminId,
      createdAt: opts.createdAt ?? new Date(),
    },
  });
}

describe('billing checkout + applyPaidPayment', () => {
  beforeEach(async () => {
    await resetDb();
    resetFakes();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('checkout returns a fake checkout URL and a PENDING payment row', async () => {
    const museum = await seedMuseum({
      slug: 'adwa',
      name: 'Adwa',
      tier: 'BASIC',
      roomCount: 1,
    });
    const token = mintToken({ id: museum.adminId, role: 'MUSEUM_ADMIN', museumId: museum.id });

    const res = await api()
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

  it('museum A admin cannot check out for museum B — scopes to own museum', async () => {
    const a = await seedMuseum({ slug: 'muse-a', name: 'A', tier: 'BASIC', roomCount: 1 });
    const b = await seedMuseum({ slug: 'muse-b', name: 'B', tier: 'BASIC', roomCount: 1 });
    const token = mintToken({ id: a.adminId, role: 'MUSEUM_ADMIN', museumId: a.id });

    const res = await api()
      .post('/admin/billing/checkout')
      .set(authHeader(token))
      .send({ tier: 'PRO', museumId: b.id });

    // Implementation ignores body museumId for museum admins (secure by scoping)
    expect(res.status).toBe(201);
    const payment = await prisma.payment.findUnique({ where: { txRef: res.body.txRef } });
    expect(payment?.museumId).toBe(a.id);
    expect(payment?.museumId).not.toBe(b.id);
  });

  it('1. verify success upgrades museum and writes audit', async () => {
    const museum = await seedMuseum({ slug: 'up', name: 'Up', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      tier: 'PRO',
      amountEtb: 4500,
    });
    fakePayment.setMode('success');
    fakePayment.setVerifyAmount('4500.00');

    const result = await applyPaidPayment(payment.txRef);

    expect(result).toEqual({ applied: true });
    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(fresh?.status).toBe('PAID');
    const mus = await prisma.museum.findUnique({ where: { id: museum.id } });
    expect(mus?.tier).toBe('PRO');
    expect(mus?.subscriptionStatus).toBe('ACTIVE');
    expect(mus?.subscriptionRenewsAt).toBeTruthy();

    const audits = await prisma.adminAuditLog.findMany({
      where: { museumId: museum.id, entityType: 'Museum' },
    });
    expect(audits.length).toBe(1);
    expect(audits[0]?.adminUserId).toBe(museum.adminId);
  });

  it('2. amount mismatch marks FAILED and does not upgrade', async () => {
    const museum = await seedMuseum({ slug: 'mm', name: 'MM', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
    });
    fakePayment.setMode('amount_mismatch');

    const result = await applyPaidPayment(payment.txRef);

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('verify_mismatch');
    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(fresh?.status).toBe('FAILED');
    const mus = await prisma.museum.findUnique({ where: { id: museum.id } });
    expect(mus?.tier).toBe('BASIC');
  });

  it('3. currency mismatch marks FAILED and does not upgrade', async () => {
    const museum = await seedMuseum({ slug: 'cm', name: 'CM', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
    });
    fakePayment.setMode('currency_mismatch');
    fakePayment.setVerifyAmount('4500.00');

    const result = await applyPaidPayment(payment.txRef);

    expect(result.reason).toBe('verify_mismatch');
    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(fresh?.status).toBe('FAILED');
    const mus = await prisma.museum.findUnique({ where: { id: museum.id } });
    expect(mus?.tier).toBe('BASIC');
  });

  it('4. verify failed marks FAILED and does not upgrade', async () => {
    const museum = await seedMuseum({ slug: 'fl', name: 'FL', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
    });
    fakePayment.setMode('fail');
    fakePayment.setVerifyAmount('4500.00');

    const result = await applyPaidPayment(payment.txRef);

    expect(result.reason).toBe('verify_mismatch');
    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(fresh?.status).toBe('FAILED');
  });

  it('5. verify pending leaves payment PENDING', async () => {
    const museum = await seedMuseum({ slug: 'pd', name: 'PD', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
    });
    fakePayment.setMode('pending');
    fakePayment.setVerifyAmount('4500.00');

    const result = await applyPaidPayment(payment.txRef);

    expect(result).toEqual({ applied: false, reason: 'still_pending' });
    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(fresh?.status).toBe('PENDING');
    const mus = await prisma.museum.findUnique({ where: { id: museum.id } });
    expect(mus?.tier).toBe('BASIC');
  });

  it('6. applyPaidPayment twice → exactly one upgrade and one audit', async () => {
    const museum = await seedMuseum({ slug: 'twice', name: 'Twice', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
    });
    fakePayment.setMode('success');
    fakePayment.setVerifyAmount('4500.00');

    const first = await applyPaidPayment(payment.txRef);
    const second = await applyPaidPayment(payment.txRef);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.reason).toBe('already_processed');

    const audits = await prisma.adminAuditLog.findMany({
      where: { museumId: museum.id, entityType: 'Museum' },
    });
    expect(audits).toHaveLength(1);
  });

  it('7. concurrent apply → exactly one upgrade', async () => {
    const museum = await seedMuseum({ slug: 'race', name: 'Race', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
    });
    fakePayment.setMode('success');
    fakePayment.setVerifyAmount('4500.00');

    const [a, b] = await Promise.all([
      applyPaidPayment(payment.txRef),
      applyPaidPayment(payment.txRef),
    ]);

    const applied = [a, b].filter((r) => r.applied);
    expect(applied).toHaveLength(1);

    const audits = await prisma.adminAuditLog.findMany({
      where: { museumId: museum.id, entityType: 'Museum' },
    });
    expect(audits).toHaveLength(1);
  });

  it('8. unknown txRef returns payment_not_found', async () => {
    const result = await applyPaidPayment('adwa-does-not-exist');
    expect(result).toEqual({ applied: false, reason: 'payment_not_found' });
  });

  it('9. verify timeout leaves payment PENDING', async () => {
    const museum = await seedMuseum({ slug: 'to', name: 'TO', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
    });
    fakePayment.setMode('timeout');

    await expect(applyPaidPayment(payment.txRef)).rejects.toThrow();

    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(fresh?.status).toBe('PENDING');
  });

  it('10. poll on a payment younger than 5s does not verify', async () => {
    const museum = await seedMuseum({ slug: 'young', name: 'Young', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
      createdAt: new Date(), // now
    });
    const token = mintToken({ id: museum.adminId, role: 'MUSEUM_ADMIN', museumId: museum.id });
    fakePayment.reset();

    const res = await api()
      .get(`/admin/billing/payments/${payment.txRef}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PENDING');
    expect(fakePayment.getVerifyCallCount()).toBe(0);
  });

  it('10b. poll on a payment older than 5s verifies and applies', async () => {
    const museum = await seedMuseum({ slug: 'oldpoll', name: 'OldPoll', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
      createdAt: new Date(Date.now() - 6_000),
    });
    const token = mintToken({ id: museum.adminId, role: 'MUSEUM_ADMIN', museumId: museum.id });
    fakePayment.setMode('success');
    fakePayment.setVerifyAmount('4500.00');

    const res = await api()
      .get(`/admin/billing/payments/${payment.txRef}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAID');
    expect(fakePayment.getVerifyCallCount()).toBeGreaterThanOrEqual(1);

    const mus = await prisma.museum.findUnique({ where: { id: museum.id } });
    expect(mus?.tier).toBe('PRO');
  });

  it('11. reconciler expires PENDING older than 24h with nothing at Chapa', async () => {
    const museum = await seedMuseum({ slug: 'exp', name: 'Exp', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
      createdAt: new Date(Date.now() - 25 * 3_600_000),
    });
    fakePayment.setMode('pending');

    const stats = emptyStats();
    await expireAbandoned(stats);

    expect(stats.expired).toBe(1);
    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(fresh?.status).toBe('EXPIRED');
    const mus = await prisma.museum.findUnique({ where: { id: museum.id } });
    expect(mus?.tier).toBe('BASIC');
  });

  it('12. reconciler recovers a late success at the expiry cutoff', async () => {
    const museum = await seedMuseum({ slug: 'late', name: 'Late', tier: 'BASIC', roomCount: 1 });
    const payment = await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
      createdAt: new Date(Date.now() - 25 * 3_600_000),
    });
    fakePayment.setMode('success');
    fakePayment.setVerifyAmount('4500.00');

    const stats = emptyStats();
    await expireAbandoned(stats);

    expect(stats.applied).toBe(1);
    expect(stats.expired).toBe(0);
    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(fresh?.status).toBe('PAID');
    const mus = await prisma.museum.findUnique({ where: { id: museum.id } });
    expect(mus?.tier).toBe('PRO');
  });

  it('reconciler mid-window applies a missed payment', async () => {
    const museum = await seedMuseum({ slug: 'mid', name: 'Mid', tier: 'BASIC', roomCount: 1 });
    await createPendingPayment({
      museumId: museum.id,
      adminId: museum.adminId,
      amountEtb: 4500,
      // Between 5 minutes and 24 hours
      createdAt: new Date(Date.now() - 10 * 60_000),
    });
    fakePayment.setMode('success');
    fakePayment.setVerifyAmount('4500.00');

    const stats = await runReconciler();

    expect(stats.applied).toBe(1);
    const mus = await prisma.museum.findUnique({ where: { id: museum.id } });
    expect(mus?.tier).toBe('PRO');
  });

  it('--sweep flips lapsed ACTIVE museums to PAST_DUE', async () => {
    const museum = await seedMuseum({
      slug: 'lapsed',
      name: 'Lapsed',
      tier: 'PRO',
      roomCount: 1,
      subscriptionRenewsAt: new Date(Date.now() - 60_000),
    });

    const stats = await runReconciler({ sweep: true });

    expect(stats.sweptToPastDue).toBe(1);
    const mus = await prisma.museum.findUnique({ where: { id: museum.id } });
    expect(mus?.subscriptionStatus).toBe('PAST_DUE');
  });

  it('system admin can checkout for an explicit museumId', async () => {
    const museum = await seedMuseum({ slug: 'sys', name: 'Sys', tier: 'BASIC', roomCount: 1 });
    const system = await seedSystemAdmin();
    const token = mintToken({ id: system.id, role: 'SYSTEM_ADMIN', museumId: null });

    const res = await api()
      .post('/admin/billing/checkout')
      .set(authHeader(token))
      .send({ tier: 'ENTERPRISE', museumId: museum.id });

    expect(res.status).toBe(201);
    const payment = await prisma.payment.findUnique({ where: { txRef: res.body.txRef } });
    expect(payment?.museumId).toBe(museum.id);
    expect(payment?.tier).toBe('ENTERPRISE');
  });
});
