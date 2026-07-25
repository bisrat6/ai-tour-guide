# Adwa AI Tour Guide — Backend

Multi-tenant backend for the Adwa AI Tour Guide: admin CRUD for museums, rooms,
and items; visitor content and grounded chat; TTS and image narration. See
[docs/backend-implementation-plan.md](../docs/backend-implementation-plan.md)
for the full specification and
[developer1-detailed-plan.md](../developer1-detailed-plan.md) for how the
admin foundation (this package, so far) is being built phase by phase.

**Status:** D1-6 — Items. Real Express app, Postgres via Prisma, seeded
museum content, `POST /admin/login`, JWT auth, the `requireAuth` /
`requireRole` / `requireMuseumScope` middlewares, the full museum and room
CRUD surfaces, and the item CRUD surface (`GET/POST /admin/items`,
`PATCH/DELETE /admin/items/:id`, plus the atomic bulk
`PATCH /admin/rooms/:id/items/order`) scoped through `item.room.museumId`,
with chat-answer cache purging and audit logging on every write. The D1-0
mock server remains available for clients that prefer the in-memory
contract.

## Quick start

```bash
cd backend
npm install
```

| Command                           | What it does                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`               | `tsc --noEmit`                                                                                                                                   |
| `npm run lint` / `lint:fix`       | ESLint (flat config, `@typescript-eslint`)                                                                                                       |
| `npm run format` / `format:write` | Prettier check / write                                                                                                                           |
| `npm run generate:openapi`        | Regenerates `openapi/openapi.yaml` from the Zod schemas under `src/modules/*/schemas.ts` — this is the source of truth, never hand-edit the YAML |
| `npm run dev`                     | Starts the real Express app (`PORT`, default 3000; local `.env` may use 3001)                                                                    |
| `npm run seed`                    | Seeds SYSTEM_ADMIN + both museums' rooms/items/personas into Postgres                                                                            |
| `npm run mock`                    | Starts the mock admin API on `http://localhost:4000` (`MOCK_PORT` to override), fixtures loaded from `../data/*.json`                            |
| `npm test`                        | Runs Vitest (unit + integration). Integration tests require `TEST_DATABASE_URL` pointing at a throwaway DB                                       |

## Real app (local)

1. Copy `.env.example` → `.env` and fill in `DATABASE_URL`, `JWT_SECRET`
   (≥32 chars), and the `SEED_*` passwords.
2. Create the Postgres database named in `DATABASE_URL` (and a separate
   throwaway DB for `TEST_DATABASE_URL` — integration tests truncate it).
3. `npx prisma migrate deploy` then `npm run seed` then `npm run dev`.

Seeded accounts (passwords come from your `.env` `SEED_*` vars):

| Role                  | Email                                                 |
| --------------------- | ----------------------------------------------------- |
| SYSTEM_ADMIN          | `SEED_SYSTEM_ADMIN_EMAIL` (default `system@adwa.dev`) |
| MUSEUM_ADMIN (Adwa)   | `admin@adwamuseum.org`                                |
| MUSEUM_ADMIN (Louvre) | `admin@louvre.fr`                                     |

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
    shared/            error envelope, pagination — cross-module contract pieces
    modules/
      auth/schemas.ts
      museums/schemas.ts
      rooms/schemas.ts
      items/schemas.ts
  scripts/
    generate-openapi.ts
  mock/                D1-0 mock server (contract simulator, not the real app)
  openapi/
    openapi.yaml       generated — do not hand-edit
  tests/
    unit/
```

`src/lib/`, `src/middleware/`, and the router/service files per module arrive
in D1-1 onward as the real Express app is built. See
[developer1-detailed-plan.md](../developer1-detailed-plan.md) for the full
phase breakdown and status.
