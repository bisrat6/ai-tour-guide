import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError, ErrorCode } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { checkoutSchema, manualTierSchema, billingStatusQuerySchema } from './schemas.js';
import { createCheckout, getBillingStatus, manualTierOverride, applyPaidPayment } from './service.js';
import { prisma } from '../../lib/prisma.js';
import { TIER_LIMITS } from './tiers.js';
import type { SubscriptionTier } from '@prisma/client';

const router = Router();

// ── Plans (public list of available tiers) ────────────────────────────────────
router.get(
  '/admin/billing/plans',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const pricingRows = await prisma.tierPricing.findMany({ where: { active: true } });

    const plans = pricingRows.map((row) => {
      const limits = TIER_LIMITS[row.tier];
      return {
        tier: row.tier,
        displayName: row.displayName,
        description: row.description,
        amountEtb: row.amountEtb.toFixed(2),
        currency: 'ETB',
        periodDays: row.periodDays,
        limits: {
          maxRooms: limits.maxRooms,
          maxItemsPerRoom: limits.maxItemsPerRoom,
          maxAdminUsers: limits.maxAdminUsers,
        },
      };
    });

    res.json({ plans });
  }),
);

// ── Checkout ──────────────────────────────────────────────────────────────────
router.post(
  '/admin/billing/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Validation failed', parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
    }

    const result = await createCheckout(
      req.admin,
      parsed.data.tier as SubscriptionTier,
      parsed.data.museumId,
      req.requestId,
    );

    res.status(201).json({
      txRef: result.txRef,
      checkoutUrl: result.checkoutUrl,
      tier: parsed.data.tier,
      amountEtb: result.amountEtb,
      currency: result.currency,
      expiresHint: 'Complete payment within 24 hours.',
    });
  }),
);

// ── Billing status ────────────────────────────────────────────────────────────
router.get(
  '/admin/billing/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = billingStatusQuerySchema.safeParse(req.query);
    if (!query.success) throw ApiError.badRequest('Invalid query params');

    const result = await getBillingStatus(
      req.admin,
      query.data.museumId,
      query.data.cursor,
      query.data.limit,
    );
    res.json(result);
  }),
);

// ── Payment status (return-page polling) ─────────────────────────────────────
router.get(
  '/admin/billing/payments/:txRef',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { txRef } = req.params as { txRef: string };

    const payment = await prisma.payment.findUnique({ where: { txRef }, include: { museum: true } });
    if (!payment) throw new ApiError(404, ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found');

    // Scope check: museum admin can only see their own museum's payments
    if (req.admin.role !== 'SYSTEM_ADMIN' && payment.museumId !== req.admin.museumId) {
      throw ApiError.crossTenantAccess();
    }

    // Lazy verify: if still pending for > 5 s, try to apply via the shared path
    const ageMs = Date.now() - payment.createdAt.getTime();
    if (payment.status === 'PENDING' && ageMs > 5_000) {
      await applyPaidPayment(txRef, req.requestId).catch(() => {/* best-effort */});
    }

    const fresh = await prisma.payment.findUnique({ where: { txRef } });

    res.json({
      txRef,
      status: fresh?.status ?? payment.status,
      tier: payment.tier,
      amountEtb: payment.amountEtb.toFixed(2),
      paidAt: fresh?.paidAt ?? null,
      chapaReference: fresh?.chapaReference ?? null,
      museumTier: payment.museum.tier,
      subscriptionRenewsAt: payment.museum.subscriptionRenewsAt,
    });
  }),
);

// ── Manual tier override (system admin only) ──────────────────────────────────
router.post(
  '/admin/billing/tier',
  requireAuth,
  requireRole('SYSTEM_ADMIN'),
  asyncHandler(async (req, res) => {
    const parsed = manualTierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Validation failed', parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
    }

    const result = await manualTierOverride(req.admin, {
      ...parsed.data,
      tier: parsed.data.tier as SubscriptionTier,
    }, req.requestId);

    res.json(result);
  }),
);

export { router as billingRouter };
