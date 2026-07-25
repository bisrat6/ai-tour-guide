/**
 * Payment reconciler CLI (dev3 §4.5). Intended to run on a schedule.
 *
 * Usage:
 *   npm run reconcile
 *   npm run reconcile -- --sweep
 *   npm run reconcile -- --dry-run
 */
import '../src/config/env.js';
import { logger } from '../src/lib/logger.js';
import { prisma } from '../src/lib/prisma.js';
import { runReconciler } from '../src/modules/billing/reconcile.js';

const args = new Set(process.argv.slice(2));
const sweep = args.has('--sweep');
const dryRun = args.has('--dry-run');

async function main(): Promise<void> {
  const started = Date.now();
  logger.info({ dryRun, sweep }, 'Reconciler starting');

  const stats = await runReconciler({ sweep, dryRun });

  logger.info({ ...stats, durationMs: Date.now() - started }, 'Reconciler finished');
  console.log(
    `[reconcile] scanned=${stats.scanned} applied=${stats.applied} ` +
      `stillPending=${stats.stillPending} expired=${stats.expired} ` +
      `failed=${stats.failed} sweptToPastDue=${stats.sweptToPastDue}`,
  );
}

main()
  .catch((err: unknown) => {
    logger.error({ err }, 'Reconciler crashed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
