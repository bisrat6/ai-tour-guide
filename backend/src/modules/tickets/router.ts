import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { validateTicketSchema } from './schemas.js';
import { validateTicket } from './service.js';
import { env } from '../../config/env.js';

const router = Router();

// In tests, send `x-test-bypass-rate-limit: 1` so suites do not poison each
// other. Production never sets NODE_ENV=test, so the header is inert there.
const bypassInTest = (req: { get: (h: string) => string | undefined }) =>
  process.env['NODE_ENV'] === 'test' && req.get('x-test-bypass-rate-limit') === '1';

// Rate limits: 10/IP/min and an additional 30/museum/min
const ipRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: bypassInTest,
  message: { error: { message: 'Too many requests', code: 'RATE_LIMITED' } },
});

// Per-museum rate limit using the museumId from the body as the key
const museumRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req) => {
    const body = req.body as { museumId?: string };
    return `museum:${body.museumId ?? 'unknown'}`;
  },
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  skip: bypassInTest,
  message: { error: { message: 'Too many requests', code: 'RATE_LIMITED' } },
});

router.post(
  '/tickets/validate',
  ipRateLimit,
  museumRateLimit,
  asyncHandler(async (req, res) => {
    const parsed = validateTicketSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Validation failed', parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));

    const result = await validateTicket(parsed.data.museumId, parsed.data.ticketCode, req.requestId);
    res.json(result);
  }),
);

// ── Stub vendor ──────────────────────────────────────────────────────────────
// Mounted only when ENABLE_STUB_TICKET_VENDOR=true (enforced not to be true in
// production by config/env.ts). Provides a demo validation endpoint that
// exercises the full flow without a real vendor.
if (env.ENABLE_STUB_TICKET_VENDOR) {
  const validCodes = new Set(env.STUB_TICKET_CODES.split(',').map((c) => c.trim()).filter(Boolean));
  const ALWAYS_FAIL_CODE = 'FAIL-ALWAYS';
  const ALWAYS_TIMEOUT_CODE = 'TIMEOUT-ALWAYS';

  router.post(
    '/stub-ticket-vendor',
    asyncHandler(async (req, res) => {
      const { ticketCode } = req.body as { ticketCode?: string };
      if (!ticketCode) {
        res.status(400).json({ valid: false, error: 'ticketCode required' });
        return;
      }

      if (ticketCode === ALWAYS_TIMEOUT_CODE) {
        await new Promise((r) => setTimeout(r, 8_000)); // outlasts the 5 s vendor timeout
      }

      if (ticketCode === ALWAYS_FAIL_CODE) {
        res.json({ valid: false });
        return;
      }

      // Simulate a real vendor: add a small realistic delay
      await new Promise((r) => setTimeout(r, 150));
      res.json({ valid: validCodes.has(ticketCode) });
    }),
  );

  console.log('[tickets] Stub vendor mounted at POST /stub-ticket-vendor');
  console.log(`[tickets] Valid stub codes: ${[...validCodes].join(', ')}, ${ALWAYS_FAIL_CODE} (always fails), ${ALWAYS_TIMEOUT_CODE} (always times out)`);
}

export { router as ticketsRouter };
