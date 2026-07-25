/**
 * Resilience wrapper for all outbound provider calls.
 * - Per-call timeout via AbortSignal
 * - One retry on timeout or 5xx (never on 4xx — a bad request retried is a bad request twice)
 * - Circuit breaker: open after 5 consecutive failures, half-open after 30 s
 */

import { logger } from '../lib/logger.js';

interface ProviderCallOptions<T> {
  name: string;           // vendor name for logs
  operation: string;      // e.g. 'initialize', 'verify'
  timeoutMs: number;
  fn: (signal: AbortSignal) => Promise<T>;
  requestId?: string;
}

// ── Circuit breaker state (in-memory, per process) ────────────────────────────
interface BreakerState {
  failures: number;
  openedAt: number | null;
}

const breakers = new Map<string, BreakerState>();
const BREAKER_THRESHOLD = 5;
const BREAKER_HALF_OPEN_MS = 30_000;

function getBreaker(key: string): BreakerState {
  if (!breakers.has(key)) breakers.set(key, { failures: 0, openedAt: null });
  return breakers.get(key)!;
}

function isOpen(state: BreakerState): boolean {
  if (state.openedAt === null) return false;
  if (Date.now() - state.openedAt > BREAKER_HALF_OPEN_MS) {
    // Half-open: allow one attempt
    return false;
  }
  return true;
}

// ── Main call wrapper ─────────────────────────────────────────────────────────

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
  const breakerKey = `${name}:${operation}`;
  const state = getBreaker(breakerKey);

  if (isOpen(state)) {
    throw new UpstreamUnavailableError(name);
  }

  const start = Date.now();
  let attempt = 0;

  async function attempt1(): Promise<T> {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

    try {
      const result = await fn(controller.signal);
      // Success — reset breaker
      state.failures = 0;
      state.openedAt = null;
      logger.info({ requestId, provider: name, operation, attempt, durationMs: Date.now() - start }, 'Provider call succeeded');
      return result;
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = (err as Error).message?.includes('timeout') || (err as { code?: string }).code === 'ABORT_ERR';
      const statusCode = (err as { statusCode?: number }).statusCode;
      const isRetryable = isTimeout || (statusCode !== undefined && statusCode >= 500);

      logger.warn({ requestId, provider: name, operation, attempt, durationMs: Date.now() - start, err }, 'Provider call failed');

      if (isRetryable && attempt === 1) {
        await new Promise((r) => setTimeout(r, 500));
        return attempt1();
      }

      // Increment breaker
      state.failures++;
      if (state.failures >= BREAKER_THRESHOLD) {
        state.openedAt = Date.now();
        logger.error({ provider: name, operation }, 'Circuit breaker opened');
      }

      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  return attempt1();
}
