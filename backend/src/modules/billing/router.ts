import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { requireParam } from '../../lib/params.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import {
  billingStatusQuerySchema,
  checkoutRequestSchema,
  manualTierRequestSchema,
} from './schemas.js';
import {
  applyPaidPayment,
  createCheckout,
  getBillingStatus,
  manualTierOverride,
} from './service.js';
import { TIER_LIMITS } from './tiers.js';

export const billingRouter = Router();

billingRouter.use(requireAuth);

/** The plans on offer, with prices from the database and limits from code. */
billingRouter.get(
  '/billing/plans',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.tierPricing.findMany({
      where: { active: true },
      orderBy: { amountEtb: 'asc' },
    });

    res.json({
      plans: rows.map((row) => ({
        tier: row.tier,
        displayName: row.displayName,
        description: row.description,
        amountEtb: row.amountEtb.toFixed(2),
        currency: 'ETB',
        periodDays: row.periodDays,
        limits: TIER_LIMITS[row.tier],
      })),
    });
  }),
);

billingRouter.post(
  '/billing/checkout',
  asyncHandler(async (req, res) => {
    const body = checkoutRequestSchema.parse(req.body);
    if (!req.admin) throw ApiError.unauthenticated();

    const result = await createCheckout(req.admin, body.tier, body.museumId, req.requestId);

    res.status(201).json({
      txRef: result.txRef,
      checkoutUrl: result.checkoutUrl,
      tier: body.tier,
      amountEtb: result.amountEtb,
      currency: result.currency,
      expiresHint: 'Complete payment within 24 hours.',
    });
  }),
);

billingRouter.get(
  '/billing/status',
  asyncHandler(async (req, res) => {
    const query = billingStatusQuerySchema.parse(req.query);
    if (!req.admin) throw ApiError.unauthenticated();

    res.json(await getBillingStatus(req.admin, query.museumId, query.cursor, query.limit));
  }),
);

/**
 * Polled by the return page after the visitor comes back from the provider.
 * A payment still pending after a few seconds is verified here rather than
 * waiting for the reconciler's next run.
 */
billingRouter.get(
  '/billing/payments/:txRef',
  asyncHandler(async (req, res) => {
    const txRef = requireParam(req, 'txRef');
    if (!req.admin) throw ApiError.unauthenticated();

    const payment = await prisma.payment.findUnique({ where: { txRef } });
    if (!payment) throw ApiError.paymentNotFound();

    if (req.admin.role !== 'SYSTEM_ADMIN' && payment.museumId !== req.admin.museumId) {
      throw ApiError.crossTenant();
    }

    if (payment.status === 'PENDING' && Date.now() - payment.createdAt.getTime() > 5000) {
      // Best-effort: a verify failure here should not fail the poll, the
      // reconciler will pick the payment up later.
      await applyPaidPayment(txRef, req.requestId).catch((err: unknown) => {
        req.log.warn({ txRef, err }, 'Poll-triggered verify failed');
      });
    }

    // Re-read both rows so the response reflects any upgrade just applied.
    const [fresh, museum] = await Promise.all([
      prisma.payment.findUnique({ where: { txRef } }),
      prisma.museum.findUnique({ where: { id: payment.museumId } }),
    ]);

    res.json({
      txRef,
      status: fresh?.status ?? payment.status,
      tier: payment.tier,
      amountEtb: payment.amountEtb.toFixed(2),
      paidAt: fresh?.paidAt ?? null,
      chapaReference: fresh?.chapaReference ?? null,
      museumTier: museum?.tier ?? null,
      subscriptionRenewsAt: museum?.subscriptionRenewsAt ?? null,
    });
  }),
);

billingRouter.post(
  '/billing/tier',
  requireRole('SYSTEM_ADMIN'),
  asyncHandler(async (req, res) => {
    const body = manualTierRequestSchema.parse(req.body);
    if (!req.admin) throw ApiError.unauthenticated();

    res.json(await manualTierOverride(req.admin, body, req.requestId));
  }),
);
