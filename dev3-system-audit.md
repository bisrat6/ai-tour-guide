# Dev 3 System Audit — Integrations & Monetization

**Branch:** `Integrations-and-Monetization`
**Scope of this document:** the Dev 3 track only — billing, payments, ticket validation, and subscription tier enforcement. Dev 1 and Dev 2 code is referenced only where their branches must interoperate with this one.
**Audience:** the developer performing the merge, and the reviewer signing it off.
**Audit date:** 25 July 2026.

---

## 1. Executive summary

The Dev 3 track is **code-complete and internally tested, but the live payment path has never once executed successfully.** Everything that can be proven with a fake provider is proven. Nothing that requires a real Chapa credential has been proven, because a valid secret key has never been present in the environment.

| Area | State | Confidence |
|---|---|---|
| Error envelope, request IDs, config validation | Built, tested | High |
| Data model and migrations | Built, applied clean from empty volume | High |
| Ticket validation, SSRF guard | Built, tested | High |
| Tier limits and subscription gating | Built, tested | High |
| Billing reads (plans, status, payment status) | Built, tested | High |
| Checkout against the **fake** provider | Built, tested | High |
| Checkout against **real Chapa** | Built, **never executed** | **None** |
| Reconciler | Built, smoke-run against an empty table only | Low |
| Auth | **Stub owned by Dev 1**, not production code | N/A |

**Three items must be resolved before this branch is merged.** They are detailed in section 8: the Prisma migration SQL is excluded from version control (D1), the `lint` script cannot execute (D2), and a provider failure at checkout is reported as an internal server error rather than an upstream failure (D3).

---

## 2. Scope and boundaries

### 2.1 Owned by this track

- Subscription tiers, pricing, and limit enforcement.
- Chapa payment initialization, verification, and reconciliation.
- Third-party ticket validation, including the SSRF guard on admin-supplied URLs.
- The shared error envelope, error code registry, request ID propagation, and environment validation.
- The Prisma schema, migrations, and seed.

### 2.2 Deliberately stubbed, and owned by others

| File | Owner | What it is |
|---|---|---|
| `src/middleware/requireAuth.ts` | Dev 1 | JWT verification shaped to Dev 1's expected contract. Carries an in-file comment marking it a stub so it cannot quietly reach production. |
| `src/modules/dev/router.ts` → `POST /dev/login` | Dev 1 | Mints a token for any seeded admin by email, no password. Stands in for `POST /admin/login`. |
| `POST /dev/rooms` in `src/app.ts` | Dev 1 | Exists solely to exercise `requireWithinTierLimit` before the real `POST /admin/rooms` exists. |

All three are mounted **only when `NODE_ENV !== 'production'`**. The guard is in `src/app.ts`. They must be deleted, not merely disabled, once Dev 1's real routes land.

### 2.3 Removed from scope

Webhooks. There is no webhook route and no `verifyWebhookSignature` on the payment provider interface. The consequence is architectural and is covered in section 5.

---

## 3. API surface

Seven production endpoints and three development-only endpoints. Every non-2xx response is produced by the single terminal handler in `src/middleware/errorHandler.ts`; no other code writes an error body.

### 3.1 Production

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | Performs a real `SELECT 1`, so it fails when the database is unreachable rather than reporting a false positive. Returns `dbLatencyMs`. |
| GET | `/admin/billing/plans` | any admin | `TierPricing` joined with `TIER_LIMITS`. Unlimited serializes as `null`. |
| POST | `/admin/billing/checkout` | museum or system admin | Returns `201` with `txRef`, `checkoutUrl`, `amountEtb`, `currency`, `tier`, `expiresHint`. |
| GET | `/admin/billing/status` | museum or system admin | Own museum only. Cursor-paginated payment history, `limit` default 10, max 50. |
| GET | `/admin/billing/payments/:txRef` | museum or system admin | The route the return page polls. Triggers a live verify once the payment is older than 5 seconds. |
| POST | `/admin/billing/tier` | **system admin only** | Manual override. `reason` is mandatory, minimum 10 characters, written to the audit log. Returns `{ success: true }` and nothing else. |
| POST | `/tickets/validate` | **none — public** | A visitor has no account. Rate limited 10/IP/minute and 30/museum/minute. |

### 3.2 Development only

| Method | Path | Mounted when |
|---|---|---|
| POST | `/dev/login` | `NODE_ENV !== 'production'` |
| POST | `/dev/rooms` | `NODE_ENV !== 'production'` |
| POST | `/stub-ticket-vendor` | `ENABLE_STUB_TICKET_VENDOR=true` |

The stub vendor is not registered at all when the flag is off. It does not exist and return `403`; the route is absent. `config/env.ts` additionally refuses to boot production with the flag enabled, so there are two independent barriers.

### 3.3 Error codes owned or extended by this track

Defined in `src/lib/errors.ts`. The shared v2 set is `VALIDATION_ERROR`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `CROSS_TENANT_ACCESS`, `NOT_FOUND`, `CONFLICT`, `ROOM_REFERENCED`, `INVALID_ROOM_SEQUENCE`, `RATE_LIMITED`, `INTERNAL_ERROR`, `UPSTREAM_FAILURE`, `UPSTREAM_UNAVAILABLE`. This track adds five:

| Code | Status | Meaning |
|---|---|---|
| `TIER_LIMIT_EXCEEDED` | 403 | Plan cap reached. `details[0]` carries `limit`, `tier`, `allowed`, `current` so the client can render an upgrade prompt instead of a dead end. |
| `SUBSCRIPTION_INACTIVE` | 403 | Subscription is not `ACTIVE`. Blocks creates only. |
| `PAYMENT_ALREADY_PENDING` | 409 | Redundant checkout on the current tier with renewal more than 7 days out. |
| `PAYMENT_NOT_FOUND` | 404 | Unknown `txRef`. |
| `TICKET_URL_INVALID` | 422 | `ticketValidationUrl` failed the SSRF guard at save time. |

**Known contract drift with Dev 1:** validation `details` entries use the key `field` in this implementation. Dev 1's OpenAPI document declares `path`. One side must change and the choice must be recorded, because clients will read whichever ships. This is unresolved and is not a Dev 3 decision to make alone.

---

## 4. Data model

### 4.1 Models introduced by this track

**`TierPricing`** — keyed by tier. Holds `amountEtb` as `Decimal(10,2)`, `periodDays`, display strings, and an `active` flag.

**`Payment`** — the billing record. Unique `txRef`, `status` in `PENDING | PAID | FAILED | EXPIRED`, plus `periodStart` and `periodEnd` so the period each payment purchased is stored rather than recomputed. `failureReason` retains why a failure happened for support queries. `onDelete: Restrict` against `Museum`, because deleting a museum must not silently erase its financial history.

### 4.2 Deliberate split between code and data

Prices live in `TierPricing` in the database. Limits live in `TIER_LIMITS` in `src/modules/billing/tiers.ts`. This is intentional: a price change should be a data edit, while a limit change should require a code review and a test run.

| Tier | maxRooms | maxItemsPerRoom | maxAdminUsers | Seeded price (ETB) |
|---|---|---|---|---|
| BASIC | 1 | 20 | 1 | 1500.00 |
| PRO | 3 | 50 | 5 | 4500.00 |
| ENTERPRISE | unlimited (`null`) | unlimited | unlimited | 12000.00 |

`null` means unlimited and **must serialize as `null`, never `Infinity`** — `Infinity` is not valid JSON and emits a bare token that breaks strict parsers. There is a test asserting the response body contains no `Infinity`.

The seeded prices are placeholders (open question Q1) and are not commercially approved.

### 4.3 Fields added to shared models

`Museum` gains `tier`, `subscriptionStatus`, `subscriptionRenewsAt`, and `billingEmail`, plus an index on `[subscriptionStatus, subscriptionRenewsAt]` for the reconciler's sweep.

### 4.4 A schema change that affects Dev 2 directly

**`AdminAuditLog.adminUserId` is nullable in this branch, with `onDelete: SetNull`.** It was originally required with `onDelete: Cascade`. That was wrong in two ways: the reconciler applies payments with no human actor and so has nothing to name, and an audit trail should outlive the account that produced it.

Dev 2's branch requires this column. **The two cannot both be satisfied** — this is a genuine merge conflict, not a formatting difference, and it needs an explicit decision. The recommendation from this side is to keep it nullable and have Dev 2 treat `null` as "system actor", because the alternative forces the reconciler to invent a fake user row to satisfy a foreign key.

### 4.5 Migrations

Three migrations: `20260725124809_init`, `20260725130058_drop_webhook_events`, `20260725130802_nullable_audit_actor`.

They apply cleanly onto an empty volume — this was re-verified during the audit by a `migrate deploy` against a fresh test database. **However, the SQL files are not in version control.** See defect D1; this is the highest-priority merge blocker.

---

## 5. How a payment becomes an entitlement

With webhooks removed, there are exactly two paths from `PENDING` to `PAID`, and **both funnel through the single function `applyPaidPayment(txRef)`** in `src/modules/billing/service.ts`. That convergence is the design's most important property: there is one place where a tier is granted, so there is one place to audit, one place to make idempotent, and one place to get right.

1. **Lazy verify on poll.** `GET /admin/billing/payments/:txRef` verifies against Chapa once the payment is older than 5 seconds. Only runs while an admin has the return page open.
2. **The reconciler.** `scripts/reconcile-payments.ts`, run on a schedule.

`applyPaidPayment` compares **status, amount, and currency** against the server-side record before granting anything. A mismatch marks the payment `FAILED`, logs loudly, and does not upgrade. A client-supplied value never grants an entitlement.

Concurrency and idempotency are tested: applying the same payment twice produces exactly one upgrade and one audit row, and two concurrent applies produce exactly one upgrade.

### 5.1 An operational requirement, not a nicety

**The reconciler is load-bearing.** If an admin closes the tab mid-payment, the poll never runs and the reconciler is the only remaining path. Without it scheduled, that payment sits `PENDING` forever and the museum never receives the tier it paid for. It must run every 10–15 minutes in any environment handling real money. Whoever owns deployment must schedule it; nothing in the application does so automatically.

Its behaviour: `PENDING` between 5 minutes and 24 hours old is verified and applied; past 24 hours it is verified once more before being marked `EXPIRED`, so a payment that succeeded while both the poll and the operator were asleep is recovered rather than written off. `--sweep` flips lapsed `ACTIVE` museums to `PAST_DUE`. `--dry-run` reports without writing.

---

## 6. Security posture

**Tenant isolation.** `src/lib/resolveMuseum.ts` resolves the museum from the database record being acted upon, never from the request body. Both Dev 1's `requireMuseumScope` and this track's `requireWithinTierLimit` must call it. If they diverge, one of them will have a bypass.

Two distinct behaviours, deliberately different:
- `GET /admin/billing/status?museumId=<other>` returns `200` scoped to **your own** museum. A stray parameter is ignored, not honoured. Tests assert the response *contents*, because a `200` carrying another tenant's data is the actual bug being hunted.
- `GET /admin/billing/payments/:txRef` returns `403 CROSS_TENANT_ACCESS`. A payment is addressed directly, so there is nothing to scope and refusal is the only correct answer.

**SSRF.** `ticketValidationUrl` is admin-supplied and therefore hostile input. `src/lib/ssrfGuard.ts` rejects link-local (`169.254.169.254`), loopback, `10/8`, `172.16/12`, `192.168/16`, and non-HTTP schemes such as `file://`. It runs **on every outbound call**, not only at save time, because DNS can be re-pointed between validation and use. `OUTBOUND_HTTP_ALLOW_PRIVATE_IPS` relaxes it for local development and `config/env.ts` refuses to boot production with it enabled.

**Never fail open.** A ticket vendor that is down produces `502`. A gate that passes when the vendor is unreachable is decorative. Tests cover vendor timeout and vendor `500`, asserting `502` and never `valid: true`.

**A lapsed subscription never affects visitors.** `PAST_DUE` blocks creates only. Reads and updates are untouched, so visitors keep seeing published content. Punishing the public for a museum's billing lapse is the worst outcome this track could produce.

**Limits bind the museum, not the caller.** A system admin is *not* exempt from tier limits. A system admin who needs a fourth room raises the tier through `POST /admin/billing/tier`, which is audit-logged, rather than quietly overshooting the plan. `PATCH` is never gated, so a downgrade never deletes existing content.

**Secrets.** No secret is logged. Upstream response bodies are never forwarded to clients; there is a test asserting the raw provider message does not appear in the response. `.env` is gitignored and `.env.example` carries placeholders only.

---

## 7. Verification status

### 7.1 What the suite covers

Run with `docker compose exec api npm test` (Vitest, single fork, non-parallel, against the `db-test` container).

| File | Covers |
|---|---|
| `tests/integration/checkout.test.ts` | Confirmation matrix: verify success, amount mismatch, currency mismatch, verify failed, verify pending, double-apply idempotency, concurrent apply, unknown `txRef`, verify timeout, the 5-second poll threshold, reconciler expiry, late-success recovery, `--sweep`. |
| `tests/integration/tier-limits.test.ts` | Tenant isolation and the limit matrix across BASIC/PRO/ENTERPRISE, system-admin non-exemption, downgrade behaviour, `PAST_DUE` gating, auth failures. |
| `tests/integration/tickets.test.ts` | Fast path with no vendor URL, valid and invalid codes, vendor timeout, vendor `500`, suspended and unknown museum, IP rate limit, and eight SSRF guard cases. |

**Current state of the working tree: 47 passing, 2 skipped.**

The 2 skipped are blocked on other branches and are marked `it.skip` with the reason in the test title:
- A `PAST_DUE` museum still serving `GET /waypoint/:id` — needs **Dev 2's** visitor routes.
- A `PAST_DUE` museum still accepting a room `PATCH` — needs **Dev 1's** admin update route.

Both should be un-skipped as part of the merge, and they are the cheapest possible proof that tier gating did not break during integration.

### 7.2 What is not covered, and matters

| Gap | Why it matters |
|---|---|
| **Live Chapa `initialize` has never returned a real `checkout_url`.** | The single most important unproven behaviour in the track. Every checkout test to date has run against the fake provider. |
| Live Chapa `verify` never exercised. | The entitlement decision depends on parsing a real verify response. |
| Full sandbox pass never performed. | Pay, land on the return page, confirm the upgrade; then repeat closing the tab to prove the reconciler catches it; then abandon one to prove it expires. |
| Reconciler only smoke-run against an empty payment table. | Its real branches — mid-window recovery, 24-hour expiry, sweep — are covered by tests using the fake provider, but never against Chapa. |
| Missing-variable boot failure never exercised. | `config/env.ts` is intended to exit with a readable message when a required variable is absent. Untested until now. |
| Seed idempotency asserted by construction only. | Written with `upsert` on `slug` and `email`, but never actually run twice end to end. |
| `TICKET_URL_INVALID` at save time. | Requires Dev 1's museum-update route, which does not exist. The guard itself is verified on the call path. |

### 7.3 Note on work performed during this audit

The suite was extended with a fourth file, `tests/integration/billing-api.test.ts` (29 further cases covering the checkout guard matrix, plans serialization, status pagination, the manual override audit trail, and period arithmetic), taking the suite to **76 passing, 2 skipped**. A further 11 cases covering environment guards took it to **87 passing, 2 skipped**. Those runs were performed and observed both inside the container and on the host.

**Those changes are no longer in the working tree** — the source fixes were reverted, and `tests/integration/billing-api.test.ts` now exists as a **0-byte file** (see defect D4). The figures in section 7.1 describe what a reviewer will actually find on checkout today. The findings in section 8 were discovered during that work and remain valid, because the defects they describe are present in the current tree.

---

## 8. Defects and gaps found

Ordered by merge impact.

### D1 — Migration SQL is excluded from version control — **blocker**

`backend/.gitignore` contains `prisma/migrations/*/migration.sql`. Only `migration_lock.toml` is tracked; all three `migration.sql` files are untracked.

**Consequence:** a fresh clone of this branch cannot build a database. `prisma migrate deploy` has no migrations to apply, so CI cannot run and neither Dev 1 nor Dev 2 can reproduce the schema. Because empty directories are not tracked, they will not even see the migration folders.

**Fix:** delete that line from `.gitignore` and commit all three `migration.sql` files. One line plus three files.

### D2 — The `lint` script cannot run — **blocker for CI**

`package.json` defines `"lint": "eslint src --ext .ts"`, but `eslint` is absent from `devDependencies`. The command fails with "eslint is not recognized" on any machine.

**Consequence:** whoever wires up CI first gets a red pipeline that has nothing to do with their code.

**Fix:** either add eslint with a shared config, or remove the script. Choosing the config is a decision for the three developers jointly, since it should be identical across branches.

### D3 — A provider failure at checkout is reported as `500`, not `502` — **correctness**

In `createCheckout`, a single `try` block wraps the Chapa call *and* the two database writes that follow it. The `catch` maps only `UpstreamUnavailableError` → `503` and `UpstreamFailureError` → `502`, and rethrows everything else, which the terminal handler renders as `500 INTERNAL_ERROR`.

`providerCall` in `src/providers/resilience.ts` rethrows the original error unchanged, and `ChapaPayment.initialize` only wraps *non-OK HTTP responses* in `UpstreamFailureError`. Therefore a **network fault, DNS failure, or timeout** against Chapa escapes as a plain `Error` and produces `500`.

**Consequence:** a Chapa outage is reported to clients and to monitoring as an internal fault in our own service, sending whoever is on call to the wrong system. This was reproduced and confirmed with a test.

**Fix:** narrow the `try` to the provider call alone, map any error from it to `502`/`503`, and leave the subsequent database writes outside so a genuine internal fault still reports `500`. The tickets module (`src/modules/tickets/service.ts`) already uses exactly this fail-closed shape, so the fix also makes the two modules consistent.

### D4 — `tests/integration/billing-api.test.ts` is a 0-byte file — **breaks the test run**

The file exists on disk with zero bytes. Vitest's `include` glob is `tests/**/*.test.ts`, so it will be collected and fail with "No test suite found in file".

**Fix:** either restore its contents or delete the file. Note the same 0-byte symptom affected another file earlier in this project — likely an unsaved editor buffer or a OneDrive placeholder — so it is worth confirming that files are actually written to disk before committing.

### D5 — No validation of the Chapa key's shape — **operational**

`config/env.ts` requires `CHAPA_SECRET_KEY` to be non-empty and rejects a `CHASECK_TEST-` key in production, but never checks that the value is a *secret* key at all. A `CHAPUBK_` publishable key passes validation, the application boots normally, and the failure appears much later as an opaque upstream error at the first checkout.

This is not hypothetical: the environment has held a `CHAPUBK_TEST-` key throughout, which is a large part of why the live path was never proven.

**Fix:** when `PAYMENTS_PROVIDER=chapa`, require the key to start with `CHASECK`. Fail at boot with a message naming the correct prefix. Keep it conditional on the provider so the fake provider is unaffected.

### D6 — Tests hardcode the database hostname

`vitest.config.ts`, `tests/globalSetup.ts`, and `tests/setupEnv.ts` each hardcode `postgresql://adwa:adwa@db-test:5432/adwa_test`. That hostname only resolves inside the Compose network, so the suite can only run inside the `api` container.

**Consequence:** contributors and CI runners that use a service container on a published port cannot run the tests. Minor, but it constrains how CI can be configured — worth settling before three branches converge on one pipeline.

**Fix:** read the value from an overridable environment variable, defaulting to the Compose hostname.

---

## 9. Integration contract for Dev 1 and Dev 2

What the other branches must do for this track to keep working.

### 9.1 For Dev 1 (platform and admin)

1. **Replace `requireAuth.ts` with the real implementation.** It must populate `req.admin` with `{ id, role, museumId }`. Every route in this track reads those three fields and nothing else.
2. **Delete the three dev-only routes**, do not merely disable them: `POST /dev/login`, `POST /dev/rooms`, `POST /stub-ticket-vendor`.
3. **Attach `requireWithinTierLimit` to the real create routes.** `POST /admin/rooms`, the item create route, and the admin-user create route. It is a no-op unless it is mounted, and this is the single easiest thing to lose in a merge — the tier caps become decorative the moment the dev route is deleted without the middleware being reattached.
4. **Call `resolveMuseum.ts` from `requireMuseumScope`.** Do not resolve tenancy from the request body. If the two helpers diverge, one will have a bypass.
5. **Do not gate `PATCH`.** Downgrades must never delete or block editing of existing content.
6. **Enforce the SSRF guard when saving `ticketValidationUrl`,** returning `422 TICKET_URL_INVALID`. The call-time guard is already in place; the save-time guard is Dev 1's route.
7. **Resolve the `field` versus `path` drift** in validation `details` and record the decision.

### 9.2 For Dev 2 (chat, narration, waypoints)

1. **Accept `AdminAuditLog.adminUserId` as nullable** and treat `null` as a system actor, or bring an alternative that lets the reconciler write an audit row with no human behind it. See section 4.4 — this is a real conflict requiring a decision.
2. **Keep the visitor path free of subscription checks.** A `PAST_DUE` museum must keep serving waypoints and narration. The skipped test in `tier-limits.test.ts` exists to prove this and should be un-skipped once the routes land.

### 9.3 For all three

1. **Coordinate migrations.** Parallel `prisma migrate dev` runs produce histories that conflict on merge. Agree one owner for the merged migration, or squash to a single initial migration at integration time.
2. **After any dependency change, renew the anonymous volume:** `docker compose up -d --force-recreate --renew-anon-volumes api`. Docker keeps `/app/node_modules` across an ordinary `up`, so the container silently retains old packages and you will chase a phantom "module not found".
3. **`npm ci` requires a committed `package-lock.json`.** Generate it with `npm install --package-lock-only` on the host before building.

---

## 10. Merge checklist

Ordered so each step is verifiable before the next.

- [ ] **D1** — un-ignore and commit the three `migration.sql` files. Without this nothing else can be verified on another machine.
- [ ] **D4** — restore or delete the 0-byte `billing-api.test.ts`.
- [ ] Confirm `docker compose exec api npm test` reports **47 passing, 2 skipped** on a clean clone. This is the baseline; do not begin merging until it reproduces.
- [ ] Decide `AdminAuditLog.adminUserId` nullability with Dev 2 (section 4.4). Record the decision.
- [ ] Decide `field` versus `path` in validation `details` with Dev 1 (section 3.3). Record the decision.
- [ ] Agree the migration strategy: squash to one initial migration, or nominate an owner.
- [ ] **D2** — settle the lint toolchain across all three branches, or drop the script.
- [ ] **D3** and **D5** — apply the checkout error-mapping fix and the Chapa key guard. Both are small and both remove a class of misleading failure.
- [ ] Un-skip the two blocked tests once Dev 1's and Dev 2's routes exist.
- [ ] Re-attach `requireWithinTierLimit` to Dev 1's real create routes and prove a cap still fires.
- [ ] Delete the three dev-only routes and confirm they are gone from a production build.
- [ ] **Perform the manual Chapa sandbox pass** (section 7.2). This is the only way to close the largest open risk in the track.
- [ ] Schedule the reconciler in the target environment (section 5.1).

---

## 11. Environment reference

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://adwa:adwa@db:5432/adwa
DATABASE_TEST_URL=postgresql://adwa:adwa@db-test:5432/adwa_test
JWT_SECRET=                        # >= 32 characters, enforced
CORS_ALLOWED_ORIGINS=http://localhost:5173

CHAPA_SECRET_KEY=CHASECK_TEST-...  # SECRET key. A CHAPUBK_ key is browser-side and gets a 401.
CHAPA_BASE_URL=https://api.chapa.co/v1
CHAPA_RETURN_URL=http://localhost:5173/billing
CHAPA_TIMEOUT_MS=10000
PAYMENTS_PROVIDER=fake             # chapa | fake

TICKETS_PROVIDER=fake              # http | fake
TICKET_VENDOR_TIMEOUT_MS=5000
ENABLE_STUB_TICKET_VENDOR=true     # must be false in production
STUB_TICKET_CODES=DEMO-1234,DEMO-5678,ADWA-VIP
OUTBOUND_HTTP_ALLOW_PRIVATE_IPS=true   # local only

SEED_SYSTEM_ADMIN_EMAIL=system@adwa.local
SEED_SYSTEM_ADMIN_PASSWORD=
```

Production guards in `config/env.ts` refuse to boot when `NODE_ENV=production` and any of these hold: `ENABLE_STUB_TICKET_VENDOR` is true, `OUTBOUND_HTTP_ALLOW_PRIVATE_IPS` is true, or `CHAPA_SECRET_KEY` is a `CHASECK_TEST-` sandbox key.

Seeded tenants: `adwa` (BASIC, ACTIVE, 1 room — at cap) and `louvre` (PRO, ACTIVE, 3 rooms — at cap). Admins are `system@adwa.local`, `admin@adwa.local`, `admin@louvre.local`.

A Postman collection covering all ten endpoints, including negative cases and a live Chapa flow, is in `post.json` at the repository root.

---

## 12. Open questions

| # | Question | Blocks |
|---|---|---|
| Q1 | Real ETB prices per tier, and monthly versus annual periods. Currently seeded 1500 / 4500 / 12000 as placeholders. | Anything customer-facing |
| Q4 | Encrypted per-museum ticket vendor credentials now, or defer until a vendor exists? | Ticket validation for real vendors |
| Q6 | Policy for a museum that never renews — indefinite `PAST_DUE`, or suspension after N days? | Reconciler sweep behaviour |

Q3, which Chapa secret verifies a webhook signature, is retired — there is no webhook. Remaining numbering matches dev3 §16 so the two documents stay cross-referenceable.
