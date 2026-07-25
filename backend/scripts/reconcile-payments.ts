/**
 * Payment reconciler CLI.
 *
 * Usage:
 *   npm run reconcile
 *   npm run reconcile -- --sweep
 *   npm run reconcile -- --dry-run
 */

import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { logger } from '../src/lib/logger.js';
import { runReconciler } from '../src/modules/billing/reconcile.js';

const args = new Set(process.argv.slice(2));
const doSweep = args.has('--sweep');
const dryRun = args.has('--dry-run');

async function main() {
  const started = Date.now();
  logger.info({ dryRun, sweep: doSweep }, 'Reconciler starting');

  const stats = await runReconciler({ sweep: doSweep, dryRun });

  logger.info({ ...stats, durationMs: Date.now() - started }, 'Reconciler finished');
  console.log(
    `[reconcile] scanned=${stats.scanned} applied=${stats.applied} ` +
      `stillPending=${stats.stillPending} expired=${stats.expired} ` +
      `failed=${stats.failed} sweptToPastDue=${stats.sweptToPastDue}`,
  );
}

main()
  .catch((err) => {
    logger.error({ err }, 'Reconciler crashed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
