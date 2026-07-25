# Developer 1 — Detailed Implementation Plan (v2)

**Aligned with:** [docs/backend-implementation-plan.md](docs/backend-implementation-plan.md) (v2).
**Supersedes:** the v1 version of this document, which was written against `Adwa_Backend_Implementation_Plan.md` before that spec's contradictions were resolved.

Section references in the form (§n) point at the main backend plan. This document does not restate what is already specified there; it defines what Developer 1 owns, in what order, and what "done" means for each piece.

---

## Role summary

Developer 1 owns the backend foundation: the data model, the security model, and the admin CRUD surface. Developers 2 and 3 build on top of this, so the defining constraint on this role is not feature count — it is that **the schema and the auth contract must stabilize early and then stop moving.**

Scope:

- The Prisma schema and all migrations
- The seed pipeline for existing content in `data/`
- Admin authentication and the three authorization middlewares
- Admin CRUD for museums, rooms, and items
- Multi-tenant isolation and its automated test suite
- The shared error envelope, request IDs, and structured logging
- The OpenAPI contract for the admin surface

Explicitly **not** in this role: chat grounding, TTS and audio, ticket validation, and the provider adapters. Those are §10–§13 and §15 of the main plan.

---

## Execution setup

Concrete decisions for how this plan actually gets built, agreed before D1-0 starts.

- **Branch:** `backend-platform-admin` (already created locally, not yet pushed; see §8 Branch below). Every phase in this document is committed to this branch.
- **Location:** code lives under `backend/`, matching §4 Repository layout of the main plan exactly — `backend/prisma/`, `backend/src/`, `backend/tests/`, `backend/openapi/`.
- **Local database:** `backend/docker-compose.yml` runs Postgres 16 for local development, brought up in D1-1. `backend/.env` points `DATABASE_URL` at it. Render's managed Postgres is the target for the deployed environment (§19 of the main plan) — the same schema and migrations apply to both; only the connection string changes.
- **Workflow rule:** phases are implemented one at a time. After finishing a phase's tasks and confirming its exit criteria, work stops for review rather than continuing automatically into the next phase.
- **Commit messages, not commits:** commits are never run directly against the repo. After each phase — and after any smaller fix or improvement made in response to review feedback — a ready-to-use commit message is provided for the user to commit themselves. This keeps the commit history under the user's control while still landing after every discrete unit of work.
- **Progress tracking:** each `D1-n` heading below carries a `**Status:**` line (`Not started` / `In progress` / `Done`), updated as work proceeds, so this document is the source of truth for what's actually built.

---

## What changed from v1 of this document

The v1 plan inherited four problems from the v1 spec. All four land squarely in Developer 1's scope, so they are called out rather than quietly absorbed.

| # | v1 said | v2 does | Why |
|---|---|---|---|
| 1 | Error standardization is the last phase | Error envelope, codes, request ID, and logging move to **D1-1**, before any route | Retrofitting a response shape across roughly twenty routes is pure rework, and every other developer needs the shape fixed before they write a client. Main plan P1. |
| 2 | Multi-tenancy verification is a manual checklist near the end | The same matrix as **automated Vitest + Supertest tests**, green in CI from D1-4 onward | A checklist run at the end of one phase gets run once. This is the one property the spec itself says cannot be hand-waved. Main plan P2, §17.2. |
| 3 | CRUD means GET, POST, PATCH | **DELETE routes added** for rooms and items, with reference handling and cache purging | Content authoring without deletion is unworkable, and deleting a room that another room's `nextRoomId` points at needs a defined outcome. Main plan M1, §14. |
| 4 | Schema is the four models as specified | **Schema corrected and extended** — see below | The v1 schema silently drops a field that both existing datasets already contain. Main plan §2.2. |

### Schema corrections Developer 1 must apply

These are not preferences. Each one is a concrete defect in the v1 schema, and the full annotated schema is in §6.1 of the main plan.

- **`Room.narrationScript` is missing.** `data/waypoints_adwa.json` and `data/waypoints_louvre.json` both carry `room_narration_script` *separately* from `room_overview_text`. The script is what gets sent to TTS; the overview is what grounds the chat. With only `roomOverviewText` in the schema, the script has nowhere to land and the seed silently loses it.
- **`Museum.systemPrompt` is missing.** `data/system_prompt_adwa.md` and `data/system_prompt_louvre.md` are different personas. A multi-tenant system cannot share one hardcoded persona across tenants.
- **Room IDs collide in the seed data.** Both datasets use `room_1` through `room_4`, which breaks the spec's own load-bearing claim that room IDs are globally unique. `legacyId` on `Room` and `Item`, unique per museum, resolves it.
- **No uniqueness on `storyOrder`,** so two rooms in one museum can both claim position 3.
- **No ordering on items,** so the app renders them in whatever order Postgres returns.
- **No referential actions,** so deleting a room either fails opaquely or orphans the tour chain.
- **Three models are needed that v1 does not have:** `AudioAsset` and `ChatAnswer` (Developer 1 creates the tables; Developers 2 and 3 use them) and `AdminAuditLog`.

---

## 1. Objectives

1. A correct, stable data model that the other two developers can build against without it shifting under them.
2. An admin surface that cannot be tricked into cross-tenant access.
3. A consistent, predictable error contract across the whole API.
4. Automated proof of both, running on every commit.

The order matters. Objective 1 blocks everyone; get it published, then iterate on the rest.

---

## 2. Core responsibilities

### 2.1 Schema and migrations

Implement §6.1 of the main plan exactly, including the additions listed above. Create the initial migration and apply it. Verify relationships and referential actions behave as specified, particularly:

- `Room.museum` is `Restrict` — a museum with rooms cannot be hard-deleted
- `Room.nextRoom` is `SetNull` — deleting a room breaks the chain rather than cascading through the tour
- `Item.room` is `Cascade`

Every subsequent schema change is a new migration. Never edit an applied one.

### 2.2 Seed pipeline

Implement §16 of the main plan. Idempotent, matching on `Museum.slug` and `legacyId`, two passes so `next_waypoint_id` can be resolved after all rooms exist. Loads both museums, their personas, and one `SYSTEM_ADMIN` from environment variables.

This is Developer 1's work even though it looks like content work, because it is the first real test of whether the schema actually fits the data.

### 2.3 Authentication and authorization

Implement §8. Beyond the v1 requirements:

- **Timing parity on login** — run a dummy bcrypt comparison when the email is unknown, so response time does not leak account existence even though the error message does not.
- **Login rate limiting** — 10 attempts per IP per 15 minutes, plus a 15-minute lockout after 5 consecutive failures for one email. v1 left the only authentication surface in the system with no brute-force protection.
- **Suspended-museum token check in `requireAuth`** — v1 hid a suspended museum's content from visitors but left its admin's existing 12-hour token fully working. Suspension must take effect on the next request, not whenever the token happens to expire.

The rule that matters most, carried unchanged from the original spec: **`requireMuseumScope` resolves the museum ID from the database record being acted on, never from a `museumId` in the request body or query string.** Everything else in this role is recoverable; getting this wrong is the failure the product cannot absorb.

### 2.4 Admin API

Implement §14. Cursor pagination on every list route, audit logging inside the same transaction as every write, and the two room-sequence rules:

- **Same museum** — `nextRoomId` must point within the same tenant.
- **No cycles** — walk the chain from the proposed target; reject if the room being edited appears in it. v1 checked only the museum, so `A -> B -> A` was accepted and the visitor tour would loop with no exit.

### 2.5 Error handling and logging

Implement §7 in D1-1. The envelope, the error code table, `X-Request-Id` on every response, an async handler wrapper so no route can leak an unhandled rejection, and pino logging with the request ID on every line.

Publish the error code table to the other two developers as soon as it exists. They are writing client error handling against it.

---

## 3. Implementation plan

Developer 1's phases are labelled `D1-n` so they do not get confused with the whole-project phases in §18 of the main plan, which are numbered separately and mean different things. The mapping:

| Developer 1 | Main plan §18 |
|---|---|
| D1-0 Contract first | Phase 0 — Contract and skeleton |
| D1-1 Foundation | Phase 1 — Foundation |
| D1-2 Seed and schema validation | Phase 2 — Seed and visitor read path (Developer 1 owns the seed half; the `/waypoint` route is not this role) |
| D1-3 Authentication | Phase 3 — Auth |
| D1-4 Museums, D1-5 Rooms, D1-6 Items, D1-7 Isolation tests | Phase 4 — Admin write path |
| D1-8 Handoff and hardening | feeds Phase 9 — Hardening and deploy |

Main plan phases 5 through 8 — provider adapters, chat, audio, and tickets — belong to Developers 2 and 3 and are not this role's work.

### D1-0 — Contract first

**Status:** Done

Goal: unblock Developers 2 and 3 on day one rather than making them wait for real endpoints.

Tasks:

- Scaffold the `backend/` skeleton on the existing `backend-platform-admin` branch — `backend/package.json`, `backend/tsconfig.json` (strict), ESLint + Prettier config, and a CI workflow (`.github/workflows/ci.yml`) running typecheck and tests on every push
- Zod schemas for the admin surface (`backend/src/modules/{auth,museums,rooms,items}/schemas.ts`), with `backend/openapi/openapi.yaml` generated from them so the contract cannot drift from the code
- A mock server serving that document (`backend/mock/server.ts`), with fixtures drawn from `data/*.json`
- Publish the schema and error code table to the team

Deliverables: repo skeleton, OpenAPI document, running mock server.

Exit criteria: Developers 2 and 3 can write and run client code against the mock.

---

### D1-1 — Foundation

**Status:** Done

Goal: an app that boots correctly and fails correctly.

Tasks:

- Provision Postgres locally via `backend/docker-compose.yml` (Postgres 16); Render provisioning happens at deploy time (D1-8/§19)
- Prisma schema per §6.1 in `backend/prisma/schema.prisma`, initial migration via `prisma migrate dev --name init` (`backend/prisma/migrations/`)
- Express assembly (`backend/src/app.ts`, `backend/src/index.ts`), graceful shutdown, Zod-validated environment (`backend/src/config/env.ts`, §5) that refuses to boot on a missing or malformed variable
- **Error envelope, codes, request ID, structured logging (§7)** — `backend/src/lib/errors.ts`, `backend/src/lib/logger.ts`, `backend/src/lib/asyncHandler.ts`, `backend/src/middleware/requestId.ts`, `backend/src/middleware/errorHandler.ts` — first, not last
- `GET /health` returning `{ status, dbLatencyMs, version }` with a real database round-trip, so a deploy with a broken connection string fails its health check instead of serving 500s
- Seed a `SYSTEM_ADMIN` via `backend/prisma/seed.ts`

Deliverables: working Prisma setup, applied migration, health endpoint, error middleware, seeded admin.

Exit criteria: an unknown route returns a correctly-shaped error envelope with a request ID, and `/health` reports real database latency.

Priority: highest. Everyone else needs the real schema shape.

---

### D1-2 — Seed and schema validation

**Status:** Not started

Goal: prove the schema actually holds the content before anything is built on it.

Tasks:

- Extend `backend/prisma/seed.ts` per §16 to load both museums from `data/waypoints_adwa.json` and `data/waypoints_louvre.json`
- Resolve `next_waypoint_id` to real UUIDs in the second pass
- Confirm the `room_1`–`room_4` collision between the two datasets is handled by `legacyId` rather than by editing the source files
- Load both museum personas from `data/system_prompt_adwa.md` and `data/system_prompt_louvre.md` into `Museum.systemPrompt`
- Confirm `room_narration_script` survives the round trip

Deliverables: idempotent seed script, both museums loaded.

Exit criteria: re-running the seed changes nothing, both museums have four rooms with correctly linked sequences, and no source field has been dropped.

---

### D1-3 — Authentication

**Status:** Not started

Goal: secure the admin backend.

Tasks:

- `POST /admin/login` (`backend/src/modules/auth/{router,service,schemas}.ts`) with bcrypt cost 12, generic failure message, timing parity, rate limiting and lockout
- JWT signing and verification, 12-hour expiry, payload `{ sub, role, museumId }`
- `requireAuth` (`backend/src/middleware/requireAuth.ts`), including the suspended-museum status check
- `requireRole(role)` (`backend/src/middleware/requireRole.ts`)
- `requireMuseumScope` (`backend/src/middleware/requireMuseumScope.ts`), resolving from the database record
- Login rate limiting (`backend/src/middleware/rateLimit.ts`)
- `backend/tests/integration/auth.test.ts`

Deliverables: login route, JWT auth, the three middlewares, and their tests.

Acceptance criteria:

- Valid tokens are accepted
- Missing, malformed, and expired tokens all return `401 UNAUTHENTICATED`
- Wrong password and unknown email are indistinguishable in both body and timing
- Wrong role returns `403 FORBIDDEN`
- Wrong museum scope returns `403 CROSS_TENANT_ACCESS`
- A token issued before suspension is rejected after suspension

---

### D1-4 — Museums

**Status:** Not started

Goal: platform administrators can onboard and manage museums.

Tasks:

- `backend/src/modules/museums/{router,service,schemas}.ts`: `GET /admin/museums` (paginated), `GET /admin/museums/:id`
- `POST /admin/museums` creating the museum and its first `MUSEUM_ADMIN` **in one transaction** — a museum nobody can log into is a dead end
- `PATCH /admin/museums/:id` with mixed permissions: `status` is system-only; `ticketValidationUrl`, `systemPrompt`, and `defaultVoiceId` are writable by the museum's own admin
- `POST /admin/museums/:id/admins`
- Audit logging on every write (`AdminAuditLog`, inside the same transaction)
- `backend/tests/integration/museums.test.ts`

Acceptance criteria:

- A partial failure during creation leaves no orphan museum and no orphan admin
- A museum admin can set their own `ticketValidationUrl` but cannot set `status`
- Duplicate slug or email returns `409 CONFLICT`, not a raw Prisma error

---

### D1-5 — Rooms

**Status:** Not started

Goal: museum admins can manage their tour's rooms without being able to touch anyone else's.

Tasks:

- `backend/src/modules/rooms/{router,service,schemas}.ts`: `GET /admin/rooms?museumId=` — for a `MUSEUM_ADMIN`, **ignore the query parameter entirely** and use `req.admin.museumId`
- `GET /admin/rooms/:id`, `POST /admin/rooms`, `PATCH /admin/rooms/:id`
- `DELETE /admin/rooms/:id` — `409 ROOM_REFERENCED` when other rooms point at it, unless `?force=true` nulls those pointers first
- Same-museum validation on `nextRoomId`
- Cycle detection on `nextRoomId`
- Purge the room's cached `ChatAnswer` rows on any successful write
- `backend/tests/integration/rooms.test.ts`

Acceptance criteria:

- Rooms are created under the correct museum regardless of what the body claims
- Cross-museum and cycle-forming `nextRoomId` values are both rejected with `422`
- A museum admin sees only their own rooms, verified by asserting response contents rather than status alone
- Duplicate `storyOrder` within a museum returns `409`

---

### D1-6 — Items

**Status:** Not started

Goal: rooms can hold and manage their content items, scoped the same way rooms are.

Tasks:

- `backend/src/modules/items/{router,service,schemas}.ts`: `GET /admin/items?roomId=`, `POST /admin/items`, `PATCH /admin/items/:id`
- `DELETE /admin/items/:id`
- `PATCH /admin/rooms/:id/items/order` — bulk reorder in one transaction, because reordering one at a time means N requests and transient duplicate orderings
- Scope resolved through `item.room.museumId` on every route
- Purge the parent room's cached answers on write
- `backend/tests/integration/items.test.ts`

Acceptance criteria:

- Items are created under the correct room and the correct tenant
- A museum admin cannot touch another museum's items by ID
- Reordering is atomic

---

### D1-7 — Isolation test suite

**Status:** Not started

Goal: turn the tenant guarantee into something CI enforces rather than something a person remembers to check.

Implement the full twelve-case matrix in §17.2 as `backend/tests/integration/isolation.test.ts`, with shared fixtures in `backend/tests/helpers/`, running against a real throwaway Postgres with in-memory providers.

Case 5 deserves particular care: assert the **contents** of the response, not just the `200`. A route that returns 200 with the wrong museum's rooms is exactly the bug being hunted, and a status-only assertion passes straight through it.

Deliverables: the matrix, green in CI.

Exit criteria: all twelve cases pass, and each one has been confirmed to fail when its guard is deliberately removed. A test that cannot fail is not evidence.

---

### D1-8 — Handoff and hardening

**Status:** Not started

Goal: hand Developers 2 and 3 a stable base.

Tasks:

- Regenerate `backend/openapi/openapi.yaml` from the final Zod schemas and confirm it still matches the implementation
- Confirm every route emits the standard error envelope, since drift accumulates quietly
- Re-run the isolation matrix after all routes exist — new routes are where scoping gaps appear
- Document the seeded test accounts and the local setup path (`backend/README.md`)
- Publish the `ChatAnswer` and `AudioAsset` table contracts to Developer 2 and Developer 3, including the cache-purge rule they depend on

---

## 4. Development order

1. Repo skeleton, OpenAPI, mock server
2. Prisma schema and migration
3. Error envelope, logging, `/health`
4. Seed pipeline for both museums
5. Login and the three middlewares
6. Museum CRUD
7. Room CRUD with sequence validation
8. Item CRUD with reordering
9. Isolation test suite
10. Handoff and hardening

Steps 1 through 4 are the blocking path for the rest of the team; treat everything after step 4 as parallelizable with their work.

The change from v1's order is that the contract, the error envelope, and the seed all move to the front. Each was previously late, and each is something the other two developers need before they can write anything real.

---

## 5. Definition of done

- Schema implemented per §6.1, including `narrationScript`, `systemPrompt`, `legacyId`, `displayOrder`, referential actions, and the three new models
- Both museums seed cleanly and idempotently, with the room ID collision handled and no source field dropped
- Login works, with generic failures, timing parity, and rate limiting
- All three middlewares implemented, with scope resolved from the database record
- Full CRUD including deletes for museums, rooms, and items, with pagination and audit logging
- Same-museum and cycle validation on `nextRoomId`
- The twelve-case isolation matrix green in CI, each case verified to fail without its guard
- Every route returns the standard error envelope with a request ID
- The OpenAPI document matches the implementation
- Developers 2 and 3 are unblocked on the schema, the auth contract, and the error contract

---

## 6. Interfaces owned by this role

What the other developers depend on. Changing any of these is a breaking change that needs announcing.

| Interface | Consumer | Notes |
|---|---|---|
| Prisma schema and client | Both | Especially `Room.roomOverviewText` vs `narrationScript`, and `Museum.systemPrompt` for chat grounding |
| `requireAuth` / `requireRole` / `requireMuseumScope` | Both | Any new admin route must use them |
| Error envelope and code table (§7.2) | Both, plus the Flutter and admin-web teams | |
| `ChatAnswer` and `AudioAsset` tables | Chat and audio work | Including the rule that an admin write purges the room's cached answers |
| Seeded content and test accounts | Both | The fixture base for all chat testing |
| `openapi/openapi.yaml` | Flutter and admin-web teams | |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Schema churn after the other developers have built against it | D1-0 publishes the schema before anyone builds; changes after D1-2 go through an explicit announcement |
| `requireMuseumScope` applied inconsistently as routes are added | The isolation matrix runs in CI on every commit, so a new unscoped route fails the build |
| Seed data does not fit the schema | D1-2 seeds real content early, specifically to surface this before it is expensive |
| The isolation tests pass without proving anything | Every case is verified to fail with its guard removed (D1-7 exit criterion) |
| The audit log becomes write-only noise | Keep it as a plain table with no reporting requirement for now; it exists so history is reconstructable, not so anyone reads it daily |

---

## 8. Branch

```bash
git checkout -b backend-platform-admin
```

(Already created; not yet pushed to `origin` as of D1-0.)
