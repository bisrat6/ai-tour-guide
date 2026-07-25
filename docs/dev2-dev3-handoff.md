# Handoff to Developers 2 & 3: `ChatAnswer` and `AudioAsset`

**From:** Developer 1 (admin foundation — museums/rooms/items CRUD, auth, isolation), D1-8.
**To:** whoever builds Phase 5 (provider adapters), Phase 6 (chat), Phase 7 (audio/`narrate`),
Phase 8 (tickets) of [docs/backend-implementation-plan.md](./backend-implementation-plan.md).

This is the narrow slice you need before you start writing to these two tables. It does not
replace the main plan — read §11 (audio) and §14 (route contracts) there for the full picture.
This doc exists because the cache-purge rule is easy to miss and expensive to miss: get it wrong
and a museum admin fixes a factual error, and visitors keep hearing the old, wrong answer for up
to 24 hours.

## 1. The two tables, as they exist today

Both are already in `backend/prisma/schema.prisma` and migrated. You do not need to add fields to
start using them; if you find you do, update the schema **and** §6.1 of the main plan together —
that section and this file must never say something different from `schema.prisma`.

```prisma
// Deduplicates TTS output. Key is a hash of the exact synthesis inputs,
// so identical text in the same voice is only ever paid for once.
model AudioAsset {
  id          String   @id @default(uuid())
  contentHash String   @unique
  url         String
  voiceId     String
  model       String
  durationMs  Int?
  byteSize    Int?
  createdAt   DateTime @default(now())
}

// Serves two purposes: the answer cache, and the durable handle behind
// the audioUrl returned by POST /chat (C1).
model ChatAnswer {
  id           String   @id @default(uuid())
  roomId       String
  room         Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  itemId       String?
  item         Item?    @relation(fields: [itemId], references: [id], onDelete: SetNull)
  questionHash String   @unique // sha256(roomId : itemId : normalizedQuestion)
  question     String   @db.Text
  answer       String   @db.Text
  audioHash    String?  // -> AudioAsset.contentHash once synthesized
  createdAt    DateTime @default(now())

  @@index([roomId])
  @@index([createdAt])
}
```

**`AudioAsset` is content-addressed, not tied to a room or item.** `contentHash =
sha256(text + voiceId + model)` (§11.3 of the main plan). Before calling the TTS provider, check
for an existing row with that hash — if one exists, redirect/stream from its `url`, no vendor call.
This is true both for room narration audio and for `ChatAnswer` audio.

**`ChatAnswer.questionHash = sha256(roomId : itemId : normalizedQuestion)`**, where normalization
lowercases, collapses whitespace, and strips trailing punctuation (§13.2). `itemId` is nullable —
a room-level question (no specific item) hashes with an empty/sentinel item segment; pick one
convention and keep it consistent, since the hash is your cache key.

**`audioHash` is nullable and set after the fact.** The expected flow: persist the `ChatAnswer`
row as soon as you have text (so the answer is servable immediately), then synthesize audio
asynchronously (or on first `GET /narrate/answer/:answerId`) and backfill `audioHash` once you
have it. Don't block the chat response on TTS.

## 2. The cache-purge rule — already implemented, do not duplicate it

**Rule:** any successful write to a `Room`, or to any `Item` belonging to that room, deletes every
`ChatAnswer` row for that room.

This is **already implemented** in the code you're inheriting — you don't write this logic, you
just need to know it exists so you don't fight it or reimplement it:

- `backend/src/modules/rooms/service.ts` — `updateRoom()` deletes `ChatAnswer` for the room inside
  the same transaction as the update. (`deleteRoom()` doesn't need to — cascade handles it.)
- `backend/src/modules/items/service.ts` — `createItem()`, `updateItem()`, and `deleteItem()` all
  delete `ChatAnswer` for the item's parent room inside their transaction. `reorderRoomItems()`
  deliberately does **not** purge — it only changes `displayOrder`, which chat answers aren't
  grounded in, so purging there would just waste cache for no correctness benefit.

What this means for you:

- **You never need to purge `ChatAnswer` yourself.** If an admin edits a room or item, the cache
  for that room is already gone by the time your chat endpoint runs its next query. You just need
  to make sure your queries always hit the table fresh (no separate in-memory cache layer that
  could outlive this purge).
- **If you add a new admin write path that changes grounding text** (e.g. a bulk-import endpoint,
  or a museum-level field that feeds the system prompt), you must add the same purge to that path.
  The rule is "any content admins can edit that chat answers are grounded in," not "just these two
  routes." Grep for `chatAnswer.deleteMany` in `rooms/service.ts` / `items/service.ts` for the
  exact pattern to copy.
- **`ChatAnswer.item` uses `onDelete: SetNull`, `ChatAnswer.room` uses `onDelete: Cascade`.**
  Deleting an item nulls out `itemId` on any cached answers referencing it rather than deleting
  the row (the room-level purge above deletes them anyway on the same request, but the `SetNull`
  is the safety net if that ever changes). Deleting a room cascades and takes its `ChatAnswer` rows
  with it — no purge needed there.
- **TTL is separate from purging.** §13.2 of the main plan also specifies `ANSWER_CACHE_TTL_HOURS`
  (default 24) for answers that were never invalidated by an edit. That's your responsibility to
  implement (a `createdAt` check on read, or a cleanup job) — it isn't in Developer 1's scope.

## 3. What to build on top of this

- `POST /chat` (§14, main plan phase 6): hash the question, check `ChatAnswer` first, only call
  the LLM provider on a miss, persist the result.
- `GET /narrate/room/:roomId` and `GET /narrate/answer/:answerId` (§11, phase 7): check
  `AudioAsset` by `contentHash` first, only call the TTS provider on a miss.
- Both of the above are public, unauthenticated routes reading pre-generated content — the
  _admin-only_ `POST /admin/narrate` (which actually spends money synthesizing) is intentionally
  separate. See §11.2 of the main plan for why the original public `POST /narrate` design was
  rejected.
- Any provider adapter you write (LLM, TTS, storage) should follow the same "interface first,
  vendor behind it" pattern already used for `requireMuseumScope`/`ApiError` in this codebase —
  see §12 of the main plan.

## 4. Where to verify this is still true

- `backend/prisma/schema.prisma` — source of truth for both table shapes.
- `backend/tests/integration/rooms.test.ts` and `items.test.ts` — have tests named around
  "purges chat answer cache" you can run to see the purge rule exercised end to end.
- `backend/tests/helpers/db.ts` — `seedChatAnswer()` if you need a `ChatAnswer` fixture in your own
  tests.
