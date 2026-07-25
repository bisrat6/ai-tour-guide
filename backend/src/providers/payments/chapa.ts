import type { PaymentProvider } from './types.js';
import { providerCall, UpstreamFailureError } from '../resilience.js';
import { env } from '../../config/env.js';

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

export class ChapaPayment implements PaymentProvider {
  readonly name = 'chapa';

  async initialize(
    input: Parameters<PaymentProvider['initialize']>[0],
  ): Promise<{ checkoutUrl: string; providerRef?: string }> {
    return providerCall({
      name: 'chapa',
      operation: 'initialize',
      timeoutMs: env.CHAPA_TIMEOUT_MS,
      fn: async (signal) => {
        // Chapa enforces a 16-character limit on customization.title
        const title = input.title.slice(0, 16);

        const body = JSON.stringify({
          amount: input.amount,
          currency: input.currency,
          email: input.email,
          first_name: input.firstName,
          last_name: input.lastName,
          tx_ref: input.txRef,
          return_url: `${input.returnUrl}?tx_ref=${encodeURIComponent(input.txRef)}`,
          customization: { title, description: input.description },
        });

        const res = await fetch(`${env.CHAPA_BASE_URL}/transaction/initialize`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.CHAPA_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body,
          signal,
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

  async verify(
    txRef: string,
    signal?: AbortSignal,
  ): ReturnType<PaymentProvider['verify']> {
    return providerCall({
      name: 'chapa',
      operation: 'verify',
      timeoutMs: env.CHAPA_TIMEOUT_MS,
      fn: async (abortSignal) => {
        const effectiveSignal = signal ?? abortSignal;
        const res = await fetch(
          `${env.CHAPA_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
          {
            headers: { Authorization: `Bearer ${env.CHAPA_SECRET_KEY}` },
            signal: effectiveSignal,
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

        const txStatus = json.data.status as 'success' | 'pending' | 'failed';
        return {
          status: txStatus,
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
