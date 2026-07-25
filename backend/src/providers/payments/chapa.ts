import { env } from '../../config/env.js';
import { providerCall, UpstreamFailureError } from '../resilience.js';
import type { PaymentProvider } from './types.js';

interface ChapaInitResponse {
  status?: string;
  message?: string;
  data?: { checkout_url?: string } | null;
}

interface ChapaVerifyResponse {
  status?: string;
  message?: string;
  data?: {
    tx_ref?: string;
    reference?: string;
    amount?: string | number;
    currency?: string;
    status?: string;
  } | null;
}

/** Chapa caps these two; anything longer comes back as a validation error. */
const MAX_TITLE = 16;
const MAX_DESCRIPTION = 50;

/**
 * Chapa rejects titles and descriptions carrying punctuation it does not
 * expect, and truncating mid-way is better than a failed checkout.
 */
function sanitizeCustomization(value: string, max: number, fallback: string): string {
  const cleaned = value
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Chapa answers some failures with an HTML error page rather than JSON, and an
 * unparsed body would surface as a SyntaxError with none of the vendor's own
 * wording — which is exactly the wording an operator needs.
 */
async function readJson<T>(res: Response): Promise<{ json: T | null; text: string }> {
  const text = await res.text();
  if (text.trim().length === 0) return { json: null, text };
  try {
    return { json: JSON.parse(text) as T, text };
  } catch {
    return { json: null, text };
  }
}

/**
 * A rejected key is a deployment mistake, not a flaky vendor, and it stays
 * broken until someone edits the environment. Saying so in the error beats
 * "upstream call failed", which sent the last operator hunting for an outage
 * when the real cause was a CHAPUBK_ public key pasted where the CHASECK_
 * secret key belongs.
 */
/**
 * Chapa reports a settled transaction as 'success' on verify but as 'paid' in
 * some responses, and anything it has not settled must read as pending: only
 * an explicit refusal should mark a payment failed, since that write is what
 * stops the reconciler from retrying.
 */
function normalizeVerifyStatus(raw: string | undefined): 'success' | 'pending' | 'failed' {
  switch ((raw ?? '').toLowerCase()) {
    case 'success':
    case 'paid':
    case 'completed':
      return 'success';
    case 'failed':
    case 'cancelled':
    case 'canceled':
    case 'refunded':
      return 'failed';
    default:
      return 'pending';
  }
}

function describeFailure(operation: string, status: number, message: string): string {
  if (status === 401 || status === 403) {
    return `Chapa rejected the API key (${message}). CHAPA_SECRET_KEY must be the secret key, which starts with CHASECK_ — a CHAPUBK_ public key cannot authorize server-side calls.`;
  }
  return `Chapa ${operation} failed: ${message}`;
}

/**
 * Chapa adapter (dev3 §4.2). Both calls go through providerCall, so they carry
 * a timeout, one retry on 5xx/timeout, and the shared circuit breaker.
 */
export class ChapaPayment implements PaymentProvider {
  readonly name = 'chapa';

  /**
   * The key is optional in the env schema so the fake provider works without a
   * Chapa account. config/env.ts refuses to boot when this provider is selected
   * without one, so reaching the throw here means the env was bypassed.
   */
  private requireSecretKey(): string {
    const secretKey = env.CHAPA_SECRET_KEY;
    if (!secretKey) {
      throw new UpstreamFailureError('CHAPA_SECRET_KEY is not configured');
    }
    return secretKey;
  }

  async initialize(
    input: Parameters<PaymentProvider['initialize']>[0],
  ): Promise<{ checkoutUrl: string; providerRef?: string }> {
    const secretKey = this.requireSecretKey();

    return providerCall({
      name: 'chapa',
      operation: 'initialize',
      timeoutMs: env.CHAPA_TIMEOUT_MS,
      fn: async (signal) => {
        const body = JSON.stringify({
          amount: input.amount,
          currency: input.currency,
          email: input.email,
          first_name: sanitizeCustomization(input.firstName, 30, 'Museum'),
          last_name: sanitizeCustomization(input.lastName, 30, 'Admin'),
          tx_ref: input.txRef,
          // The reference travels on the return URL so the console can verify
          // even when it lands without the query Chapa normally appends.
          return_url: `${input.returnUrl}?tx_ref=${encodeURIComponent(input.txRef)}`,
          customization: {
            title: sanitizeCustomization(input.title, MAX_TITLE, 'Subscription'),
            description: sanitizeCustomization(
              input.description,
              MAX_DESCRIPTION,
              'Museum subscription',
            ),
          },
        });

        const res = await fetch(`${env.CHAPA_BASE_URL}/transaction/initialize`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body,
          signal: input.signal ?? signal,
        });

        const { json, text } = await readJson<ChapaInitResponse>(res);
        const message = json?.message ?? (res.ok ? 'unexpected response' : res.statusText || text);

        if (!res.ok || json?.status !== 'success') {
          throw new UpstreamFailureError(
            describeFailure('initialize', res.status, message),
            res.status,
            json ?? text,
          );
        }

        const checkoutUrl = json.data?.checkout_url;
        if (!checkoutUrl) {
          throw new UpstreamFailureError(
            'Chapa accepted the payment but returned no checkout URL.',
            res.status,
            json,
          );
        }

        return { checkoutUrl };
      },
    });
  }

  async verify(txRef: string, signal?: AbortSignal): ReturnType<PaymentProvider['verify']> {
    const secretKey = this.requireSecretKey();

    return providerCall({
      name: 'chapa',
      operation: 'verify',
      timeoutMs: env.CHAPA_TIMEOUT_MS,
      fn: async (abortSignal) => {
        const res = await fetch(
          `${env.CHAPA_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
          {
            headers: { Authorization: `Bearer ${secretKey}` },
            signal: signal ?? abortSignal,
          },
        );

        const { json, text } = await readJson<ChapaVerifyResponse>(res);

        if (!res.ok) {
          throw new UpstreamFailureError(
            describeFailure('verify', res.status, json?.message ?? (res.statusText || text)),
            res.status,
            json ?? text,
          );
        }

        const txn = json?.data;
        if (!txn) {
          // A 200 with no transaction body means Chapa has not settled it yet.
          // Reporting that as pending keeps the reconciler on the case instead
          // of marking a payment failed on a shape we did not expect.
          return { status: 'pending', amount: '0', currency: 'ETB', reference: null, raw: json };
        }

        return {
          status: normalizeVerifyStatus(txn.status),
          amount: String(txn.amount ?? ''),
          currency: txn.currency ?? '',
          reference: txn.reference ?? null,
          raw: json,
        };
      },
    });
  }
}

export const chapaPayment = new ChapaPayment();
