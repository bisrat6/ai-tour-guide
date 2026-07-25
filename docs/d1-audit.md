# Developer 1 implementation audit

**Scope:** everything claimed complete in [developer1-detailed-plan.md](../developer1-detailed-plan.md)
(phases D1-0 through D1-8), audited against that document and against the sections of
[docs/backend-implementation-plan.md](./backend-implementation-plan.md) it defers to.

**Date:** 2026-07-25, at commit `622f2d6` (D1-7/D1-8).

**Method:** every acceptance criterion and exit criterion in the D1 plan was traced to code, with
file and line evidence. The test suite (8 files, 70 passing, 1 `it.todo` at the time of the audit)
was run to confirm the claimed state.

**Status:** all five Tier 1 findings have since been **fixed** — each is marked below with what
landed. Tier 2 and Tier 3 remain open by choice; they are regression-protection and documentation
work rather than defects. Line references throughout describe the code **as audited**, before those
fixes, so they may be off by a few lines against current `main`.

---

## 1. Verdict

**D1-0 through D1-8 are implemented to specification.** The load-bearing properties hold:

- `requireMuseumScope` resolves the museum from the database record in every case. No resolver
  anywhere reads a museum ID from `req.body` or `req.query`, which is the one failure the plan
  says the product cannot absorb (§2.3 of the D1 plan).
- All 16 admin routes exist, are scoped, and match `openapi/openapi.yaml` one-to-one on method
  and path.
- Every write operation records an `AdminAuditLog` row inside the same transaction. There are no
  exceptions.
- Every multi-statement write is transactional.
- The error envelope is produced in exactly one place and cannot drift per route.

Most gaps found are in **CI enforcement and test coverage rather than application behaviour**. Two
genuine bugs were found: a destructive query-flag coercion (Tier 1, finding 5) and a missing cache
purge on item reorder (Tier 1, finding 3).

Phase-by-phase:

| Phase | Verdict |
| ----- | ------- |
| D1-0 Contract first | Pass |
| D1-1 Foundation | Pass |
| D1-2 Seed and schema validation | Pass, untested (Tier 2) |
| D1-3 Authentication | Pass |
| D1-4 Museums | Pass |
| D1-5 Rooms | Pass with one bug (Tier 1, finding 5) |
| D1-6 Items | Pass with one bug (Tier 1, finding 3) |
| D1-7 Isolation suite | Pass, 11 of 12 cases (case 9 blocked, documented) |
| D1-8 Handoff and hardening | Pass, but the "matches the implementation" guarantee is not enforced (Tier 1, finding 1) |

---

## 2. Tier 1 — real gaps (all fixed)

### 1. CI cannot catch OpenAPI drift — FIXED

`.github/workflows/ci.yml:59-60` regenerates the document but never compares it to the committed
file:

```yaml
- name: Generate OpenAPI doc (fails the build if it doesn't run cleanly)
  run: npm run generate:openapi
```

The step name overpromises. It fails only if the generator script itself errors — not if the
generated output differs from `backend/openapi/openapi.yaml` as committed. A developer can change
a Zod schema in `src/modules/*/schemas.ts`, forget to regenerate, and CI stays green while the
published contract silently diverges from the code.

This defeats the stated purpose of generating the document at all. D1-0: "with
`backend/openapi/openapi.yaml` generated from them **so the contract cannot drift from the
code**." D1-8: "Regenerate ... and confirm it still matches the implementation." The D1-8 check
was performed once, by hand; nothing prevents drift from reappearing on the next schema change.

**Fixed:** a `git diff --exit-code -- openapi/openapi.yaml` step now runs immediately after
generation, so a schema change without a regenerate fails the build. The generate step's misleading
name was corrected at the same time.

### 2. `DATABASE_URL` and `TEST_DATABASE_URL` are the same database in CI, and nothing guards against it — FIXED

`.github/workflows/ci.yml:33-34` points both variables at `ai_tour_guide_test`:

```yaml
DATABASE_URL: postgresql://tourguide:tourguide_dev_password@localhost:5432/ai_tour_guide_test
TEST_DATABASE_URL: postgresql://tourguide:tourguide_dev_password@localhost:5432/ai_tour_guide_test
```

This is the exact configuration `.env.example:12-14` warns against in capitals — "a SEPARATE,
throwaway database ... never point this at DATABASE_URL" — because `resetDatabase()` issues
`TRUNCATE ... RESTART IDENTITY CASCADE` across every table between tests
(`backend/tests/helpers/db.ts:9-18, 44-46`).

In CI this is harmless: that database is disposable and holds nothing. The problem is twofold.
The project's own reference configuration violates its most important test-safety invariant, and
there is no guard anywhere that would catch the same mistake locally, where it silently wipes a
developer's seeded working database. `ensureTestSchema()` only checks that `TEST_DATABASE_URL` is
*set* (`backend/tests/helpers/db.ts:29-32`); it never checks that it differs from
`DATABASE_URL`. `backend/tests/setup/testEnv.ts:15-17` swaps one into the other without comparing
them.

**Fixed:** `testEnv.ts` now throws when the two variables are equal, with a message explaining why,
so the mistake fails loudly instead of destroying data. CI's `DATABASE_URL` was pointed at a
distinct database name, and its redundant `npx prisma migrate deploy` step was dropped —
`ensureTestSchema()` already runs that against the swapped URL, and leaving it would have targeted a
database that no longer exists in the CI service container.

### 3. `reorderRoomItems` does not purge the room's cached answers — FIXED

`backend/src/modules/items/service.ts:205-218` updates `displayOrder` and writes an audit entry,
but never purges `ChatAnswer`. Every other item write does:

- `createItem` — `items/service.ts:106`
- `updateItem` — `items/service.ts:133`
- `deleteItem` — `items/service.ts:165`

D1-6 requires "Purge the parent room's cached answers on write", and a reorder is a write. The
substantive question is whether ordering actually affects a cached answer, and it does: §10.3 of
the main plan builds the case-2 chat prompt from "the room overview, **the item list** keyed by
ID, and the question", and that list is ordered by `displayOrder`. Reordering therefore changes
the prompt the LLM would receive, so a cached answer no longer corresponds to what the current
content would produce.

**Fixed:** the purge now runs inside the existing transaction in `reorderRoomItems`, and the
existing reorder test asserts it. [docs/dev2-dev3-handoff.md](./dev2-dev3-handoff.md) was corrected
— it had documented the omission as deliberate, which would have misled Developers 2 and 3, who are
told in the same document that they never need to purge the cache themselves.

### 4. OpenAPI understates what several routes can return — FIXED

Three separate mismatches between the document and the implementation:

- **`GET /admin/items` can return 404 but does not declare it.** `listItems` calls
  `findRoomOrThrow`, which throws `ApiError.notFound('Room not found.')`
  (`backend/src/modules/items/service.ts:34-36`). This is tested
  (`backend/tests/integration/items.test.ts`), so it is real, documented behaviour missing from
  the contract. `scripts/generate-openapi.ts:304` declares only `errorResponses(400, 401, 403)`.
- **`413` is reachable on every JSON route and declared on none.** `express.json({ limit:
  '100kb' })` (`backend/src/app.ts:29`) rejects oversized bodies, and `errorHandler.ts` maps them
  to 413. No route in the document mentions 413.
- **`GET /health` is absent from the document entirely**, along with its 503 path
  (`backend/src/modules/health/router.ts:22` throws `upstreamUnavailable`). It is the endpoint a
  deployment platform polls, which makes it the one route most worth publishing.

**Fixed:** `GET /admin/items` now declares 404. `GET /health` is registered, with a new
`src/modules/health/schemas.ts` holding a `healthResponseSchema` the router is typed against, so the
published shape cannot drift from what the route returns; its 503 path is declared too. `413` is
declared on the nine routes that accept a body, and the document description explains the global
100kb cap once rather than repeating it per route. `DELETE /admin/rooms/{id}` also gained 400, which
finding 5 made reachable.

### 5. `DELETE /admin/rooms/:id?force=false` force-deletes — FIXED

`z.coerce.boolean()` in `backend/src/modules/rooms/schemas.ts:70` is `Boolean(input)`, and every
query-string value arrives as a string. Verified against the installed Zod 4:

```
{ force: 'false' } -> { force: true }
{ force: '0' }     -> { force: true }
{}                 -> {}
```

So the only way to get `force: false` is to omit the parameter entirely. `?force=false`,
`?force=0`, and `?force=no` all silently null out other rooms' `nextRoomId` pointers instead of
returning the `409 ROOM_REFERENCED` the caller was explicitly asking for. An admin UI that sends
its checkbox state on every request — the natural implementation — would destroy sequence links
with no warning and no confirmation. Nothing catches this today: the tests only cover the two
paths that happen to work, omitted (409) and `?force=true` (204).

This is the most user-visible defect found, because the failure is silent, destructive, and
triggered by the value a caller would reasonably send to mean "no".

**Fixed:** `force` is now `z.enum(['true', 'false']).optional().transform((v) => v === 'true')`, so
`false` is honoured as a refusal and anything unrecognised is a 400 rather than an accidental yes.
A test covers `false`, `False`, `0`, and `no` and asserts nothing was deleted; the Postman collection
pins all three outcomes against a live server. The generated contract now also describes `force`
honestly as a string enum instead of a boolean.

---

## 3. Tier 2 — coverage gaps

None of these are defects in shipped behaviour; each is behaviour that works but is not protected
against regression.

- **`GET /health` has no test.** Zero references to `/health` under `backend/tests/`. Neither the
  200 shape nor the 503-on-unreachable-database path is covered, despite this being the endpoint
  that gates a deploy.
- **The `X-Request-Id` response header is untested.** `backend/src/middleware/requestId.ts:15`
  sets it correctly and honours an inbound value, but tests only assert `error.requestId` in
  response bodies. The D1 plan lists "`X-Request-Id` on every response" as a deliverable, so the
  header specifically deserves an assertion.
- **Multi-page cursor pagination is only tested for museums**
  (`backend/tests/integration/museums.test.ts`). `listRooms` and `listItems` implement the same
  pattern but are never paged through in a test. Items are the most interesting case, because
  `displayOrder` is not unique within a room — the `id` tiebreaker is what keeps paging stable,
  and nothing verifies it.
- **"404 for a non-existent id" is untested** on `GET/PATCH /admin/rooms/:id`,
  `PATCH /admin/items/:id`, `PATCH /admin/museums/:id`, `POST /admin/items` (non-existent
  `roomId`), and `PATCH /admin/rooms/:id/items/order`. Cross-tenant 403 is well covered; plain
  absence is not.
- **The seed script has no test**, even though D1-2's exit criterion is "re-running the seed
  changes nothing, both museums have four rooms with correctly linked sequences, and no source
  field has been dropped". That was verified by hand. Idempotency is exactly the kind of property
  that breaks quietly later.
- **The per-IP login limiter is never exercised.** `backend/src/middleware/rateLimit.ts:20` skips
  the limiter entirely when `NODE_ENV === 'test'`, which is a reasonable choice (it would
  otherwise trip during the lockout and credential tests), but it means the 10-per-15-minutes cap
  has no automated proof. The per-email lockout is properly tested. Manually verified during this
  audit against the development server: the 11th login inside a window returns `429 RATE_LIMITED`,
  so the limiter itself works — only the regression protection is missing.
- **`deleteRoom` counts references outside its transaction.**
  `backend/src/modules/rooms/service.ts:243-251` runs `prisma.room.count({ where: { nextRoomId:
  id } })` before opening the transaction that deletes. A concurrent request pointing a room at
  this one between the count and the delete would slip past the `409 ROOM_REFERENCED` guard and
  have its pointer silently nulled by `onDelete: SetNull`. Low impact for a handful of trusted
  admins, worth knowing.

---

## 4. Tier 3 — specification and documentation inconsistencies

These need no code change. In each case the implementation made the right call and a document is
now wrong or misleading.

- **"Deletes for museums" does not exist and should not.** The D1 plan's Definition of Done
  (§5) says "Full CRUD including deletes for museums, rooms, and items", but §14.1 of the main
  plan says "There is no museum delete. Suspension via `status` is the supported path", enforced
  at the database level by `Room.museum onDelete: Restrict`
  (`backend/prisma/schema.prisma:61`). The implementation correctly follows §14.1. The Definition
  of Done wording is the defect and should be corrected to say suspension replaces deletion for
  museums, so a future reader does not "fix" this by adding the route.
- **§17.2 case 11 is impossible as written.** It specifies "Room **create** with `nextRoomId`
  forming a cycle". A room that does not exist yet cannot be the target of any existing pointer
  and its own ID is not knowable to the client before creation, so no cycle can form on create.
  `assertValidNextRoomId` accordingly skips the cycle walk when there is no room ID
  (`backend/src/modules/rooms/service.ts:100-102, 162-164`), and the matrix tests the property
  via PATCH, which is the only path where a cycle can actually form. The behaviour is right; the
  spec sentence is not.
- **§17.1's "isolated schema per test file" is not what was built.** The suite shares one test
  database, truncates between tests, and disables file parallelism
  (`backend/vitest.config.ts:7`). Functionally equivalent while tests run serially, and simpler.
  The consequence worth recording: the suite cannot be parallelised without revisiting this, and
  it already takes over three minutes.
- **JWT carries `iat` and `exp` in addition to `{ sub, role, museumId }`.** Standard
  `jsonwebtoken` behaviour and required for expiry to work at all. Noted only because the plan
  states the payload exactly; it is not a deviation worth changing.
- **The absence of a museum DELETE route is explained only in the main plan**, not in
  `backend/src/modules/museums/router.ts`. A one-line comment there would prevent someone adding
  the route without reading §14.1.

---

## 5. Verified working — highlights

Recorded so a future audit does not have to re-derive them.

- **Tenant scope is resolved from the database everywhere.** `resolveMuseumIdFromParam`
  (`museums/service.ts:47-52`), `resolveRoomMuseumId` (`rooms/service.ts:34-39`), and
  `resolveItemMuseumId` (`items/service.ts:54-59`) each issue a Prisma read keyed on
  `req.params.id`. For routes with no existing record to resolve — list and create — scope comes
  from the token for a `MUSEUM_ADMIN` and the body/query is ignored (`rooms/service.ts:47-59`,
  `154-159`), which is the §14.2 rule.
- **Login timing parity is real, not nominal.** A dummy hash is precomputed once at module load
  and compared against when the email is unknown (`auth/service.ts:11, 22-26`), so an unknown
  account still pays the bcrypt cost. Both failure paths throw the same
  `ApiError.invalidCredentials()`.
- **Suspension takes effect on the next request.** `requireAuth` re-reads museum status from the
  database on every authenticated request carrying a `museumId`
  (`backend/src/middleware/requireAuth.ts:30-39`), so a token issued before suspension stops
  working immediately rather than at its 12-hour expiry.
- **Cycle detection is correct** for self-loops, `A -> B -> A`, and longer chains, and is bounded
  by a `visited` set (`rooms/service.ts:66-81`).
- **Museum creation is atomic.** Museum, first admin, and both audit entries are created in one
  `$transaction` (`museums/service.ts:107-133`), so a partial failure leaves neither orphan.
- **Duplicate slug and email are caught explicitly** with `409 CONFLICT`
  (`museums/service.ts:98-102, 190-191`), with the generic P2002 handler in `errorHandler.ts:78`
  as a backstop for the concurrent race.
- **`.env.example` and `src/config/env.ts` agree in both directions** — no variable required by
  one is missing from the other — and the app calls `process.exit(1)` on invalid configuration
  rather than booting with defaults (`env.ts:70-85`).

---

## 6. What was actioned, and what is still open

All five Tier 1 findings are fixed, in the order they were prioritised: finding 5 first as the only
silent and destructive one, then finding 3 as the other behavioural bug, then the two cheap CI
guards, then contract accuracy.

Still open, deliberately:

- **Tier 2**, in the order listed. `/health` and the `X-Request-Id` header are the two whose absence
  contradicts an explicit D1 deliverable, so they come first — though both now have live coverage
  through the Postman collection, which is why they are no longer urgent. `deleteRoom`'s
  outside-the-transaction reference count is the only one with a correctness edge, and it needs a
  concurrent writer to trigger.
- **Tier 3** document corrections, which cost minutes and prevent a future reader from "fixing"
  deliberate decisions. The most valuable is the Definition of Done's claim that museums can be
  deleted, since someone could act on it.

---

## 7. How to reproduce this audit

`backend/postman/` holds a Postman collection that exercises the whole admin surface against a
running server, including the tenant-isolation matrix and the error-envelope contract. See
[backend/postman/README.md](../backend/postman/README.md). Three findings above are directly
observable through it: the `X-Request-Id` header is asserted collection-wide, the `/health` route
gains its first coverage there, and all three `?force=` outcomes from finding 5 are pinned against a
live server.
