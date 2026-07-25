/**
 * Reconciler (dev3 §4.5). Catches payments the return-page poll missed, retires
 * abandoned checkouts, and lapses subscriptions whose period has run out.
 * Shared by scripts/reconcile-payments.ts and the tests.
 */
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { getPaymentProvider } from '../../providers/payments/index.js';
import { applyPaidPayment } from './service.js';

/** Young payments are left to the return-page poll. */
export const MIN_AGE_MS = 5 * 60_000;
export const EXPIRY_AGE_MS = 24 * 3_600_000;
/**
 * Backstop for payments the provider will not give a verdict on. Without it, a
 * vendor that is permanently unreachable would leave rows PENDING for ever;
 * with it, we still wait a week before assuming the worst.
 */
export const UNVERIFIABLE_AGE_MS = 7 * 24 * 3_600_000;

export interface ReconcileStats {
  scanned: number;
  applied: number;
  stillPending: number;
  expired: number;
  failed: number;
  /** Verify calls that errored. Distinct from `failed`, which is a real "no". */
  verifyErrors: number;
  sweptToPastDue: number;
}

export function emptyStats(): ReconcileStats {
  return {
    scanned: 0,
    applied: 0,
    stillPending: 0,
    expired: 0,
    failed: 0,
    verifyErrors: 0,
    sweptToPastDue: 0,
  };
}

interface ReconcileOptions {
  dryRun?: boolean;
}

export async function reconcilePending(
  stats: ReconcileStats,
  opts: ReconcileOptions = {},
): Promise<void> {
  const now = Date.now();

  const candidates = await prisma.payment.findMany({
    where: {
      status: 'PENDING',
      createdAt: { gte: new Date(now - EXPIRY_AGE_MS), lte: new Date(now - MIN_AGE_MS) },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, txRef: true, museumId: true, tier: true, createdAt: true },
  });

  stats.scanned = candidates.length;

  for (const payment of candidates) {
    if (opts.dryRun) {
      logger.info({ txRef: payment.txRef }, '[dry-run] would verify');
      continue;
    }

    try {
      const result = await applyPaidPayment(payment.txRef);

      if (result.applied) {
        stats.applied += 1;
        logger.info(
          { txRef: payment.txRef, museumId: payment.museumId, tier: payment.tier },
          'Reconciler applied a payment the return page missed',
        );
      } else if (result.reason === 'verify_mismatch') {
        stats.failed += 1;
      } else {
        stats.stillPending += 1;
      }
    } catch (err) {
      stats.verifyErrors += 1;
      logger.error({ txRef: payment.txRef, err }, 'Reconciler could not verify payment');
    }
  }
}

/**
 * Retires checkouts the visitor never completed.
 *
 * A verify call that *errors* is not evidence of abandonment — treating it as
 * such is how a genuinely paid transaction used to end up EXPIRED. Those rows
 * are left PENDING for the next run instead, until UNVERIFIABLE_AGE_MS makes
 * waiting longer pointless, and even then they are expired with a reason that
 * says the payment was never verified rather than never made.
 */
export async function expireAbandoned(
  stats: ReconcileStats,
  opts: ReconcileOptions = {},
): Promise<void> {
  const stale = await prisma.payment.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - EXPIRY_AGE_MS) } },
    select: { id: true, txRef: true, createdAt: true },
  });

  for (const payment of stale) {
    if (opts.dryRun) {
      logger.info({ txRef: payment.txRef }, '[dry-run] would expire');
      continue;
    }

    let verdict: 'paid' | 'not_paid' | 'unknown';
    try {
      const verify = await getPaymentProvider().verify(payment.txRef);
      verdict = verify.status === 'success' ? 'paid' : 'not_paid';
    } catch (err) {
      verdict = 'unknown';
      logger.warn(
        { txRef: payment.txRef, err },
        'Could not verify a stale payment — leaving it pending for the next run',
      );
    }

    if (verdict === 'paid') {
      const result = await applyPaidPayment(payment.txRef).catch(() => ({ applied: false }));
      if (result.applied) {
        stats.applied += 1;
        logger.warn({ txRef: payment.txRef }, 'Recovered a paid transaction at the expiry cutoff');
      } else {
        // The provider says paid but we could not record it. Never expire that.
        stats.verifyErrors += 1;
        logger.error(
          { txRef: payment.txRef },
          'Provider reports this payment as paid but it could not be applied',
        );
      }
      continue;
    }

    const age = Date.now() - payment.createdAt.getTime();
    if (verdict === 'unknown' && age < UNVERIFIABLE_AGE_MS) {
      stats.verifyErrors += 1;
      continue;
    }

    const updated = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'EXPIRED',
        failureReason:
          verdict === 'unknown'
            ? `Abandoned: could not be verified within ${UNVERIFIABLE_AGE_MS / 3_600_000} hours`
            : 'Abandoned: no successful payment within 24 hours',
      },
    });

    if (updated.count > 0) stats.expired += 1;
  }
}

export async function sweepLapsedSubscriptions(
  stats: ReconcileStats,
  opts: ReconcileOptions = {},
): Promise<void> {
  const lapsed = await prisma.museum.findMany({
    where: { subscriptionStatus: 'ACTIVE', subscriptionRenewsAt: { lt: new Date() } },
    select: { id: true, slug: true, subscriptionRenewsAt: true },
  });

  for (const museum of lapsed) {
    if (opts.dryRun) {
      logger.info({ slug: museum.slug }, '[dry-run] would mark PAST_DUE');
      continue;
    }

    await prisma.museum.update({
      where: { id: museum.id },
      data: { subscriptionStatus: 'PAST_DUE' },
    });

    stats.sweptToPastDue += 1;
    logger.info(
      { museumId: museum.id, slug: museum.slug, renewedAt: museum.subscriptionRenewsAt },
      'Museum subscription lapsed to PAST_DUE',
    );
  }
}

export async function runReconciler(
  opts: ReconcileOptions & { sweep?: boolean } = {},
): Promise<ReconcileStats> {
  const stats = emptyStats();
  await reconcilePending(stats, opts);
  await expireAbandoned(stats, opts);
  if (opts.sweep) await sweepLapsedSubscriptions(stats, opts);
  return stats;
}
