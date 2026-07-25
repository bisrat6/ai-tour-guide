import { ApiError } from './errors';
import { logger } from './logger';

/**
 * Uniform resilience wrapper for every provider call (§12.4):
 * a bounded timeout, exactly one retry on timeout/5xx/network error
 * (never on 4xx), and a per-provider circuit breaker that opens after
 * five consecutive failures and half-opens after 30 seconds.
 */

class CircuitBreaker {
  private consecutiveFailures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private openedAt = 0;
  private readonly failureThreshold = 5;
  private readonly resetMs = 30_000;

  canAttempt(): boolean {
    if (this.state !== 'open') return true;
    if (Date.now() - this.openedAt >= this.resetMs) {
      this.state = 'half-open';
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }
}

const breakers = new Map<string, CircuitBreaker>();

function getBreaker(providerName: string): CircuitBreaker {
  let breaker = breakers.get(providerName);
  if (!breaker) {
    breaker = new CircuitBreaker();
    breakers.set(providerName, breaker);
  }
  return breaker;
}

/** Exposed for tests that need to force a breaker back to a known state. */
export function resetCircuitBreaker(providerName: string): void {
  breakers.delete(providerName);
}

function isRetryable(err: unknown): boolean {
  const anyErr = err as { name?: string; code?: string; response?: { status?: number } };
  if (anyErr?.name === 'AbortError') return true;
  if (anyErr?.code === 'ECONNABORTED' || anyErr?.code === 'ETIMEDOUT' || anyErr?.code === 'ECONNRESET') return true;
  const status = anyErr?.response?.status;
  if (status === undefined) return true; // no HTTP response at all => network-level failure
  return status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ResilientCallOptions {
  providerName: string;
  timeoutMs: number;
}

export async function resilientCall<T>(
  options: ResilientCallOptions,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const { providerName, timeoutMs } = options;
  const breaker = getBreaker(providerName);

  if (!breaker.canAttempt()) {
    throw ApiError.upstreamUnavailable(`${providerName} is temporarily unavailable`);
  }

  const attempt = async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  };

  const startedAt = Date.now();

  try {
    const result = await attempt();
    breaker.recordSuccess();
    logger.info({ provider: providerName, durationMs: Date.now() - startedAt, outcome: 'success' }, 'provider call');
    return result;
  } catch (firstErr) {
    if (!isRetryable(firstErr)) {
      breaker.recordFailure();
      logger.error(
        { provider: providerName, durationMs: Date.now() - startedAt, outcome: 'failure', err: String(firstErr) },
        'provider call failed (non-retryable)'
      );
      throw ApiError.upstreamFailure(`${providerName} call failed`);
    }

    await sleep(500);

    try {
      const result = await attempt();
      breaker.recordSuccess();
      logger.info(
        { provider: providerName, durationMs: Date.now() - startedAt, outcome: 'success-on-retry' },
        'provider call'
      );
      return result;
    } catch (secondErr) {
      breaker.recordFailure();
      logger.error(
        {
          provider: providerName,
          durationMs: Date.now() - startedAt,
          outcome: 'failure-after-retry',
          err: String(secondErr),
        },
        'provider call failed after one retry'
      );
      throw ApiError.upstreamFailure(`${providerName} call failed after retry`);
    }
  }
}
