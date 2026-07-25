import type { TicketProvider } from './types.js';
import { providerCall, UpstreamFailureError } from '../resilience.js';
import { ssrfGuard } from '../../lib/ssrfGuard.js';

export class HttpTicket implements TicketProvider {
  readonly name = 'http-ticket';

  async validate(
    input: Parameters<TicketProvider['validate']>[0],
  ): Promise<{ valid: boolean }> {
    const { endpointUrl, ticketCode, secret, signal } = input;

    // Guard every outbound call — DNS can be re-pointed after save-time validation
    await ssrfGuard(endpointUrl);

    return providerCall({
      name: 'ticket-vendor',
      operation: 'validate',
      timeoutMs: Number(process.env['TICKET_VENDOR_TIMEOUT_MS'] ?? 5_000),
      fn: async (abortSignal) => {
        const effectiveSignal = signal ?? abortSignal;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (secret) headers['Authorization'] = `Bearer ${secret}`;

        const res = await fetch(endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ticketCode }),
          signal: effectiveSignal,
          redirect: 'manual', // Never follow redirects — could redirect to a private address
        });

        if (!res.ok) {
          throw new UpstreamFailureError(`Ticket vendor returned ${res.status}`, res.status);
        }

        // Cap response body — vendor errors can sometimes contain ticket-holder PII
        const text = await res.text();
        if (text.length > 64 * 1024) {
          throw new UpstreamFailureError('Ticket vendor response too large');
        }

        const json = JSON.parse(text) as { valid?: boolean };
        return { valid: Boolean(json.valid) };
      },
    });
  }
}

export const httpTicket = new HttpTicket();
