# Adwa AI Tour Guide — Backend

Multi-tenant backend for the Adwa AI Tour Guide: admin CRUD for museums, rooms,
and items; visitor content and grounded chat; TTS and image narration. See
[docs/backend-implementation-plan.md](../docs/backend-implementation-plan.md)
for the full specification and
[developer1-detailed-plan.md](../developer1-detailed-plan.md) for how the
admin foundation (this package, so far) is being built phase by phase.

**Status:** D1-8 — Handoff and hardening (final Developer 1 phase). Real
Express app, Postgres via Prisma, seeded museum content, `POST /admin/login`,
JWT auth, the `requireAuth` / `requireRole` / `requireMuseumScope`
middlewares, the full museum, room, and item CRUD surfaces (the latter
including the atomic bulk `PATCH /admin/rooms/:id/items/order`), with
chat-answer cache purging and audit logging on every write.
`tests/integration/isolation.test.ts` consolidates the full §17.2
tenant-isolation matrix (11 of 12 cases — case 9 needs the visitor-facing
routes Developers 2/3 own) into one canonical suite, and every guard it
covers has been manually confirmed to actually fail when disabled.
`openapi/openapi.yaml` is regenerated and verified 1:1 against every route
actually registered in `src/modules/*/router.ts`, and `errorHandler.ts`
guarantees the §7.1 envelope even for failures that never reach a route
(malformed/oversized bodies, unmatched routes). The D1-0 mock server remains
available for clients that prefer the in-memory contract.

Developer 3's billing and ticketing work has since been integrated on top:
subscription tiers with Chapa checkout (`/admin/billing/*`), a payment
reconciler (`npm run reconcile`), and visitor ticket validation
(`POST /tickets/validate`) behind an SSRF guard. That branch was ported rather
than merged; the review found ten defects in it, and the critical and high ones
have since been fixed — a production process now refuses to boot with the fake
payment provider, and a paid transaction can no longer be stranded by a vendor
outage or an expiry sweep. Read
[docs/d3-integration-audit.md](../docs/d3-integration-audit.md) before deploying
or touching billing: it records each fix, the four issues left open (including
the still-missing payment webhook), and why tier limits are implemented and
tested but enforced on no route yet.

## Quick start

```bash
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL at least — the next step needs it
npm run prisma:generate
```

`prisma generate` is not optional and not automatic. The client is written into
`node_modules/.prisma`, which is untracked and wiped by `npm ci`, so a fresh
clone has no Prisma types until you run it — `typecheck`, `dev`, and `test` all
fail beforehand with `Module '@prisma/client' has no exported member
'PrismaClient'`. It is not a `postinstall` hook because `prisma.config.ts`
resolves `DATABASE_URL` eagerly, so hooking it would make `npm install` itself
fail on a clone that has no `.env` yet.

| Command                           | What it does                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run prisma:generate`         | `prisma generate` — regenerate the Prisma client. Required after a fresh install and after any `schema.prisma` change                            |
| `npm run typecheck`               | `tsc --noEmit`                                                                                                                                   |
| `npm run lint` / `lint:fix`       | ESLint (flat config, `@typescript-eslint`)                                                                                                       |
| `npm run format` / `format:write` | Prettier check / write                                                                                                                           |
| `npm run generate:openapi`        | Regenerates `openapi/openapi.yaml` from the Zod schemas under `src/modules/*/schemas.ts` — this is the source of truth, never hand-edit the YAML |
| `npm run dev`                     | Starts the real Express app (`PORT`, default 3000; local `.env` may use 3001)                                                                    |
| `npm run seed`                    | Seeds SYSTEM_ADMIN, tier pricing, and both museums' rooms/items/personas into Postgres                                                           |
| `npm run reconcile`               | Payment reconciler; accepts `-- --dry-run` and `-- --sweep`. Intended to run on a schedule                                                       |
| `npm run mock`                    | Starts the mock admin API on `http://localhost:4000` (`MOCK_PORT` to override), fixtures loaded from `../data/*.json`                            |
| `npm test`                        | Runs Vitest (unit + integration). Integration tests require `TEST_DATABASE_URL` pointing at a throwaway DB                                       |

## Real app (local)

1. Copy `.env.example` → `.env` and fill in `DATABASE_URL`, `JWT_SECRET`
   (≥32 chars), and the `SEED_*` passwords.
2. Create the Postgres database named in `DATABASE_URL` (and a separate
   throwaway DB for `TEST_DATABASE_URL` — integration tests truncate it).
3. `npm run prisma:generate`, then `npx prisma migrate deploy`, then
   `npm run seed`, then `npm run dev`. (`migrate deploy` does not generate the
   client for you — only `migrate dev` does.)

Seeded accounts, created by `npm run seed` (`backend/prisma/seed.ts`), idempotent
to re-run (matches on email / `Museum.slug`, so re-running updates rather than
duplicates):

| Role                  | Email                                                         | Password                                      |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| SYSTEM_ADMIN          | `SEED_SYSTEM_ADMIN_EMAIL` env var (default `system@adwa.dev`) | `SEED_SYSTEM_ADMIN_PASSWORD` env var          |
| MUSEUM_ADMIN (Adwa)   | `admin@adwamuseum.org`                                        | `SEED_MUSEUM_ADMIN_PASSWORD` env var (shared) |
| MUSEUM_ADMIN (Louvre) | `admin@louvre.fr`                                             | `SEED_MUSEUM_ADMIN_PASSWORD` env var (shared) |

The two museum admins share one password on purpose — they're local-dev
fixtures, not real accounts. Set all three `SEED_*` vars in your own `.env`
(see `.env.example`) before running `npm run seed`; `seedMuseums()` skips
museum content entirely (with a console warning) if `SEED_MUSEUM_ADMIN_PASSWORD`
is unset, and `seedSystemAdmin()` throws if either `SEED_SYSTEM_ADMIN_*` var
is missing.

```bash
curl -s -X POST http://localhost:3001/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"system@adwa.dev","password":"<SEED_SYSTEM_ADMIN_PASSWORD>"}'
```

Use the returned JWT as `Authorization: Bearer <token>` on `/admin/*` routes.

## Mock server

`npm run mock` implements every route in `openapi/openapi.yaml` against
in-memory fixtures built from `../data/`. It is **not** the real
implementation (no Postgres, no real JWTs, no bcrypt). IDs are deterministic
so they're stable across restarts.

Mock seeded accounts (printed on startup): `system@adwa.dev`,
`admin@adwamuseum.org`, `admin@louvre.fr` — password `dev-password` for all.

## Repository layout

```
backend/
  src/
    app.ts               createApp() — assembles middleware + routers, used by both index.ts and tests
    index.ts              real entry point: starts the HTTP server, graceful shutdown
    config/env.ts          Zod-validated environment variables — the only place process.env is read
    lib/
      errors.ts            ApiError — every route throws this instead of building responses by hand
      logger.ts             pino logger
      jwt.ts                sign/verify admin JWTs
      prisma.ts              PrismaClient instance (PrismaPg adapter)
      auditLog.ts            writeAuditLog() — AdminAuditLog entries inside the same transaction as the write
      resolveMuseum.ts       resolves a resource's owning museum from the DB, never from the request body
      ssrfGuard.ts           blocks private/metadata targets before any admin-supplied URL is fetched
      asyncHandler.ts, params.ts, version.ts
    middleware/
      requestId.ts, errorHandler.ts     — request tracing + the single place that emits the §7.1 envelope
      requireAuth.ts, requireRole.ts, requireMuseumScope.ts   — auth/authz chain
      rateLimit.ts
      requireWithinTierLimit.ts   — tier caps on creates; implemented and tested, mounted on no route yet
    modules/
      auth/     schemas.ts, router.ts, service.ts, loginAttempts.ts
      museums/  schemas.ts, router.ts, service.ts
      rooms/    schemas.ts, router.ts, service.ts
      items/    schemas.ts, router.ts, service.ts
      billing/  schemas.ts, router.ts, service.ts, tiers.ts, reconcile.ts
      tickets/  schemas.ts, router.ts, service.ts
      health/   router.ts
    providers/
      resilience.ts          timeout + one retry + circuit breaker for every outbound provider call
      payments/              Chapa adapter and an in-memory fake, chosen by PAYMENTS_PROVIDER
      ticketing/             HTTP vendor adapter and a fake, chosen by TICKETS_PROVIDER
    shared/
      errorEnvelope.ts, pagination.ts    cross-module contract pieces
      museumSeedData.ts                   shared between prisma/seed.ts and mock/fixtures.ts
    types/express.d.ts    Request augmentation (requestId, log, admin)
  prisma/
    schema.prisma, seed.ts, migrations/
  prisma.config.ts        Prisma 7 CLI config (reads DATABASE_URL)
  scripts/
    generate-openapi.ts    regenerates openapi/openapi.yaml from the Zod schemas — never hand-edit the YAML
    reconcile-payments.ts  scheduled payment reconciler (npm run reconcile)
  mock/                    D1-0 mock server (in-memory contract simulator, not the real app)
  openapi/
    openapi.yaml           generated — do not hand-edit
  postman/                 end-to-end collection run against a live server — see postman/README.md
  tests/
    unit/                  deterministicId, schemas
    integration/            auth, museums, rooms, items, isolation (§17.2 matrix), errorEnvelope,
                            billing, tickets, tierLimits
    helpers/                db.ts (seed/reset), scenario.ts (isolation fixtures)
    setup/testEnv.ts        swaps TEST_DATABASE_URL into DATABASE_URL before any test runs
  docker-compose.yml       local Postgres
```

See [developer1-detailed-plan.md](../developer1-detailed-plan.md) for the
full phase-by-phase history and
[docs/dev2-dev3-handoff.md](../docs/dev2-dev3-handoff.md) for the
`ChatAnswer`/`AudioAsset` table contracts and the cache-purge rule Developers
2 and 3 build on. [docs/d3-integration-audit.md](../docs/d3-integration-audit.md)
covers how Developer 3's billing and ticketing work was integrated, and what
remains open in it.

## Testing

- `npm test` runs everything: `tests/unit/` (no DB) and `tests/integration/`
  (real Postgres, via `TEST_DATABASE_URL`).
- Integration tests apply migrations once per process (`ensureTestSchema`)
  and `TRUNCATE ... RESTART IDENTITY CASCADE` between tests (`resetDatabase`)
  — never point `TEST_DATABASE_URL` at the same database as `DATABASE_URL`.
- `tests/integration/isolation.test.ts` is the canonical tenant-isolation
  suite (§17.2 of the main plan): 11 of 12 cases pass; case 9 is an
  `it.todo` blocked on visitor routes that don't exist in this package yet.
  Every guard it exercises has been manually verified to fail its test when
  disabled (see commit history for D1-7).
- `tests/integration/errorEnvelope.test.ts` covers the failure paths that
  never reach a route handler — malformed JSON, oversized bodies, unmatched
  routes — so the §7.1 envelope guarantee holds even there.
- `postman/` holds a manual end-to-end pass over the same surface against a
  running, seeded server: 74 requests, 290 assertions, repeatable. It is not
  part of CI. See [postman/README.md](postman/README.md) for setup, and
  [docs/d1-audit.md](../docs/d1-audit.md) for the audit findings it documents.
