# Postman tests for the admin API

An end-to-end test pass over everything Developer 1 built, run against a **live server and a real
database**. It covers all 16 admin routes plus `/health`, the tenant-isolation matrix, and the
error-envelope contract.

This complements the automated suite (`npm test`) rather than replacing it. The Vitest suite proves
the code is correct in isolation; this collection proves a running, seeded server behaves correctly
when driven the way a client actually drives it — chained requests, real tokens, real cursors.

Files:

| File | What it is |
| ---- | ---------- |
| `Adwa-Admin-API.postman_collection.json` | The collection: 7 folders, 74 requests, 290 assertions |
| `Adwa-Local.postman_environment.json` | Environment for a local server. Passwords ship empty |

Last verified: 290/290 assertions passing against a freshly seeded local database.

---

## 1. Prerequisites, in this order

Everything below runs from `backend/`.

```powershell
# 1. Database up
npm run db:up            # or make sure your own local Postgres is running

# 2. Schema
npx prisma migrate deploy

# 3. Seed — the collection depends on the two seeded museums and their admins
npm run seed

# 4. Server
npm run dev
```

Confirm the server is answering before you start:

```powershell
curl http://localhost:3001/health
```

The collection needs the seed to have run, because it logs in as the seeded system admin and the
seeded Adwa museum admin, and it asserts that both `adwa` and `louvre` appear in the museum list.

---

## 2. Fill in the two passwords

`Adwa-Local.postman_environment.json` ships with both password fields **empty and marked secret**,
so no credential is ever committed. Fill them from your own `backend/.env`:

| Environment variable | Copy from `.env` |
| -------------------- | ---------------- |
| `systemAdminPassword` | `SEED_SYSTEM_ADMIN_PASSWORD` |
| `museumAdminPassword` | `SEED_MUSEUM_ADMIN_PASSWORD` |

Also check these two match your `.env`, and adjust if you changed them:

- `systemAdminEmail` — defaults to `system@adwa.dev`, must equal `SEED_SYSTEM_ADMIN_EMAIL`
- `baseUrl` — defaults to `http://localhost:3001`, must match `PORT`

`baseUrl` deliberately uses **3001**, which is the port in the committed local `.env`, not the
`3000` in `.env.example`.

`qaAdminPassword` is not a secret: it is the password assigned to the throwaway museum the
collection creates and deletes on each run.

If the very first login fails, its test script says so explicitly — that error almost always means
one of these four values is wrong, or the seed has not been run.

---

## 3. Run it

### Postman app

1. **Import** both JSON files (`File > Import`).
2. Select **Adwa Local** in the environment dropdown, top right.
3. Fill in the two passwords (the eye icon reveals secret fields).
4. Open the collection's **⋯** menu, choose **Run collection**.
5. Leave **Keep variable values** on and the folder order untouched, then **Run**.

Expect every assertion to pass. Run it a second time straight away — a clean second run is the
point of the design (see section 6).

### newman (CLI, optional)

```powershell
npx newman run postman/Adwa-Admin-API.postman_collection.json `
  -e postman/Adwa-Local.postman_environment.json `
  --env-var "systemAdminPassword=<your SEED_SYSTEM_ADMIN_PASSWORD>" `
  --env-var "museumAdminPassword=<your SEED_MUSEUM_ADMIN_PASSWORD>"
```

Passing the passwords as `--env-var` keeps them out of the committed environment file and out of
your shell history if you use a variable instead of a literal.

Newman is intentionally **not** wired into CI. It would need a running server plus seeded content,
which the Vitest suite already covers more cheaply and hermetically.

---

## 4. Run the folders in order

Requests chain: each one saves the tokens and IDs the later ones need. Running a single request in
isolation will fail on an empty `{{museumAToken}}` or `{{roomAId}}`.

The per-run unique values (slug, emails, `storyOrder`s) are generated in the **pre-request script of
`00 Health`**, which is another reason every run starts at the top.

---

## 5. What each folder proves

**00 Health** — the service is up and completed a real `SELECT 1`. This is also the only coverage
`GET /health` has anywhere; the automated suite has none, which is recorded as a Tier 2 gap in
[`docs/d1-audit.md`](../../docs/d1-audit.md).

**01 Auth** — both seeded accounts can log in, a system admin's `museumId` is null, and tokens
expire in ~12 hours. Then the failure modes: wrong password and unknown email produce **identical
messages** (so the API never reveals which emails are registered), a missing token is 401 and not
403, a malformed token is 401 and not 500, malformed JSON is 400, an oversized body is 413, and an
unmatched `/admin` path is 404 for an authenticated caller.

**02 Museums** — system-admin-only tenant management. Pages through the list with `limit=1` and
asserts page two does not repeat page one, which closes a real coverage gap (multi-page pagination
is only tested for museums in the automated suite, and not at all against a live cursor). Creates
the throwaway museum B with its first admin in one transaction, then logs in as that admin to prove
the password was stored correctly. Duplicate slug and duplicate email are both 409; a malformed
slug is 400 with a `details` array naming the field.

**03 Rooms** — starts with the two most important requests in the collection: a create whose **body
claims a different museum** and a list whose **query string claims a different museum**. Both must
be ignored in favour of the token, or one museum could read and write another's content. Then room
sequence integrity: a `nextRoomId` pointing into another museum is 422, a self-referencing cycle is
422, deleting a referenced room is 409, and `?force=true` deletes it while the database nulls the
dangling pointer.

**04 Items** — item CRUD, `displayOrder` defaulting and appending, and the bulk reorder route, with
a follow-up read asserting the resulting order is exactly `0,1,2` in the requested sequence. A
partial `itemIds` list is rejected rather than partially applied.

**05 Tenant isolation** — the live mirror of the automated matrix. Museum A's token is pointed at
museum B's museum, room, and item for every verb, expecting `403 CROSS_TENANT_ACCESS` each time.
Two requests are worth reading closely:

- **the control case** — the same request that A was refused succeeds for the system admin, proving
  each 403 came from scope enforcement rather than a broken route
- **suspension** — a token issued *before* museum B was suspended is refused anyway, because auth
  re-reads museum status from the database on every request. Reactivating makes the same token work
  again

**06 Cleanup** — deletes every room the run created (items cascade), verifies nothing is left
behind, and suspends museum B.

Two checks run on **every** request via a collection-level script, so they account for 120 of the
290 assertions without being written out 74 times:

- every response carries an `X-Request-Id` header
- every response of 400 or above has `error.message`, `error.code`, and `error.requestId`, and that
  `requestId` matches the header

---

## 6. Repeatability

The collection is built to be run repeatedly against the same database:

- the museum slug, admin emails, and room `storyOrder`s all carry a per-run unique suffix, so a
  second run cannot collide with the first
- every room it creates is deleted in `06 Cleanup`, and one request explicitly asserts no `QA `
  room survived
- the last request in `06 Cleanup` asserts museum A is back to its seeded rooms — if that fails,
  something leaked and the next run may hit a `storyOrder` conflict

Two things do not fully clean up, both unavoidable:

- **Museum B survives.** There is deliberately no museum delete route — suspension replaces it — so
  each run leaves one suspended `qa-*` museum and two `qa-*` admin accounts. They are inert. If
  they accumulate past the point of being tidy, remove them directly:

  ```sql
  DELETE FROM "AdminUser" WHERE email LIKE 'qa-%@example.test';
  DELETE FROM "Museum"    WHERE slug  LIKE 'qa-%';
  ```

  (Delete the admins first: `Room.museumId` uses `onDelete: Restrict`, and a museum with rooms will
  refuse to go. These QA museums have no rooms left after cleanup, so this order is enough.)

- **Login rate limit.** `POST /admin/login` allows 10 requests per IP per 15 minutes outside
  `NODE_ENV=test`. Each run spends 5, so **two back-to-back runs fit and a third will legitimately
  return `429 RATE_LIMITED`** — verified: the 11th login in a window is refused. The limiter is
  in-memory, so restarting `npm run dev` resets the window immediately. A 429 on a third
  consecutive run is the limiter working, not a broken test.

  The malformed-JSON and oversized-body requests do not count towards this: the body parser rejects
  them before the login router runs.

Failed-login lockout is not a problem. It triggers after 5 consecutive failures for one email, and
the collection's single wrong-password attempt targets the system admin — whose successful login two
requests earlier resets the counter, so failures never accumulate across runs.

---

## 7. Regression guards worth knowing about

Three requests in `03 Rooms` exist because of a bug the audit found and that has since been fixed:
`?force=false` used to **delete the room anyway**. `force` was parsed with `z.coerce.boolean()`, and
`Boolean('false')` is `true`, so the string turned the flag on — meaning any UI sending its checkbox
state would silently destroy sequence links. It is now an explicit `'true' | 'false'` enum, and the
collection pins all three paths: `false` refuses with 409, `0` is rejected with 400, and only `true`
deletes.

That was Tier 1 finding 5 in [`docs/d1-audit.md`](../../docs/d1-audit.md), which records the full
audit and the state of every other finding.

---

## 8. Pointing it at the mock server

`npm run mock` serves the D1-0 mock on port 4000. Setting `baseUrl` to `http://localhost:4000` will
get you through the shape-level requests, but **most of this collection will fail there, correctly**:

- the mock issues fake tokens and does no bcrypt, so real login assertions do not apply
- it has no database, so cascades, cursors, transactions, and the cache purges are not real
- suspension, cycle detection, and `409 ROOM_REFERENCED` are not modelled

The mock exists to unblock frontend work against the contract. Use this collection against the real
server on 3001.

---

## 9. Editing the collection

If you re-export from the Postman app, expect it to reformat the JSON. That is fine: `postman/` is
listed in `backend/.prettierignore`, so a re-export cannot fail the `npm run format` check in CI.

Keep the two conventions the collection relies on:

- **save what later requests need**, with `pm.environment.set`, guarded by a status check so a
  failed request does not store `undefined`
- **assert behaviour, not just status codes.** A request that only checks `200` has told you almost
  nothing
