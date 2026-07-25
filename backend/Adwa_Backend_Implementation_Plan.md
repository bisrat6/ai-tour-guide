# Adwa AI Tour Guide — Backend Implementation Plan

A complete, standalone specification for the backend: data model, authentication, every API endpoint, business logic, third-party integrations, multi-tenancy enforcement, and an implementation order. No tooling-specific prompts, no role assignments — this is the backend's contract with the rest of the system (the Flutter visitor app and the admin web app), detailed enough to build against directly.

---

## 1. Scope & Goals

The backend is a single Express service with three responsibilities:

1. **Serve visitor-facing content** — room/item data, grounded chat answers, and generated audio — to the Flutter app, for any number of museums.
2. **Serve admin operations** — authentication, and CRUD on museums/rooms/items — to a single role-based admin web app.
3. **Own every third-party credential.** Nothing outside this service ever holds an API key, a vendor URL, or a database connection string. The Flutter app and the admin app only ever talk to this backend.

Everything below assumes a multi-tenant system: multiple museums, each with isolated content, each with its own admin(s), all served by one deployment.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js + Express | Simple, well-understood, fast to iterate on |
| Database | Postgres | Relational integrity matters once there's more than one tenant — foreign keys enforce that a room can't dangle without a museum |
| ORM | Prisma | Fast schema iteration, migrations, and a query API that makes tenant-scoping explicit rather than easy to forget |
| Auth | JWT (stateless) | No session store needed; the token carries `role` and `museumId` directly |
| Password hashing | bcrypt | Standard, no reason to deviate |
| Hosting | Render (Web Service + managed Postgres) | One platform for both, minimal ops overhead |
| Chat/LLM | Addis AI | Grounded answer generation only — see §7 |
| TTS | ElevenLabs (`eleven_flash_v2_5`, streamed) | Low-latency, room narration + chat answers |

There is no speech-to-text provider in this stack. Transcription happens on-device in the Flutter app; the backend never receives raw audio for transcription. (See §6.3 for why.)

---

## 3. Environment Variables

```
DATABASE_URL=              # Postgres connection string
JWT_SECRET=                # signing secret for admin auth tokens
ADDIS_AI_API_KEY=
ELEVENLABS_API_KEY=
FIRECRAWL_API_KEY=         # used offline, during content authoring — not called at runtime
FAL_API_KEY=                # used offline, during image generation — not called at runtime

TELEBIRR_APP_ID=           # Fabric Payment Gateway app ID (from Ethio Telecom developer portal)
TELEBIRR_APP_KEY=          # Fabric Payment Gateway app key
TELEBIRR_SHORT_CODE=       # merchant short code assigned by Telebirr
TELEBIRR_PUBLIC_KEY=       # Telebirr's public key — used to verify inbound webhook signatures
TELEBIRR_PRIVATE_KEY=      # this service's private key — used to sign outbound order requests
TELEBIRR_API_BASE_URL=     # Fabric gateway base URL (sandbox vs production)
TELEBIRR_NOTIFY_URL=       # this service's public webhook endpoint — see §14.3
TELEBIRR_RETURN_URL=       # browser redirect target after payment — UX only, not authoritative
```

`FIRECRAWL_API_KEY` and `FAL_API_KEY` don't need to be available in the deployed runtime at all if content/image generation is done as a one-off local script — worth deciding where that script runs and scoping the key accordingly.

---

## 4. Data Model

### 4.1 Schema

```prisma
enum MuseumStatus {
  ACTIVE
  SUSPENDED
}

enum AdminRole {
  SYSTEM_ADMIN
  MUSEUM_ADMIN
}

model Museum {
  id                  String       @id @default(uuid())
  name                String
  slug                String       @unique
  status              MuseumStatus @default(ACTIVE)
  ticketValidationUrl String?      // null = no ticketing gate for this museum
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  adminUsers AdminUser[]
  rooms      Room[]
}

model AdminUser {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  role         AdminRole
  museumId     String?              // null for SYSTEM_ADMIN, required for MUSEUM_ADMIN
  museum       Museum?   @relation(fields: [museumId], references: [id])
  createdAt    DateTime  @default(now())
}

model Room {
  id               String   @id @default(uuid())   // globally unique — this is what a QR code encodes
  museumId         String
  museum           Museum   @relation(fields: [museumId], references: [id])
  storyOrder       Int
  title            String
  roomOverviewText String   @db.Text
  roomAudioUrl     String?
  nextRoomId       String?
  nextRoom         Room?    @relation("RoomSequence", fields: [nextRoomId], references: [id])
  previousRooms    Room[]   @relation("RoomSequence")

  items Item[]

  @@index([museumId])
}

model Item {
  id               String  @id @default(uuid())
  roomId           String
  room             Room    @relation(fields: [roomId], references: [id])
  name             String
  shortDescription String
  detailText       String  @db.Text
  imageUrl         String?

  @@index([roomId])
}
```

### 4.2 Design notes

- **`Room.id` is globally unique across all museums, not scoped per-museum.** This is the load-bearing decision in the whole schema: a QR code only ever needs to encode one room ID. The visitor app never needs to know which museum it's looking at — `GET /waypoint/:id` derives the museum internally via the `museum` relation and checks its `status`. This keeps the visitor-facing API surface identical regardless of how many museums exist.
- **`AdminUser.museumId` is nullable specifically to distinguish the two roles without a separate table.** A `SYSTEM_ADMIN` has `museumId: null` and can act on any museum. A `MUSEUM_ADMIN` has a `museumId` set and every write they attempt must be checked against it (§5.3).
- **`Museum.ticketValidationUrl` is nullable and defaults to null.** No museum requires a ticket unless an admin explicitly sets this. See §8 for the full flow.
- **No `language` field anywhere.** This system is single-language by design — see §6.3 for why that's a deliberate simplification, not an oversight.

---

## 5. Authentication & Authorization

### 5.1 Login

`POST /admin/login`
Request: `{ email, password }`
Logic: look up `AdminUser` by email, compare password against `passwordHash` with bcrypt, on success sign a JWT containing `{ sub: adminUser.id, role, museumId }` with a reasonable expiry (e.g. 12 hours — this is an internal admin tool, not a consumer app, so a long-lived session is fine).
Response: `{ token, role, museumId }`
Failure: `401` with a generic "invalid credentials" message — don't distinguish "email not found" from "wrong password," that's a minor enumeration leak with no upside.

There is no signup route. Admin accounts are created two ways:
- `SYSTEM_ADMIN` accounts are seeded directly at deploy time (there should only ever be a small, known number of these).
- `MUSEUM_ADMIN` accounts are created by `POST /admin/museums` (§6.5) as a side effect of onboarding a new museum, or by a dedicated `POST /admin/museums/:id/admins` route if a museum needs more than one admin account later.

### 5.2 Middleware: `requireAuth`

Runs on every `/admin/*` route. Reads `Authorization: Bearer <token>`, verifies the JWT signature and expiry, and attaches the decoded payload to `req.admin` as `{ id, role, museumId }`. On any failure (missing header, invalid signature, expired token), respond `401`.

### 5.3 Middleware: `requireRole(role)`

Checks `req.admin.role === role`. Used to gate `SYSTEM_ADMIN`-only routes (museum creation/suspension). On mismatch, respond `403`.

### 5.4 Middleware: `requireMuseumScope`

This is the one piece of security in the whole system that actually matters for the product's core promise (tenant isolation), so it deserves to be built carefully, not fast.

For any admin route touching a `Room` or `Item`, this middleware must:
1. Resolve the `museumId` that the targeted resource actually belongs to (for a room, that's `room.museumId`; for an item, that's `item.room.museumId` — a lookup, not a value trusted from the request body).
2. If `req.admin.role === 'SYSTEM_ADMIN'`, allow — system admins can act on any museum's resources for support purposes.
3. Otherwise, require `req.admin.museumId === resolvedMuseumId`. On mismatch, respond `403`.

**Important implementation detail:** this check must resolve the museum ID from the database record being acted on, never from a `museum_id` field trusted directly off the request body or query string. Otherwise a museum admin could simply claim a different `museum_id` in their request and bypass the check entirely.

### 5.5 What's deliberately not built

No password reset flow, no email verification, no refresh-token rotation, no multi-factor auth. This is a fine set of cuts for an internal admin tool serving a small number of known museums; it stops being fine the moment this is opened to self-serve public signup, which is out of scope here.

---

## 6. Visitor-Facing API

Three routes total. All are public (no auth) — visitor access is gated by ticket validation if a museum opts into it (§8), not by login.

### 6.1 `GET /waypoint/:id`

Fetches a single room and its items.

**Logic:**
1. Look up `Room` by `id`, including its `items` and its `museum`.
2. If not found, `404`.
3. If `room.museum.status === 'SUSPENDED'`, `404` as well — a suspended museum's content should be indistinguishable from content that doesn't exist, not surfaced with a special error that reveals platform-internal state to a visitor.
4. Return the room object with its items, shaped for direct client consumption:

```json
{
  "id": "uuid",
  "storyOrder": 3,
  "title": "Mobilization Hall",
  "roomOverviewText": "...",
  "roomAudioUrl": "https://...",
  "nextRoomId": "uuid-or-null",
  "items": [
    { "id": "uuid", "name": "...", "shortDescription": "...", "detailText": "...", "imageUrl": "..." }
  ]
}
```

Do not include `museumId` in this response — the visitor app has no use for it, and there's no reason to expose internal tenant structure to the client even though it isn't sensitive.

### 6.2 `POST /chat`

The core grounded-answer route. This is the highest-complexity logic in the whole backend — see §7 for the full algorithm.

**Request:** `{ waypointId, itemId, question }` — `itemId` is nullable.

**Response:**
```json
{
  "answer": "...",
  "matchedItemId": "uuid-or-null",
  "imageUrl": "https://...-or-null",
  "audioUrl": "https://..."
}
```

**Validation:** `waypointId` and `question` are required; reject with `400` if either is missing or `question` is empty after trimming. `itemId`, if provided, must belong to the room identified by `waypointId` — if it doesn't (a stale client, a manipulated request, or an item that's since been deleted by an admin), treat it the same as `itemId: null` rather than erroring, since falling back to room-level grounding is a better visitor experience than a hard failure.

### 6.3 `POST /narrate`

Generates TTS audio from provided text — used both for pre-generating room overview narration (as a one-off, offline step, not called live) and for generating audio for chat answers (called live, on every `/chat` response).

**Request:** `{ text }`
**Response:** `{ audioUrl }`, or a streamed audio response directly — see §7.4 for the streaming decision.

**Why there's no `/transcribe` route:** speech-to-text runs entirely on-device in the Flutter app (via the platform's native speech recognition), not on the backend. This was a deliberate simplification once Amharic support was cut from scope — Amharic was the only reason server-side STT existed (on-device recognizers don't reliably support it), and once it's gone, the backend has no speech input to handle at all. If a second language is added back later, this is the route that would need to return — see §11 for how to re-introduce it without disrupting the rest of the API.

---

## 7. Chat Grounding Logic (`POST /chat`, in detail)

This is worth its own section because it's the part of the system most likely to misbehave subtly, and subtlety is the dangerous kind of bug here — a wrong-but-confident answer at a memorial museum is a real failure mode, not just an inconvenience.

### 7.1 Case 1 — `itemId` is provided

The visitor tapped a specific item before asking. Grounding is unambiguous:

1. Fetch the item by `itemId`, confirm it belongs to `waypointId`'s room (§6.2 validation).
2. Send the question and the item's `detailText` to Addis AI's chat endpoint with an explicit system instruction: answer only from the provided content, in 2-3 spoken-length sentences, and state plainly if the content doesn't cover the question rather than inventing an answer.
3. Return `{ answer, matchedItemId: itemId, imageUrl: item.imageUrl }`.

### 7.2 Case 2 — `itemId` is null (free-form question)

The visitor asked without specifying an item. The backend has to figure out what they mean, in the same call as generating the answer:

1. Fetch the room's full item list (`name` + `shortDescription` for every item) and the room's `roomOverviewText`.
2. Build a single prompt containing: the room overview, the list of items with their short descriptions, and the visitor's question. Instruct the model to return structured JSON: `{ matchedItemId: string | null, answer: string }` — deciding which item (if any) the question refers to, and answering using only that item's full `detailText` (also provided in the prompt, keyed by ID) if one was matched, or the room overview otherwise.
3. Parse the structured response. If `matchedItemId` is non-null, verify it's actually one of the room's item IDs (defend against the model hallucinating an ID) — if it isn't, treat as `null`.
4. Look up `imageUrl` for the matched item if any.
5. Return `{ answer, matchedItemId, imageUrl }`.

### 7.3 Why this needs adversarial testing, not just happy-path testing

The model is being asked to do two things in one call — classify intent *and* generate a grounded answer — which is more failure-prone than either task alone. Before treating this route as done:

- **Test ambiguous matching.** For every room, construct 3-4 questions where the "right" item genuinely isn't obvious from wording alone (two items that are both letters; a question using a physical description rather than a name). Confirm the match is reasonable, and confirm the room-overview fallback triggers sensibly when it should rather than forcing a bad match.
- **Test fact fidelity, separately from matching.** The model never returns `detailText` verbatim — it's asked to synthesize a fresh, question-specific, spoken-length answer from it, which is the correct design (a canned restatement wouldn't handle varied questions) but is exactly where subtle drift can creep in: a softened claim, a generalized date, a dropped nuance. For the same test questions, read the generated answer back against its source `detailText` line by line and confirm nothing was invented, softened, or misstated — not just that the right item got matched. This matters more here than in a typical grounded-chat app because the content is historical and commemorative.

### 7.4 TTS generation for chat answers

Every `/chat` response needs audio. Use `eleven_flash_v2_5` specifically (not Turbo or Multilingual v2 — it's the model built for low latency) and stream the response rather than waiting for the full audio file to generate before returning anything to the client. Full-file (non-streamed) generation is acceptable for room narration audio, since that's generated once, offline, ahead of time, and isn't on any live request path.

---

## 8. Ticket Validation

An optional, per-museum gate — most museums will leave this unset and it will have zero effect on them.

### 8.1 Data

`Museum.ticketValidationUrl` (nullable string). Set by a museum admin via the admin API (§9.3); null by default.

### 8.2 Route: `POST /tickets/validate`

**Request:** `{ museumId, ticketCode }`
**Logic:**
1. Look up the museum by `museumId`. If not found, `404`.
2. If `museum.ticketValidationUrl` is null, return `{ valid: true, ticketRequired: false }` immediately — no external call, no gate.
3. If it's set, call that URL server-side with the ticket code (the vendor's API key, if one is needed, lives in backend config scoped to that call — never passed to or through the client) and map its response to `{ valid: boolean, ticketRequired: true }`.

**Response:** `{ valid, ticketRequired }`

This route is public (no admin auth) since it's called by visitors before they've authenticated as anyone — there's no visitor account system in this design, just a one-time gate.

### 8.3 Client-side flow (for context, not backend work)

Validation happens once per visit, not per room: the app checks whether the museum it's about to show requires a ticket, prompts once if so, and holds a local session flag afterward so it doesn't re-prompt at every QR scan. A museum with no `ticketValidationUrl` set never triggers any of this.

### 8.4 No real vendor yet — build against a stub

Until a real ticketing vendor is chosen, `ticketValidationUrl` should point at a minimal self-hosted stub route (`POST /stub-ticket-vendor` or similar) that checks the code against a small hardcoded list of valid demo codes and returns `{ valid: boolean }`. This exercises the entire flow — configurable gate, server-side validation call, pass/fail response — without pretending an integration exists. Swapping in a real vendor later means changing one config value (`ticketValidationUrl`) per museum; it requires no changes to `/tickets/validate` itself, provided the real vendor's response can be mapped to a boolean `valid` field (if its response shape differs, that mapping logic is the only thing that would need to change).

---

## 9. Admin API

All routes below require `requireAuth` (§5.2); routes marked *(system)* also require `requireRole('SYSTEM_ADMIN')`; routes marked *(scoped)* also require `requireMuseumScope` (§5.4).

### 9.1 Museums *(system for write operations)*

- `GET /admin/museums` — list all museums. System admin only.
- `POST /admin/museums` — create a museum. Body: `{ name, slug }`, plus enough to bootstrap its first admin account: `{ adminEmail, adminPassword }`. On success, creates both the `Museum` row and a `MUSEUM_ADMIN` `AdminUser` row scoped to it in one transaction — a museum with no way to log into it is a dead end.
- `PATCH /admin/museums/:id` — update `status` (activate/suspend) or `ticketValidationUrl`. System admin for `status`; a museum's own admin should also be able to set `ticketValidationUrl` for their own museum (this is the one field a `MUSEUM_ADMIN` can write on the `Museum` model itself — gate it with `requireMuseumScope` rather than `requireRole('SYSTEM_ADMIN')`).

### 9.2 Rooms *(scoped)*

- `GET /admin/rooms?museumId=` — list rooms. If the caller is a `MUSEUM_ADMIN`, ignore any provided `museumId` and use `req.admin.museumId` instead (never trust a museum ID from the query string over the one on the token). If `SYSTEM_ADMIN`, `museumId` is required as a query param.
- `POST /admin/rooms` — create a room. Body: `{ title, roomOverviewText, storyOrder, nextRoomId }`. `museumId` is taken from `req.admin.museumId` for a `MUSEUM_ADMIN`, or must be supplied explicitly for a `SYSTEM_ADMIN`.
- `PATCH /admin/rooms/:id` — update a room. `requireMuseumScope` resolves the museum from the existing room record, not the request body.

### 9.3 Items *(scoped)*

- `GET /admin/items?roomId=`
- `POST /admin/items` — body: `{ roomId, name, shortDescription, detailText, imageUrl }`. `requireMuseumScope` resolves via `room.museumId`.
- `PATCH /admin/items/:id` — same scoping logic.

### 9.4 A note on `next_room_id` validation

When creating or editing a room, if `nextRoomId` is provided, verify it refers to a room in the *same* museum. There's no correctness reason a room's "next" pointer should ever cross a tenant boundary, and allowing it would be a small but real tenant-isolation leak (an admin could otherwise link their room's flow into another museum's content).

---

## 10. Multi-Tenancy Isolation — Testing Checklist

Because this is the one thing that can't be hand-waved: before considering the admin API "done," explicitly verify —

1. Log in as museum A's admin. Attempt to `GET`, `PATCH` a room/item belonging to museum B by ID directly. Confirm `403` in every case.
2. Log in as museum A's admin. Attempt to create a room with `nextRoomId` pointing at a room in museum B. Confirm rejection.
3. Log in as museum A's admin. Call `GET /admin/rooms` with a manipulated `museumId` query param pointing at museum B. Confirm the response still only contains museum A's rooms (i.e. confirm the query param is actually ignored for non-system-admins, not just weakly checked).
4. Confirm a `SYSTEM_ADMIN` token *can* access any museum's resources (this is intentional, not a bug — don't over-restrict it).
5. Confirm a suspended museum's rooms return `404` from `GET /waypoint/:id`, not a normal response.

---

## 11. Error Handling Conventions

Standardize error responses across the whole API rather than letting each route improvise its own shape:

```json
{ "error": { "message": "human-readable description", "code": "MACHINE_READABLE_CODE" } }
```

- `400` — malformed/missing request fields.
- `401` — missing or invalid auth token.
- `403` — authenticated, but not permitted (wrong role, wrong museum scope).
- `404` — resource doesn't exist, or (deliberately, per §6.1) exists but belongs to a suspended museum.
- `502` — a downstream third-party call (Addis AI, ElevenLabs, a ticket vendor) failed. Don't leak the raw upstream error body to the client; log it server-side and return a generic message.

For `/chat` specifically: if the Addis AI call itself fails (not just returns a poor answer, but errors), don't fall back to a fabricated answer — return `502` and let the client show a clear "couldn't get an answer, try again" state. A visible failure is better than a silently wrong one at a memorial museum.

---

## 12. Implementation Order

Ordered by dependency, not by calendar time — build top to bottom, since each phase assumes the previous one exists.

**Phase 1 — Foundation**
Provision Postgres, set up Prisma, write and run the initial migration for the schema in §4.1. Stand up the bare Express app with `/health`. Seed one `SYSTEM_ADMIN` account directly in the database.

**Phase 2 — Visitor read path**
Build `GET /waypoint/:id` (§6.1) against seeded data (a script or manual insert is fine here — the admin API doesn't need to exist yet for this to be testable).

**Phase 3 — Auth**
Build `POST /admin/login` and the three middleware functions (§5.2-5.4). Test them against the seeded system-admin account and a manually-inserted museum-admin account before building anything that depends on them.

**Phase 4 — Admin write path**
Build the museum, room, and item admin routes (§9), in that order — museums first since rooms depend on a museum existing, items last since they depend on rooms. Run the full isolation testing checklist (§10) before moving on; this is the phase where a shortcut costs the most later.

**Phase 5 — Chat**
Build `/chat` case 1 (item specified) first, since it's the simpler and lower-risk path — verify grounding works and answers are appropriately scoped before adding case 2's classification logic on top. Then build case 2, and immediately follow it with the adversarial matching + fact-fidelity test pass described in §7.3, rather than treating that testing as optional cleanup.

**Phase 6 — Narration**
Build `/narrate` with streaming (§7.4). Generate and store the room-overview audio for all rooms as a one-off offline step once content exists — this does not need to be a live endpoint call on any user-facing path.

**Phase 7 — Ticket validation**
Build `Museum.ticketValidationUrl`, `/tickets/validate`, and the local stub vendor (§8). Confirm the default (no URL set) path adds zero friction before wiring up the stub for any museum that should demonstrate it.

**Phase 8 — Hardening**
Standardize error responses (§11) across all routes if they've drifted during earlier phases. Re-run the full isolation checklist (§10) once more after all routes exist, since new routes are exactly where scoping gaps get introduced. Confirm every third-party failure mode (§11) degrades visibly rather than silently.

---

## 13. What's Explicitly Out of Scope Here

- Billing/subscriptions were previously out of scope; they are now covered in §14. What remains out of scope regarding money: any billing method other than Telebirr (no cards, no bank transfer, no other mobile-money provider) unless added later as a second, parallel payment path.
- Any visitor-facing account system (visitors are anonymous; ticket validation is a one-time gate, not a login).
- Amharic or any second language — cut entirely; no `language` field exists anywhere in this schema or API.
- Realtime voice (a persistent conversational session) — the entire voice interaction is request/response: on-device transcription → `/chat` → `/narrate`.
- Real ticketing vendor integration — stubbed per §8.4 until one is chosen.

---

## 14. Monetization — SaaS Tiers & Telebirr Billing

Adwa is sold to museums as a subscription platform, not per-visitor. A museum's admin account carries a tier; the tier gates what that museum can configure and how much it can host. Payment is collected through Telebirr, since it's the dominant mobile-money rail for Ethiopian institutional customers.

### 14.1 Tier definitions

| Tier | Target | Included |
|---|---|---|
| **Basic** | Small galleries | 1 floor plan, limited 3D model hosting, basic timeline (room-sequence) features, standard analytics |
| **Pro** | Mid-sized museums | Up to 3 floors, advanced OpenHPS spatial routing, higher 3D model storage, custom branding |
| **Enterprise** | Massive institutions | Unlimited beacons, complex multi-building navigation, white-labeled App Store delivery, deep visitor-traffic analytics |

**A scope note worth flagging rather than glossing over:** the schema in §4 has `Museum → Room → Item`, no concept of a "floor," a "beacon," a "3D model," or OpenHPS-based indoor positioning — the current system is QR-code-per-room, not beacon-triangulated indoor routing. That's fine; it means two of the three tiers (Pro's "advanced spatial routing," Enterprise's "beacons" and "multi-building navigation") describe a superset of what's built, not what exists today. Treat those specific line items as **roadmap features gated behind the tier**, not as things this phase implements. What Phase 9 (below) actually builds is the tier/billing *mechanism* — the field, the limit checks, the payment flow — using `Room` count as the enforceable proxy for "floor" today. When beacon/3D/OpenHPS features land later, they plug into the same tier check rather than requiring a new gating system.

### 14.2 Data model additions

```prisma
enum SubscriptionTier {
  BASIC
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE      // paid and current
  PAST_DUE    // renewal payment failed or lapsed
  CANCELED    // museum opted out or was downgraded off the platform
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
}
```

Add to `Museum`:

```prisma
model Museum {
  // ...existing fields...
  tier                 SubscriptionTier   @default(BASIC)
  subscriptionStatus   SubscriptionStatus @default(ACTIVE)
  subscriptionRenewsAt DateTime?

  payments Payment[]
}
```

New model:

```prisma
model Payment {
  id             String        @id @default(uuid())
  museumId       String
  museum         Museum        @relation(fields: [museumId], references: [id])
  tier           SubscriptionTier
  amountEtb      Decimal
  outTradeNo     String        @unique   // this service's order reference, sent to Telebirr
  telebirrTradeNo String?                // Telebirr's own transaction ID, filled in on the webhook
  status         PaymentStatus @default(PENDING)
  createdAt      DateTime      @default(now())
  paidAt         DateTime?

  @@index([museumId])
}
```

A separate `TierPricing` lookup table (`tier`, `amountEtb`) — rather than hardcoding prices in route code — is worth adding too, so a price change is a data edit, not a deploy.

### 14.3 Tier enforcement middleware

New middleware, `requireWithinTierLimit`, runs on the write paths that a tier caps (currently: room creation, per §14.1's "floor" mapping):

1. Resolve the museum for the request (same pattern as `requireMuseumScope`, §5.4 — never trust a museum ID from the request body).
2. Look up its current `Room` count and its `tier`.
3. `BASIC` → reject a `POST /admin/rooms` past 1 existing room with `403` and a clear `code: "TIER_LIMIT_EXCEEDED"`. `PRO` → reject past 3. `ENTERPRISE` → no cap.
4. If `subscriptionStatus !== 'ACTIVE'`, reject *any* new-resource creation regardless of tier, with a distinct `code: "SUBSCRIPTION_INACTIVE"` — a lapsed museum keeps serving its existing visitor-facing content (don't 404 a paying visitor because a museum's renewal failed) but can't add more.

### 14.4 Telebirr integration

Telebirr's merchant-facing product for this kind of integration is the **Fabric Payment Gateway**, using its H5/Web Checkout flow. Onboarding is a business step done once, outside this codebase: registering as a merchant gets you an `appId`, `appKey`, a short code, and an RSA key pair (Telebirr's public key for verifying their callbacks, this service's private key for signing outbound requests).

**Flow:**

1. `POST /admin/billing/checkout` *(scoped — a museum admin can only buy for their own museum; a system admin can buy on behalf of any museum)*. Body: `{ tier }`. Logic: look up the price for `tier` from `TierPricing`, create a `Payment` row (`status: PENDING`, a freshly generated unique `outTradeNo`), call Telebirr's token/order endpoints server-side (obtain a Fabric access token, then create the order — request signed with `TELEBIRR_PRIVATE_KEY`, including `outTradeNo`, `amountEtb`, `notifyUrl`, `returnUrl`, `shortCode`), and return `{ paymentUrl }` for the client to redirect the admin to.
2. Telebirr's H5 page handles the actual money movement — this backend never sees the museum admin's Telebirr credentials or PIN.
3. `POST /webhooks/telebirr/notify` — **public** (Telebirr calls this server-to-server, so it can't carry an admin JWT), but not trust-by-default: verify the request signature against `TELEBIRR_PUBLIC_KEY` before touching anything. On a valid `PAY_SUCCESS` callback, look up the `Payment` by `outTradeNo`, set `status: PAID`, `paidAt: now()`, store `telebirrTradeNo`, and update the museum's `tier`, `subscriptionStatus: ACTIVE`, and `subscriptionRenewsAt`. On an invalid signature, `401` and log — never update billing state from an unverified callback. On `PAY_FAIL` or a duplicate/already-processed `outTradeNo`, no-op idempotently (Telebirr may retry the callback).
4. `GET /admin/billing/status` *(scoped)* — returns the calling museum's current `tier`, `subscriptionStatus`, `subscriptionRenewsAt`, and payment history. System admins can pass a `museumId` to check any museum.

**Error handling:** an outbound Telebirr call (token or order creation) that errors follows §11's convention — `502`, generic message to the client, full error logged server-side. The webhook path is the one place in this API where an unverified caller can trigger a state change, which is exactly why signature verification isn't optional there, unlike the rest of the public visitor routes in §6 which don't write anything.

### 14.5 Implementation order (Phase 9)

Add as a new phase after Phase 8 (§12): schema additions (§14.2) → `TierPricing` seed data → `requireWithinTierLimit` middleware (§14.3), tested against the existing isolation-checklist pattern from §10 → Telebirr checkout + webhook (§14.4), built and tested against Telebirr's sandbox environment before any production key is issued.

---

## 15. Team Split — 3 Developers Working in Parallel

The goal is to divide the backend so each developer can build for most of the timeline without blocking on another's unfinished code. The one thing that can't be parallelized is agreeing the Prisma schema and the request/response shape of each route up front — that agreement is the contract the three developers build against, so it happens in a single short kickoff before anyone starts writing implementation code, not as an afterthought.

### 15.1 The split

**Developer 1 — Platform & Admin (Phases 1, 3, 4, 8, 10 — §4, §5, §9, §11)**
Owns the schema and migrations, the three auth middleware functions, and the full admin CRUD surface (museums, rooms, items). This is the foundation the other two depend on for anything that requires auth, so Dev 1's first deliverable — ideally within the first day — is the finalized Prisma schema plus a *stub* `requireAuth`/`requireMuseumScope` (even a hardcoded pass-through) so Devs 2 and 3 can build and test their own routes against a real shape without waiting for the real implementation. Also owns the multi-tenancy isolation checklist (§10) and the error-response standardization (§11) at the end.

**Developer 2 — Visitor Experience & AI (Phases 2, 5, 6 — §6, §7)**
Owns everything a visitor's phone talks to: `GET /waypoint/:id`, `POST /chat` (including the two-case grounding logic and the adversarial testing pass in §7.3), and `POST /narrate`. These routes are deliberately public/unauthenticated by design, so Dev 2 only needs the finalized schema (from Dev 1's day-one deliverable) to start immediately — no dependency on auth being finished. This is also the most testing-heavy track (§7.3's fact-fidelity pass), so Dev 2's timeline should assume that testing is load-bearing work, not a buffer at the end.

**Developer 3 — Integrations & Monetization (Phases 7, 9 — §8, §14)**
Owns every route that talks to an external vendor for money or access: ticket validation (§8, including the local stub vendor) and the new Telebirr billing flow (§14) — checkout, webhook signature verification, tier enforcement. Both tracks are public-facing-but-sensitive (a ticket check and a payment webhook are both unauthenticated routes that still have to be trustworthy), which is a different skill emphasis than Dev 1's JWT-based auth or Dev 2's LLM grounding, and pairs naturally as one person's ownership. The one place Dev 3 genuinely depends on Dev 1 is `requireWithinTierLimit` needing `requireMuseumScope` (§14.3) — sequence that specific piece to start once Dev 1's real (non-stub) middleware lands, while the checkout/webhook plumbing itself can be built and tested against the stub in the meantime.

### 15.2 Why this split, specifically

- **Boundary = ownership of a set of routes, not a layer (frontend/backend/database).** All three developers write schema, routes, and tests; the split is by *which part of the product* each route serves (admin operations vs. visitor-facing content vs. money-and-access), which keeps each developer's files largely disjoint and merge conflicts rare.
- **The one hard dependency is made explicit and small.** Only §14.3's tier-limit check needs Dev 1's real middleware; everything else in Dev 2 and Dev 3's tracks only needs the *schema*, which is fixed on day one.
- **Testing ownership follows route ownership.** The isolation checklist (§10) belongs to whoever owns admin scoping (Dev 1); the adversarial chat testing (§7.3) belongs to whoever owns `/chat` (Dev 2); sandbox-mode payment testing belongs to whoever owns Telebirr (Dev 3) — nobody is left testing code they didn't write.

### 15.3 Where the three tracks reconnect

Two checkpoints require all three developers together rather than working solo:

1. **After Phase 4** — once Dev 1's real auth middleware replaces the stub, re-run the isolation checklist (§10) and confirm Dev 3's tier-limit check (§14.3) still works against the real thing, not the stub.
2. **After Phase 8** — a full-system pass: re-run §10's checklist once more (new routes are where scoping gaps get introduced), run §7.3's adversarial chat tests, and run a Telebirr sandbox payment end-to-end (checkout → webhook → tier upgrade) before considering the backend done.
