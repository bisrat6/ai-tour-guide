import { Prisma, type SubscriptionTier } from '@prisma/client';
import { ulid } from 'ulid';
import { env } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { getPaymentProvider } from '../../providers/payments/index.js';
import { UpstreamFailureError, UpstreamUnavailableError } from '../../providers/resilience.js';
import type { AdminContext } from '../../types/express.js';
import { TIER_LIMITS } from './tiers.js';

const DAY_MS = 86_400_000;
const MAX_PENDING_CHECKOUTS_PER_HOUR = 5;

interface ApplyResult {
  applied: boolean;
  reason?: string;
}

/**
 * Compared as decimals, not floats. Rounding a float to two places would accept
 * 4500.004 as 4500.00, and parseFloat reads '4500abc' as 4500 — both of which a
 * currency check has no business tolerating. An unparseable amount is a
 * mismatch rather than a crash.
 */
function amountsMatch(expected: Prisma.Decimal, reported: string): boolean {
  try {
    return expected.equals(new Prisma.Decimal(reported));
  } catch {
    return false;
  }
}

/**
 * The single entitlement path (dev3 §4.3), shared by the return-page poll and
 * the reconciler.
 *
 * PAID is the only terminal status. EXPIRED and FAILED both mean "we stopped
 * waiting", not "the provider said no", so a payment in either state is still
 * re-verified here — otherwise a vendor outage at the wrong moment, or an
 * expiry sweep racing an in-flight apply, would strand money the visitor
 * actually paid. Double-crediting is prevented instead by making every status
 * change conditional on the row not already being PAID, so a caller that loses
 * the race updates zero rows and reports it.
 */
export async function applyPaidPayment(txRef: string, requestId?: string): Promise<ApplyResult> {
  const payment = await prisma.payment.findUnique({
    where: { txRef },
    include: { museum: true },
  });

  if (!payment) return { applied: false, reason: 'payment_not_found' };
  if (payment.status === 'PAID') return { applied: false, reason: 'already_processed' };

  const provider = getPaymentProvider();
  let verifyResult: Awaited<ReturnType<typeof provider.verify>>;
  try {
    verifyResult = await provider.verify(txRef);
  } catch (err) {
    logger.error({ requestId, txRef, err }, 'Verify call failed during applyPaidPayment');
    throw err;
  }

  // Still in flight at the provider: leave it PENDING for the next pass.
  if (verifyResult.status === 'pending') {
    return { applied: false, reason: 'still_pending' };
  }

  // Compared against the stored row rather than trusting the provider payload.
  const expectedAmount = payment.amountEtb;
  const amountMatches = amountsMatch(expectedAmount, verifyResult.amount);

  if (verifyResult.status !== 'success' || verifyResult.currency !== 'ETB' || !amountMatches) {
    logger.error(
      {
        requestId,
        txRef,
        verifyStatus: verifyResult.status,
        verifyAmount: verifyResult.amount,
        expectedAmount: expectedAmount.toFixed(2),
        currency: verifyResult.currency,
      },
      'Payment verify mismatch — not upgrading',
    );

    await prisma.payment.updateMany({
      where: { txRef, status: { not: 'PAID' } },
      data: {
        status: 'FAILED',
        failureReason: `Verify mismatch: status=${verifyResult.status} amount=${verifyResult.amount} currency=${verifyResult.currency}`,
      },
    });

    return { applied: false, reason: 'verify_mismatch' };
  }

  // Renewing early extends from the existing expiry rather than truncating it.
  const now = new Date();
  const currentRenewal = payment.museum.subscriptionRenewsAt;
  const periodStart = currentRenewal && currentRenewal > now ? currentRenewal : now;

  const pricing = await prisma.tierPricing.findUnique({ where: { tier: payment.tier } });
  const periodDays = pricing?.periodDays ?? 30;
  const periodEnd = new Date(periodStart.getTime() + periodDays * DAY_MS);

  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { txRef, status: { not: 'PAID' } },
      data: {
        status: 'PAID',
        paidAt: now,
        chapaReference: verifyResult.reference,
        periodStart,
        periodEnd,
        // Cleared so a row recovered from EXPIRED or FAILED does not keep
        // reading as a failure once it is paid.
        failureReason: null,
      },
    });

    // Another caller applied this payment between our read and this update.
    if (updated.count === 0) return false;

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
        // Null when the reconciler applied this with no admin in the request.
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

  if (!applied) return { applied: false, reason: 'race_condition' };

  logger.info(
    { requestId, txRef, tier: payment.tier, museumId: payment.museumId },
    'Payment applied successfully',
  );
  return { applied: true };
}

export async function createCheckout(
  admin: AdminContext,
  tier: SubscriptionTier,
  explicitMuseumId?: string,
  requestId?: string,
): Promise<{ txRef: string; checkoutUrl: string; amountEtb: string; currency: string }> {
  // A museum admin can only ever pay for their own museum.
  const museumId =
    admin.role === 'SYSTEM_ADMIN' ? (explicitMuseumId ?? admin.museumId) : admin.museumId;
  if (!museumId) {
    throw ApiError.validation(
      [{ path: 'museumId', message: 'Required for a system admin checkout.' }],
      'museumId is required.',
    );
  }

  const museum = await prisma.museum.findUnique({ where: { id: museumId } });
  if (!museum) throw ApiError.notFound('Museum not found.');

  const now = new Date();

  // Renewing the same tier while the current period still has more than a week
  // to run is almost always a double-click, so refuse if one is already open.
  const renewalIsFarOff =
    museum.subscriptionRenewsAt !== null &&
    museum.subscriptionRenewsAt > new Date(now.getTime() + 7 * DAY_MS);

  if (museum.tier === tier && museum.subscriptionStatus === 'ACTIVE' && renewalIsFarOff) {
    const pending = await prisma.payment.count({ where: { museumId, tier, status: 'PENDING' } });
    if (pending > 0) throw ApiError.paymentAlreadyPending();
  }

  const recentPending = await prisma.payment.count({
    where: { museumId, status: 'PENDING', createdAt: { gte: new Date(now.getTime() - 3_600_000) } },
  });
  if (recentPending >= MAX_PENDING_CHECKOUTS_PER_HOUR) {
    throw ApiError.rateLimited('Too many pending checkouts. Please wait before trying again.');
  }

  const pricing = await prisma.tierPricing.findUnique({ where: { tier } });
  if (!pricing || !pricing.active) throw ApiError.notFound('Tier pricing not found.');

  const txRef = `adwa-${museum.slug}-${tier}-${ulid()}`;
  const amountEtb = pricing.amountEtb.toFixed(2);

  const museumAdmin = await prisma.adminUser.findFirst({
    where: { museumId, role: 'MUSEUM_ADMIN' },
  });
  const billingEmail = museum.billingEmail ?? museumAdmin?.email ?? 'billing@adwa.local';

  // Written before the provider call so a failed checkout still leaves a record.
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
    const nameParts = museum.name.split(' ');
    const result = await getPaymentProvider().initialize({
      txRef,
      amount: amountEtb,
      currency: 'ETB',
      email: billingEmail,
      firstName: nameParts[0] ?? museum.name,
      lastName: nameParts.slice(1).join(' ') || 'Museum',
      title: `${pricing.displayName} Plan`,
      description: `${pricing.displayName} subscription, ${pricing.periodDays} days`,
      // config/env.ts refuses to boot without this when the real provider is
      // selected, so the fallback is only ever reached by the fake one.
      returnUrl: env.CHAPA_RETURN_URL ?? 'http://localhost/billing/return',
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { checkoutUrl: result.checkoutUrl },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        museumId,
        action: 'CREATE',
        entityType: 'Payment',
        entityId: payment.id,
        after: { tier, amountEtb, txRef },
      },
    });

    logger.info({ requestId, txRef, museumId, tier }, 'Checkout created');
    return { txRef, checkoutUrl: result.checkoutUrl, amountEtb, currency: 'ETB' };
  } catch (err) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason: err instanceof Error ? err.message : 'Unknown error during initialize',
      },
    });

    if (err instanceof UpstreamUnavailableError) {
      throw ApiError.upstreamUnavailable('Chapa is temporarily unavailable.');
    }
    if (err instanceof UpstreamFailureError) {
      throw ApiError.upstreamFailure('Chapa payment initialization failed.');
    }
    throw err;
  }
}

export async function getBillingStatus(
  admin: AdminContext,
  queryMuseumId?: string,
  cursor?: string,
  limit = 10,
) {
  // A museum admin always sees their own museum; any supplied id is ignored.
  const museumId =
    admin.role === 'SYSTEM_ADMIN' ? (queryMuseumId ?? admin.museumId) : admin.museumId;
  if (!museumId) {
    throw ApiError.validation(
      [{ path: 'museumId', message: 'Required for a system admin.' }],
      'museumId is required.',
    );
  }

  const museum = await prisma.museum.findUnique({ where: { id: museumId } });
  if (!museum) throw ApiError.notFound('Museum not found.');

  const limits = TIER_LIMITS[museum.tier];
  const [roomCount, adminCount] = await Promise.all([
    prisma.room.count({ where: { museumId } }),
    prisma.adminUser.count({ where: { museumId } }),
  ]);

  const rows = await prisma.payment.findMany({
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

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const renewsAt = museum.subscriptionRenewsAt;

  return {
    museumId,
    tier: museum.tier,
    subscriptionStatus: museum.subscriptionStatus,
    subscriptionRenewsAt: renewsAt,
    daysUntilRenewal: renewsAt
      ? Math.max(0, Math.ceil((renewsAt.getTime() - Date.now()) / DAY_MS))
      : null,
    limits,
    usage: { rooms: roomCount, adminUsers: adminCount },
    payments: page.map((row) => ({ ...row, amountEtb: row.amountEtb.toFixed(2) })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/**
 * Escape hatch for support: set a museum's tier without a payment. System admin
 * only, and the reason is mandatory so the audit trail explains itself.
 */
export async function manualTierOverride(
  admin: AdminContext,
  input: {
    museumId: string;
    tier: SubscriptionTier;
    subscriptionStatus?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | undefined;
    subscriptionRenewsAt?: string | undefined;
    reason: string;
  },
  requestId?: string,
): Promise<{ success: true }> {
  const museum = await prisma.museum.findUnique({ where: { id: input.museumId } });
  if (!museum) throw ApiError.notFound('Museum not found.');

  const before = {
    tier: museum.tier,
    subscriptionStatus: museum.subscriptionStatus,
    subscriptionRenewsAt: museum.subscriptionRenewsAt?.toISOString() ?? null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.museum.update({
      where: { id: input.museumId },
      data: {
        tier: input.tier,
        ...(input.subscriptionStatus ? { subscriptionStatus: input.subscriptionStatus } : {}),
        ...(input.subscriptionRenewsAt
          ? { subscriptionRenewsAt: new Date(input.subscriptionRenewsAt) }
          : {}),
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

  logger.info(
    { requestId, museumId: input.museumId, tier: input.tier, reason: input.reason },
    'Manual tier override applied',
  );
  return { success: true };
}
