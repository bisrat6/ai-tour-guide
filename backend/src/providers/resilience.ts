/**
 * Resilience wrapper for every outbound provider call (dev3 §7).
 *
 * - Per-call timeout via AbortSignal.
 * - One retry on timeout or 5xx, never on 4xx: a bad request retried is just a
 *   bad request twice.
 * - Circuit breaker per vendor+operation: opens after 5 consecutive failures,
 *   half-opens after 30s, so a dead vendor stops costing every caller a
 *   timeout.
 *
 * Ported from dev3's branch. The breaker is per-process and in-memory, which is
 * the right scope for a single service but does not coordinate across replicas.
 */
import { logger } from '../lib/logger.js';

interface ProviderCallOptions<T> {
  /** Vendor name, used for logs and as part of the breaker key. */
  name: string;
  /** Operation name, e.g. 'initialize' or 'verify'. */
  operation: string;
  timeoutMs: number;
  fn: (signal: AbortSignal) => Promise<T>;
  requestId?: string;
}

interface BreakerState {
  failures: number;
  openedAt: number | null;
}

const breakers = new Map<string, BreakerState>();
const BREAKER_THRESHOLD = 5;
const BREAKER_HALF_OPEN_MS = 30000;

function getBreaker(key: string): BreakerState {
  const existing = breakers.get(key);
  if (existing) return existing;
  const fresh: BreakerState = { failures: 0, openedAt: null };
  breakers.set(key, fresh);
  return fresh;
}

function isOpen(state: BreakerState): boolean {
  if (state.openedAt === null) return false;
  return Date.now() - state.openedAt <= BREAKER_HALF_OPEN_MS;
}

/** Test-only: the breaker is process-global, so suites must be able to clear it. */
export function resetBreakersForTests(): void {
  breakers.clear();
}

export interface BreakerSnapshot {
  /** `${vendor}:${operation}` — the same key providerCall buckets by. */
  key: string;
  consecutiveFailures: number;
  open: boolean;
  openedAt: string | null;
}

/**
 * Read-only view for the operator health screen. Only vendors that have
 * actually been called appear here: a breaker is created lazily on first use,
 * so an empty list means no outbound call has been made since boot, not that
 * everything is healthy.
 */
export function getBreakerSnapshots(): BreakerSnapshot[] {
  return [...breakers.entries()].map(([key, state]) => ({
    key,
    consecutiveFailures: state.failures,
    open: isOpen(state),
    openedAt: state.openedAt === null ? null : new Date(state.openedAt).toISOString(),
  }));
}

export class UpstreamUnavailableError extends Error {
  constructor(vendor: string) {
    super(`${vendor} circuit breaker is open`);
    this.name = 'UpstreamUnavailableError';
  }
}

export class UpstreamFailureError extends Error {
  readonly statusCode: number | undefined;
  readonly body: unknown;

  constructor(message: string, statusCode?: number, body?: unknown) {
    super(message);
    this.name = 'UpstreamFailureError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

export async function providerCall<T>(opts: ProviderCallOptions<T>): Promise<T> {
  const { name, operation, timeoutMs, fn, requestId } = opts;
  const state = getBreaker(`${name}:${operation}`);

  if (isOpen(state)) {
    throw new UpstreamUnavailableError(name);
  }

  const start = Date.now();
  let attempt = 0;

  async function run(): Promise<T> {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

    try {
      const result = await fn(controller.signal);
      state.failures = 0;
      state.openedAt = null;
      logger.info(
        { requestId, provider: name, operation, attempt, durationMs: Date.now() - start },
        'Provider call succeeded',
      );
      return result;
    } catch (err) {
      const isTimeout =
        controller.signal.aborted ||
        (err as Error).name === 'AbortError' ||
        (err as Error).message?.includes('timeout') === true ||
        (err as { code?: string }).code === 'ABORT_ERR';
      const statusCode = (err as { statusCode?: number }).statusCode;
      const isRetryable = isTimeout || (statusCode !== undefined && statusCode >= 500);

      logger.warn(
        { requestId, provider: name, operation, attempt, durationMs: Date.now() - start, err },
        'Provider call failed',
      );

      if (isRetryable && attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return run();
      }

      state.failures += 1;
      if (state.failures >= BREAKER_THRESHOLD) {
        state.openedAt = Date.now();
        logger.error({ provider: name, operation }, 'Circuit breaker opened');
      }

      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  return run();
}
