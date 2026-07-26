import { Router } from 'express';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { validateTicketRequestSchema } from './schemas.js';
import { validateTicket } from './service.js';

export const ticketsRouter = Router();

// Visitor-facing and unauthenticated, so it carries two limits: one per caller,
// and one per museum so a single tenant cannot exhaust the vendor's allowance.
const perIpLimit = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  message: 'Too many ticket checks from this address. Try again shortly.',
});

const perMuseumLimit = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many ticket checks for this museum. Try again shortly.',
  // Buckets on whichever identifier the caller sent. Resolving a waypoint to
  // its museum first would mean a database round trip before the limiter, so a
  // room-level bucket is used instead: narrower than per-museum, and still one
  // bucket per caller-supplied target rather than a shared 'unknown'.
  keyGenerator: (req) => {
    const body = req.body as { museumId?: string; waypointId?: string };
    if (body.museumId !== undefined) return `museum:${body.museumId}`;
    if (body.waypointId !== undefined) return `waypoint:${body.waypointId}`;
    return 'ticket-target:unknown';
  },
});

ticketsRouter.post(
  '/tickets/validate',
  perIpLimit,
  perMuseumLimit,
  asyncHandler(async (req, res) => {
    const body = validateTicketRequestSchema.parse(req.body);
    const target =
      body.museumId !== undefined
        ? { museumId: body.museumId }
        : { waypointId: body.waypointId as string };
    res.json(await validateTicket(target, body.ticketCode, req.requestId));
  }),
);

/**
 * Demo vendor, mounted only when ENABLE_STUB_TICKET_VENDOR is on — which
 * config/env.ts refuses to allow in production. It exists so the whole
 * validation path can be exercised without a real vendor account.
 */
if (env.ENABLE_STUB_TICKET_VENDOR) {
  const validCodes = new Set(
    env.STUB_TICKET_CODES.split(',')
      .map((code) => code.trim())
      .filter(Boolean),
  );
  const ALWAYS_FAIL_CODE = 'FAIL-ALWAYS';
  const ALWAYS_TIMEOUT_CODE = 'TIMEOUT-ALWAYS';

  ticketsRouter.post(
    '/stub-ticket-vendor',
    asyncHandler(async (req, res) => {
      const { ticketCode } = req.body as { ticketCode?: string };
      if (!ticketCode) {
        res.status(400).json({ valid: false, error: 'ticketCode required' });
        return;
      }

      if (ticketCode === ALWAYS_TIMEOUT_CODE) {
        // Deliberately outlasts TICKET_VENDOR_TIMEOUT_MS.
        await new Promise((resolve) => setTimeout(resolve, env.TICKET_VENDOR_TIMEOUT_MS + 3000));
      }
      if (ticketCode === ALWAYS_FAIL_CODE) {
        res.json({ valid: false });
        return;
      }

      // A little latency, so the stub behaves like something over a network.
      await new Promise((resolve) => setTimeout(resolve, 150));
      res.json({ valid: validCodes.has(ticketCode) });
    }),
  );
}
