# Adwa AI Tour Guide — Backend

Multi-tenant backend for the Adwa AI Tour Guide: admin CRUD for museums, rooms,
and items; visitor content and grounded chat; TTS and image narration. See
[docs/backend-implementation-plan.md](../docs/backend-implementation-plan.md)
for the full specification and
[developer1-detailed-plan.md](../developer1-detailed-plan.md) for how the
admin foundation (this package, so far) is being built phase by phase.

**Status:** D1-0 — Contract first. There is no real Express app, database, or
authentication yet — those land in D1-1 onward. What exists today is the
admin API _contract_ (Zod schemas → OpenAPI document) and a mock server that
implements it in-memory, so client work can start immediately.

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
| `npm run mock`                    | Starts the mock admin API on `http://localhost:4000` (`MOCK_PORT` to override), fixtures loaded from `../data/*.json`                            |
| `npm test`                        | Runs the Vitest suite                                                                                                                            |

## Mock server

`npm run mock` implements every route in `openapi/openapi.yaml` against
in-memory fixtures built from the two existing content sets in `../data/`.
It's for other developers to write and run real client code against before
the real app exists — it is **not** the real implementation (no Postgres, no
real JWTs, no bcrypt), and it resets on every restart. IDs are deterministic
(hashed from museum slug + legacy id) so they're stable across restarts even
though the store itself isn't persisted.

Seeded accounts (printed on startup):

| Role                  | Email                  | Password       |
| --------------------- | ---------------------- | -------------- |
| SYSTEM_ADMIN          | `system@adwa.dev`      | `dev-password` |
| MUSEUM_ADMIN (Adwa)   | `admin@adwamuseum.org` | `dev-password` |
| MUSEUM_ADMIN (Louvre) | `admin@louvre.fr`      | `dev-password` |

```bash
curl -s -X POST http://localhost:4000/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@adwamuseum.org","password":"dev-password"}'
```

Use the returned `token` as `Authorization: Bearer <token>` on subsequent
requests. The mock enforces the same tenant-isolation rules as the spec
(§8.4, §14.2): a `MUSEUM_ADMIN`'s `museumId` always comes from their token,
never from the request, and cross-museum access returns
`403 CROSS_TENANT_ACCESS`.

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
