import type { SubscriptionTier } from '@prisma/client';
import { ulid } from 'ulid';
import { prisma } from '../../lib/prisma.js';
import { ApiError, ErrorCode } from '../../lib/errors.js';
import { TIER_LIMITS } from './tiers.js';
import { getPaymentProvider } from '../../providers/payments/index.js';
import { UpstreamFailureError, UpstreamUnavailableError } from '../../providers/resilience.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import type { AdminPayload } from '../../middleware/requireAuth.js';

// ── applyPaidPayment ─────────────────────────────────────────────────────────
// The single entitlement path. Called by the return-page poll in router.ts and
// by scripts/reconcile-payments.ts. Safe to call concurrently — guarded by a
// conditional update on status = 'PENDING'. Zero rows updated means someone
// else got there first.

interface ApplyResult {
  applied: boolean;
  reason?: string;
}

export async function applyPaidPayment(txRef: string, requestId?: string): Promise<ApplyResult> {
  const payment = await prisma.payment.findUnique({
    where: { txRef },
    include: { museum: true },
  });

  if (!payment) return { applied: false, reason: 'payment_not_found' };
  if (payment.status !== 'PENDING') return { applied: false, reason: 'already_processed' };

  // Verify with Chapa before touching any state
  const provider = getPaymentProvider();
  let verifyResult: Awaited<ReturnType<typeof provider.verify>>;

  try {
    verifyResult = await provider.verify(txRef);
  } catch (err) {
    logger.error({ requestId, txRef, err }, 'Verify call failed during applyPaidPayment');
    throw err;
  }

  // Still in flight at Chapa — leave PENDING for the next poll/reconcile pass
  if (verifyResult.status === 'pending') {
    return { applied: false, reason: 'still_pending' };
  }

  const paymentAmountStr = payment.amountEtb.toFixed(2);
  const verifyAmountStr = parseFloat(verifyResult.amount).toFixed(2);

  if (
    verifyResult.status !== 'success' ||
    verifyResult.currency !== 'ETB' ||
    verifyAmountStr !== paymentAmountStr
  ) {
    logger.error(
      { requestId, txRef, verifyStatus: verifyResult.status, verifyAmount: verifyResult.amount, paymentAmount: paymentAmountStr, currency: verifyResult.currency },
      'Payment verify mismatch — not upgrading',
    );

    await prisma.payment.updateMany({
      where: { txRef, status: 'PENDING' },
      data: {
        status: 'FAILED',
        failureReason: `Verify mismatch: status=${verifyResult.status} amount=${verifyResult.amount} currency=${verifyResult.currency}`,
      },
    });

    return { applied: false, reason: 'verify_mismatch' };
  }

  // Period arithmetic: extend rather than truncate
  const now = new Date();
  const renewsAt = payment.museum.subscriptionRenewsAt;
  const periodStart = renewsAt && renewsAt > now ? renewsAt : now;

  const pricing = await prisma.tierPricing.findUnique({ where: { tier: payment.tier } });
  const periodDays = pricing?.periodDays ?? 30;
  const periodEnd = new Date(periodStart.getTime() + periodDays * 86_400_000);

  // One transaction: payment + museum update + audit
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { txRef, status: 'PENDING' },
      data: {
        status: 'PAID',
        paidAt: now,
        chapaReference: verifyResult.reference,
        periodStart,
        periodEnd,
      },
    });

    if (updated.count === 0) {
      // Race condition: another process already applied this payment
      return false;
    }

    await tx.museum.update({
      where: { id: payment.museumId },
      data: {
        tier: payment.tier,
        subscriptionStatus: 'ACTIVE',
        subscriptionRenewsAt: periodEnd,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        // Null when the reconciler applied this with no admin in the request
        adminUserId: payment.initiatedByAdminId,
        museumId: payment.museumId,
        action: 'UPDATE',
        entityType: 'Museum',
        entityId: payment.museumId,
        after: {
          tier: payment.tier,
          subscriptionStatus: 'ACTIVE',
          subscriptionRenewsAt: periodEnd.toISOString(),
          triggeredByPayment: payment.id,
        },
      },
    });

    return true;
  });

  if (!result) return { applied: false, reason: 'race_condition' };

  logger.info({ requestId, txRef, tier: payment.tier, museumId: payment.museumId }, 'Payment applied successfully');
  return { applied: true };
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export async function createCheckout(
  admin: AdminPayload,
  tier: SubscriptionTier,
  explicitMuseumId?: string,
  requestId?: string,
): Promise<{ txRef: string; checkoutUrl: string; amountEtb: string; currency: string }> {
  const museumId = admin.role === 'SYSTEM_ADMIN' ? (explicitMuseumId ?? admin.museumId) : admin.museumId;
  if (!museumId) throw ApiError.badRequest('museumId is required for system admin checkout');

  const museum = await prisma.museum.findUnique({ where: { id: museumId } });
  if (!museum) throw ApiError.notFound('Museum');

  // Guard: reject a duplicate checkout for the same tier when renewal is > 7 days away
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000);
  if (
    museum.tier === tier &&
    museum.subscriptionStatus === 'ACTIVE' &&
    museum.subscriptionRenewsAt &&
    museum.subscriptionRenewsAt > sevenDaysFromNow
  ) {
    const pending = await prisma.payment.count({
      where: { museumId, tier, status: 'PENDING' },
    });
    if (pending > 0) {
      throw new ApiError(
        409,
        ErrorCode.PAYMENT_ALREADY_PENDING,
        'A checkout for this tier is already in progress',
      );
    }
  }

  // Rate guard: max 5 pending checkouts per hour per museum
  const oneHourAgo = new Date(now.getTime() - 3_600_000);
  const recentPending = await prisma.payment.count({
    where: { museumId, status: 'PENDING', createdAt: { gte: oneHourAgo } },
  });
  if (recentPending >= 5) {
    throw new ApiError(
      429,
      ErrorCode.RATE_LIMITED,
      'Too many pending checkouts. Please wait before trying again.',
    );
  }

  const pricing = await prisma.tierPricing.findUnique({ where: { tier } });
  if (!pricing || !pricing.active) throw ApiError.notFound('Tier pricing');

  const txRef = `adwa-${museum.slug}-${tier}-${ulid()}`;
  const amountStr = pricing.amountEtb.toFixed(2);

  // Find the email to use for Chapa
  const adminUser = await prisma.adminUser.findFirst({ where: { museumId, role: 'MUSEUM_ADMIN' } });
  const billingEmail = museum.billingEmail ?? adminUser?.email ?? 'billing@adwa.local';

  const provider = getPaymentProvider();

  // Create Payment row before calling Chapa so we have a record even if the call fails
  const payment = await prisma.payment.create({
    data: {
      museumId,
      tier,
      amountEtb: pricing.amountEtb,
      currency: 'ETB',
      txRef,
      status: 'PENDING',
      initiatedByAdminId: admin.id,
    },
  });

  try {
    const result = await provider.initialize({
      txRef,
      amount: amountStr,
      currency: 'ETB',
      email: billingEmail,
      firstName: museum.name.split(' ')[0] ?? museum.name,
      lastName: museum.name.split(' ').slice(1).join(' ') || 'Museum',
      title: `${pricing.displayName} Plan`,
      description: `${pricing.displayName} subscription, 30 days`,
      returnUrl: env.CHAPA_RETURN_URL,
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { checkoutUrl: result.checkoutUrl },
    });

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        museumId,
        action: 'CREATE',
        entityType: 'Payment',
        entityId: payment.id,
        after: { tier, amountEtb: amountStr, txRef },
      },
    });

    logger.info({ requestId, txRef, museumId, tier }, 'Checkout created');
    return { txRef, checkoutUrl: result.checkoutUrl, amountEtb: amountStr, currency: 'ETB' };
  } catch (err) {
    // Mark the payment as failed so the record is clean
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason: err instanceof Error ? err.message : 'Unknown error during initialize',
      },
    });

    if (err instanceof UpstreamUnavailableError) throw ApiError.upstreamUnavailable('Chapa');
    if (err instanceof UpstreamFailureError) throw ApiError.upstreamFailure('Chapa payment initialization failed');
    throw err;
  }
}

// ── Billing status ────────────────────────────────────────────────────────────

export async function getBillingStatus(
  admin: AdminPayload,
  queryMuseumId?: string,
  cursor?: string,
  limit = 10,
) {
  // Museum admins always see their own museum — ignore any supplied museumId
  const museumId = admin.role === 'SYSTEM_ADMIN' ? (queryMuseumId ?? admin.museumId) : admin.museumId;
  if (!museumId) throw ApiError.badRequest('museumId is required');

  const museum = await prisma.museum.findUnique({ where: { id: museumId } });
  if (!museum) throw ApiError.notFound('Museum');

  const limits = TIER_LIMITS[museum.tier];
  const roomCount = await prisma.room.count({ where: { museumId } });
  const adminCount = await prisma.adminUser.count({ where: { museumId } });

  const payments = await prisma.payment.findMany({
    where: { museumId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      txRef: true,
      tier: true,
      amountEtb: true,
      status: true,
      paidAt: true,
      chapaReference: true,
      createdAt: true,
    },
  });

  const hasMore = payments.length > limit;
  const page = payments.slice(0, limit);
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;

  const now = new Date();
  const renewsAt = museum.subscriptionRenewsAt;
  const daysUntilRenewal = renewsAt
    ? Math.max(0, Math.ceil((renewsAt.getTime() - now.getTime()) / 86_400_000))
    : null;

  return {
    museumId,
    tier: museum.tier,
    subscriptionStatus: museum.subscriptionStatus,
    subscriptionRenewsAt: museum.subscriptionRenewsAt,
    daysUntilRenewal,
    limits: {
      maxRooms: limits.maxRooms,
      maxItemsPerRoom: limits.maxItemsPerRoom,
      maxAdminUsers: limits.maxAdminUsers,
    },
    usage: { rooms: roomCount, adminUsers: adminCount },
    payments: page.map((p) => ({ ...p, amountEtb: p.amountEtb.toFixed(2) })),
    nextCursor,
  };
}

// ── Manual tier override (system admin only) ──────────────────────────────────

export async function manualTierOverride(
  admin: AdminPayload,
  input: {
    museumId: string;
    tier: SubscriptionTier;
    subscriptionStatus?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | undefined;
    subscriptionRenewsAt?: string | undefined;
    reason: string;
  },
  requestId?: string,
) {
  const museum = await prisma.museum.findUnique({ where: { id: input.museumId } });
  if (!museum) throw ApiError.notFound('Museum');

  const before = { tier: museum.tier, subscriptionStatus: museum.subscriptionStatus, subscriptionRenewsAt: museum.subscriptionRenewsAt };

  await prisma.$transaction(async (tx) => {
    await tx.museum.update({
      where: { id: input.museumId },
      data: {
        tier: input.tier,
        ...(input.subscriptionStatus ? { subscriptionStatus: input.subscriptionStatus } : {}),
        ...(input.subscriptionRenewsAt ? { subscriptionRenewsAt: new Date(input.subscriptionRenewsAt) } : {}),
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        museumId: input.museumId,
        action: 'UPDATE',
        entityType: 'Museum',
        entityId: input.museumId,
        before,
        after: { tier: input.tier, reason: input.reason },
      },
    });
  });

  logger.info({ requestId, museumId: input.museumId, tier: input.tier, reason: input.reason }, 'Manual tier override applied');
  return { success: true };
}
