/**
 * §8.1: a 15-minute lockout for a given email after 5 consecutive failures.
 * Separate from the per-IP rate limiter in middleware/rateLimit.ts — this
 * tracks failures per *account* regardless of which IP they came from.
 *
 * In-memory, per-process — acceptable for the single-instance deployment
 * this plan targets (§8.5); a multi-instance deployment would need this
 * moved to a shared store.
 */
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface AttemptRecord {
  consecutiveFailures: number;
  lockedUntil: number | null;
}

const attemptsByEmail = new Map<string, AttemptRecord>();

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export function isLockedOut(email: string): boolean {
  const record = attemptsByEmail.get(normalize(email));
  if (!record?.lockedUntil) {
    return false;
  }
  if (Date.now() >= record.lockedUntil) {
    attemptsByEmail.delete(normalize(email));
    return false;
  }
  return true;
}

export function recordLoginFailure(email: string): void {
  const key = normalize(email);
  const record = attemptsByEmail.get(key) ?? { consecutiveFailures: 0, lockedUntil: null };
  record.consecutiveFailures += 1;
  if (record.consecutiveFailures >= LOCKOUT_THRESHOLD) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  attemptsByEmail.set(key, record);
}

export function recordLoginSuccess(email: string): void {
  attemptsByEmail.delete(normalize(email));
}

/** Test-only: clears all tracked attempts so test files don't interfere with each other. */
export function resetLoginAttemptsForTests(): void {
  attemptsByEmail.clear();
}
