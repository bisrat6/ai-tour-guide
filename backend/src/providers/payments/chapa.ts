import { env } from '../../config/env.js';
import { providerCall, UpstreamFailureError } from '../resilience.js';
import type { PaymentProvider } from './types.js';

interface ChapaInitResponse {
  status: string;
  message: string;
  data: { checkout_url: string };
}

interface ChapaVerifyResponse {
  status: string;
  message: string;
  data: {
    tx_ref: string;
    reference?: string;
    amount: string;
    currency: string;
    status: string;
  };
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
          first_name: input.firstName,
          last_name: input.lastName,
          tx_ref: input.txRef,
          return_url: `${input.returnUrl}?tx_ref=${encodeURIComponent(input.txRef)}`,
          customization: {
            // Chapa rejects a title longer than 16 characters.
            title: input.title.slice(0, 16),
            description: input.description,
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

        const json = (await res.json()) as ChapaInitResponse;

        if (!res.ok || json.status !== 'success') {
          throw new UpstreamFailureError(
            `Chapa initialize failed: ${json.message ?? res.statusText}`,
            res.status,
            json,
          );
        }

        return { checkoutUrl: json.data.checkout_url };
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

        const json = (await res.json()) as ChapaVerifyResponse;

        if (!res.ok) {
          throw new UpstreamFailureError(
            `Chapa verify failed: ${json.message ?? res.statusText}`,
            res.status,
            json,
          );
        }

        return {
          status: json.data.status as 'success' | 'pending' | 'failed',
          amount: json.data.amount,
          currency: json.data.currency,
          reference: json.data.reference ?? null,
          raw: json,
        };
      },
    });
  }
}

export const chapaPayment = new ChapaPayment();
