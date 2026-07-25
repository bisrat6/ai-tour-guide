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

export interface ReconcileStats {
  scanned: number;
  applied: number;
  stillPending: number;
  expired: number;
  failed: number;
  sweptToPastDue: number;
}

export function emptyStats(): ReconcileStats {
  return { scanned: 0, applied: 0, stillPending: 0, expired: 0, failed: 0, sweptToPastDue: 0 };
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
      stats.failed += 1;
      logger.error({ txRef: payment.txRef, err }, 'Reconciler could not verify payment');
    }
  }
}

/**
 * NOTE (carried over, see docs/d3-integration-audit.md): a verify call that
 * merely errors is treated as abandonment, so a genuinely paid transaction can
 * be marked EXPIRED and never re-checked.
 */
export async function expireAbandoned(
  stats: ReconcileStats,
  opts: ReconcileOptions = {},
): Promise<void> {
  const stale = await prisma.payment.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - EXPIRY_AGE_MS) } },
    select: { id: true, txRef: true },
  });

  for (const payment of stale) {
    if (opts.dryRun) {
      logger.info({ txRef: payment.txRef }, '[dry-run] would expire');
      continue;
    }

    let succeededLate = false;
    try {
      const verify = await getPaymentProvider().verify(payment.txRef);
      succeededLate = verify.status === 'success';
    } catch {
      // Treated as abandoned.
    }

    if (succeededLate) {
      const result = await applyPaidPayment(payment.txRef).catch(() => ({ applied: false }));
      if (result.applied) {
        stats.applied += 1;
        logger.warn({ txRef: payment.txRef }, 'Recovered a paid transaction at the expiry cutoff');
        continue;
      }
    }

    const updated = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'EXPIRED',
        failureReason: 'Abandoned: no successful payment within 24 hours',
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
