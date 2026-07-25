import { env } from '../../config/env.js';
import { ssrfGuard } from '../../lib/ssrfGuard.js';
import { providerCall, UpstreamFailureError } from '../resilience.js';
import type { TicketProvider } from './types.js';

const MAX_RESPONSE_BYTES = 64 * 1024;

export class HttpTicket implements TicketProvider {
  readonly name = 'http-ticket';

  async validate(input: Parameters<TicketProvider['validate']>[0]): Promise<{ valid: boolean }> {
    const { endpointUrl, ticketCode, secret, signal } = input;

    // Re-checked on every call, not just when the URL is saved: DNS can be
    // re-pointed at a private address afterwards.
    await ssrfGuard(endpointUrl);

    return providerCall({
      name: 'ticket-vendor',
      operation: 'validate',
      timeoutMs: env.TICKET_VENDOR_TIMEOUT_MS,
      fn: async (abortSignal) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (secret) headers['Authorization'] = `Bearer ${secret}`;

        const res = await fetch(endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ticketCode }),
          signal: signal ?? abortSignal,
          // A redirect could point at a private address the guard already cleared.
          redirect: 'manual',
        });

        if (!res.ok) {
          throw new UpstreamFailureError(`Ticket vendor returned ${res.status}`, res.status);
        }

        // Capped because vendor error bodies have been known to echo
        // ticket-holder personal data.
        const text = await res.text();
        if (text.length > MAX_RESPONSE_BYTES) {
          throw new UpstreamFailureError('Ticket vendor response too large');
        }

        let parsed: { valid?: boolean };
        try {
          parsed = JSON.parse(text) as { valid?: boolean };
        } catch {
          throw new UpstreamFailureError('Ticket vendor returned a non-JSON body');
        }

        return { valid: Boolean(parsed.valid) };
      },
    });
  }
}

export const httpTicket = new HttpTicket();
