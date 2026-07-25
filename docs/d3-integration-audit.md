# Developer 3 integration: what landed, what changed, what is still open

Developer 3's `Integrations-and-Monetization` branch has been integrated into
`main`. This document records how, because it was a port rather than a merge,
and because several known defects were carried across deliberately rather than
fixed.

## 1. Why this was a port, not a merge

The branch was cut from `a0c2b0a`, the last commit before `backend/` existed. It
therefore built a second, parallel backend: its own `package.json`,
`tsconfig.json`, `prisma/schema.prisma`, `app.ts`, `config/env.ts`, error
classes, `requireAuth`, `requireRole`, `errorHandler`, `requestId`, `logger`,
`prisma` client, and test harness.

`git merge` produced 22 add/add conflicts, every one of them on that shared
foundation. None of them were genuine disagreements. Developer 3 had stubbed the
foundation on purpose and said so in the code — `middleware/requireAuth.ts`
carried the comment:

> This file is a stub owned by Dev 1. [...] Dev 1 replaces the token
> verification with full bcrypt + real flow; the `req.admin` shape and the
> suspended-museum check stay identical.

and the room-create route said "Move this stub to the real route in Phase 4". So
the integration `main` needed was: keep `main`'s foundation, take Developer 3's
feature modules, and adapt them.

Two things on the branch were deliberately **not** taken:

- It **deleted all four `data/*.json` and `data/*.md` files**. `main`'s seed
  script reads those, so taking the deletion would have broken seeding.
- Its root `backend-implementation-plan.md` is byte-identical to `main`'s
  `docs/backend-implementation-plan.md`.

## 2. What was ported

| Area              | Files                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Billing           | `src/modules/billing/{schemas,tiers,service,router,reconcile}.ts`                                                                                        |
| Ticketing         | `src/modules/tickets/{schemas,service,router}.ts`                                                                                                        |
| Payment providers | `src/providers/payments/{types,fake,chapa,index}.ts`                                                                                                     |
| Ticket providers  | `src/providers/ticketing/{types,fake,http,index}.ts`                                                                                                     |
| Shared            | `src/providers/resilience.ts`, `src/lib/ssrfGuard.ts`, `src/lib/resolveMuseum.ts`                                                                        |
| Middleware        | `src/middleware/requireWithinTierLimit.ts`                                                                                                               |
| CLI               | `scripts/reconcile-payments.ts` (`npm run reconcile`)                                                                                                    |
| Schema            | `SubscriptionTier`, `SubscriptionStatus`, `PaymentStatus`, `TierPricing`, `Payment`, four `Museum` billing columns, nullable `AdminAuditLog.adminUserId` |
| Tests             | `tests/integration/{billing,tickets,tierLimits}.test.ts` — 53 cases                                                                                      |

Routes added: `GET/POST /admin/billing/{plans,checkout,status,tier}`,
`GET /admin/billing/payments/:txRef`, and the visitor-facing
`POST /tickets/validate`.

Dropped, as agreed: `src/modules/dev/router.ts`, the `POST /dev/rooms` stub, and
the branch's `Dockerfile`/`.dockerignore`.

## 3. Adaptations required

**Prisma 5 → 7.** The branch declared `url = env("DATABASE_URL")` in the
datasource; `main` resolves that through `prisma.config.ts` for the driver-adapter
setup. The branch also shipped **no migration SQL at all** — only
`migration_lock.toml` — so `20260725195617_add_billing_and_ticketing` was
generated here. It is additive: new enums and tables, new columns with defaults,
and one `DROP NOT NULL`. No data loss.

**Error API.** `main`'s `ApiError` exposes `status`, not `statusCode`, and details
shaped `{ path, message }` rather than `{ field, message }`. Every throwing call
site was remapped: `badRequest` → `validation`, `crossTenantAccess` →
`crossTenant`, `notFound('Payment')` → `notFound('Payment not found.')`. The five
new codes and helpers (`tierLimitExceeded`, `subscriptionInactive`,
`paymentAlreadyPending`, `paymentNotFound`, `ticketUrlInvalid`) were added to
`src/shared/errorEnvelope.ts` and `src/lib/errors.ts`. Because
`tierLimitExceeded` now uses `main`'s detail shape, the limit numbers arrive as
four `{ path, message }` entries rather than one merged object.

**Typing.** `main` declares `admin?: AdminContext`, so the ported routes narrow
it with `if (!req.admin) throw ApiError.unauthenticated()` like every other
route here, instead of reading `req.admin.role` unguarded.

**Environment.** `main` treats provider credentials as optional-until-needed so
tests and the fake provider need no accounts. `CHAPA_SECRET_KEY` and
`CHAPA_RETURN_URL` are therefore optional, with a boot guard that rejects a
missing value when `PAYMENTS_PROVIDER=chapa`. Developer 3's production guards
(no stub vendor, no private-IP egress, no sandbox key) were kept.

**Rate limiting.** The ticket limiters use `main`'s `createRateLimiter` so
failures come back in the standard error envelope. That factory gained an
optional `keyGenerator` for the per-museum bucket. Note the consequence: like
`main`'s login limiter, these are skipped when `NODE_ENV=test`, so the branch's
429 test could not be ported. Ticket rate limiting is **not covered by automated
tests**.

**Test harness.** The branch's `globalSetup.ts`, `setupEnv.ts`, and
`helpers/{app,auth,db}.ts` were dropped in favour of `main`'s `testEnv.ts` and
`helpers/{db,scenario}.ts`. Its `helpers/db.ts` truncated a `PaymentWebhookEvent`
table that exists in no schema, and `billing-api.test.ts` was an empty file.
`resetBreakersForTests()` was added to `resilience.ts` because the circuit
breaker is process-global and would otherwise leak between test files.

### Small corrections made while porting

Three deviations from a literal port, all outside the money path:

1. **Timeout detection in `providerCall`.** The original tested
   `err.message.includes('timeout')` or `code === 'ABORT_ERR'`, which Node's
   `fetch` abort does not usually set, so timeouts were never retried. Now also
   checks `signal.aborted` and `AbortError`.
2. **`ApiError` passthrough in the ticket service.** `ssrfGuard` throws a 422
   `TICKET_URL_INVALID` from inside the provider call, which the original
   `catch` reclassified as a 502. That code could never reach a client.
3. **Stale poll response.** `GET /admin/billing/payments/:txRef` reported the
   museum tier read _before_ verification, so a client polling at the moment of
   upgrade saw the old tier. Both rows are now re-read after applying.

## 4. Defects found on the branch

Ten issues were found while reviewing the branch. The port itself deliberately
changed none of them, so that the integration and the behaviour changes stayed
separable. They were then fixed in a follow-up commit, which is what §4.1
records; §4.2 lists what is still open and why.

### 4.1 Fixed

| #   | Severity     | Issue and fix                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Critical** | `PAYMENTS_PROVIDER` defaulted to `fake` and nothing refused `fake` in production, so a deploy that forgot the variable would have granted paid tiers with no money taken. `config/env.ts` now refuses to boot a production process with the fake provider — including the case where the variable is simply absent and the default applies.                                                                                                                              |
| 2   | **High**     | `EXPIRED` and `FAILED` were terminal, so a payment wrongly moved there could never be recovered. `PAID` is now the only terminal status: `applyPaidPayment` re-verifies anything else, clears the stale `failureReason` when it succeeds, and `GET /admin/billing/payments/:txRef` re-verifies any non-`PAID` row rather than only `PENDING` ones.                                                                                                                       |
| 3   | **High**     | `expireAbandoned` treated a _verify error_ as abandonment, so a vendor 5xx at the 24-hour cutoff marked genuinely paid transactions `EXPIRED`. An error now leaves the row `PENDING` for the next run and increments the new `verifyErrors` stat. `UNVERIFIABLE_AGE_MS` (7 days) is the backstop, and expiring on it records a reason that says the payment was never _verified_, not never _made_. A provider that reports paid but cannot be applied is never expired. |
| 4   | **High**     | The expire-versus-apply race stranded paid transactions when the sweep won. Every status transition is now conditional on `status != 'PAID'` instead of `status = 'PENDING'`, so an in-flight apply still wins after a sweep has retired the row, while a second apply of an already-paid row still updates nothing.                                                                                                                                                     |
| 6   | Medium       | `requireWithinTierLimit`'s `item` branch silently passed when the body had no `roomId` — omitting the field bypassed the cap — and never checked the room belonged to the resolved museum. It now rejects a missing `roomId` and scopes the room lookup to the museum.                                                                                                                                                                                                   |
| 8   | Low          | Amount comparison went through `parseFloat`, which accepts `4500.004` as `4500.00` and reads `'4500abc'` as `4500`. It now compares `Prisma.Decimal` values, treating an unparseable amount as a mismatch.                                                                                                                                                                                                                                                               |

### 4.2 Still open

| #   | Severity | Issue                                                                                                                                                                                                                                                                                                                |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Medium   | `requireWithinTierLimit` counts then creates without a lock, so two concurrent creates can both pass a check at the cap. Fixing it properly means moving the check inside the create transaction, which is a change to the create routes rather than to the middleware — and the middleware is not mounted yet (§5). |
| 7   | Medium   | No payment webhook exists: entitlement depends on the return-page poll plus the cron reconciler. This is a missing feature rather than a defect in what was ported, and it needs a Chapa webhook secret and an endpoint contract before it can be built.                                                             |
| 9   | Low      | The circuit breaker's half-open state admits all traffic after 30s rather than a single probe. A deliberate simplicity trade-off; it self-corrects on the next failure.                                                                                                                                              |
| 10  | Low      | `ssrfGuard` re-checks DNS per call but cannot close the rebinding window between its lookup and `fetch`'s connect. Closing it needs a custom socket-level connect hook, which is disproportionate for admin-supplied vendor URLs that are also rate-limited.                                                         |

## 5. Tier limits are still not enforced

`requireWithinTierLimit` is ported, fixed, and tested but **mounted on no
route**.

`TIER_LIMITS` allows BASIC a single room and a single admin user, while both
seeded demo museums have four rooms, and `main`'s existing suites create several
rooms and admins per museum. Mounting the guard on `POST /admin/rooms` and
`POST /admin/museums/:id/admins` as written would immediately reject the seed
data and break those suites.

So the numbers need revisiting before enforcement — most likely raising BASIC,
or grandfathering existing content. `tests/integration/tierLimits.test.ts`
proves the middleware behaves correctly, driving it through a minimal app built
from the same pieces a real route would use, so wiring it up later is a small
change. Note that mounting it is also the point at which issue 5 above, the
count-then-create race, needs resolving.

## 6. Verification

Everything below was run against the integrated tree, after the §4.1 fixes:

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run format` — clean
- `npm test` — 144 passed, 1 todo. 71 before the port, 53 added by it, 20 more
  covering the fixes
- `npm run seed` — both museums and all three pricing rows seed
- `npm run reconcile -- --dry-run --sweep` — runs clean, now also reporting
  `verifyErrors`
- `npm run generate:openapi` — the only drift is the five new error codes, committed

The fixes are covered by regression tests rather than left to inspection:
recovery from `EXPIRED` and `FAILED`, `PAID` staying terminal, an apply racing
an expiry sweep, a verify error not expiring a stale payment and that same
payment being recovered on a later run, the 7-day backstop and its distinct
reason, both decimal amount cases, the four production boot guards, and the
`item` tier branch including a cross-museum `roomId`.

The billing and ticket routes are **not** in `openapi/openapi.yaml`; only the
error-code enum grew. Adding them is outstanding.
