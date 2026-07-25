# Developer 2 integration: what landed, what changed, what is still open

Developer 2's `dev2/chat-narrate-waypoints-implementation` branch has been
integrated into `main`. As with Developer 3, this was a port rather than a merge.
This document records how and why, and what is still outstanding.

## 1. Why this was a port, not a merge

The branch was cut from `a0c2b0a`, the last commit before `backend/` existed —
the same starting point Developer 3 used. It therefore built a second, parallel
backend: its own `package.json`, `tsconfig.json`, `prisma/schema.prisma`,
`prisma/seed.ts`, `app.ts`, `config/env.ts`, `lib/{errors,logger,prisma,asyncHandler}.ts`,
`middleware/{errorHandler,rateLimit,requestId}.ts`, and test harness.

`git merge` produced 18 add/add conflicts, every one of them on that shared
foundation and none of them a genuine disagreement.

The conflicts were not the dangerous part. The branch also **moved `data/` to
`backend/data/`**, and git merges that rename _cleanly_ — no conflict, no
warning. `main` resolves its seed path to the repository root:

```ts
// backend/src/shared/museumSeedData.ts
const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "data",
);
```

A merge would therefore have reported success and left seeding broken, with
nothing in the conflict list pointing at the cause. The move was dropped and
`data/` stays at the repository root.

## 2. The schema needed no changes at all

This is the part worth recording. `main`'s schema already contained every field
Developer 2's code reads and writes:

| Needed by dev2                                                                  | Already on `main` |
| ------------------------------------------------------------------------------- | ----------------- |
| `Room.narrationScript`, `Room.roomAudioUrl`, `roomOverviewText`                 | yes               |
| `AudioAsset.contentHash` (unique), `url`, `voiceId`, `model`, `byteSize`        | yes               |
| `ChatAnswer.questionHash` (unique), `question`, `answer`, `audioHash`, `itemId` | yes               |
| `Museum.systemPrompt`, `Museum.defaultVoiceId`                                  | yes               |

The only differences between the two schema files were a byte-order mark,
comment spacing, a Prisma 5 datasource block, and `main`'s own billing additions.

**No migration was generated for this integration**, in contrast to Developer 3's,
which needed one. That is `docs/dev2-dev3-handoff.md` doing its job: Developer 1
defined the `ChatAnswer` and `AudioAsset` contracts up front, and Developer 2
built against them.

## 3. What was ported

| Area              | Files                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------- |
| Visitor waypoints | `src/modules/waypoints/{schemas,service,router}.ts`                                     |
| Grounded chat     | `src/modules/chat/{schemas,service,router}.ts`                                          |
| Narration / audio | `src/modules/narrate/{schemas,service,router}.ts`                                       |
| LLM providers     | `src/providers/llm/{types,openai,addisai,index}.ts`                                     |
| TTS provider      | `src/providers/tts/{types,elevenlabs,index}.ts`                                         |
| Object storage    | `src/providers/storage/{types,memory,s3,index}.ts`                                      |
| Helpers           | `src/lib/hash.ts`, `src/lib/inFlight.ts`                                                |
| Offline job       | `scripts/pregenerate-narration.ts` (`npm run pregenerate:narration`)                    |
| Tests             | `tests/integration/{waypoints,chat,narrate}.test.ts`, `tests/helpers/visitorFixture.ts` |

New routes, all visitor-facing and mounted at the root:

- `GET /waypoint/:id`
- `GET /museums/:slug`
- `POST /chat`
- `GET /narrate/room/:roomId`
- `GET /narrate/answer/:answerId`

One new dependency: `@aws-sdk/client-s3`. Developer 2's `axios` dependency was
**not** taken — see below.

## 4. Adaptations made during the port

- **CommonJS to ESM.** The branch was CJS with `ts-node`; `main` is
  `"type": "module"`. Every relative import gained a `.js` extension.
- **One resilience wrapper, not two.** Developer 2 wrote `lib/resilientCall.ts`,
  duplicating `main`'s `providers/resilience.ts` (already used by the payment and
  ticketing adapters). The three provider adapters were converted from `axios` to
  `fetch` and now share `main`'s wrapper, so `resilientCall.ts` and the `axios`
  dependency were both dropped. The vendor error body is still surfaced: each
  adapter reads a bounded slice of it into the thrown `UpstreamFailureError`,
  which is what keeps a refusal ("quota exhausted", "voice unavailable")
  diagnosable from the logs instead of a bare status code.
- **Streaming through `fetch`.** `fetch` returns a web `ReadableStream` where the
  narrate module needs a Node `Readable`, so the ElevenLabs adapter adapts it via
  `Readable.fromWeb`. The tee-to-client-and-buffer logic is unchanged.
- **Error shape.** `ApiError.validation` takes a details array on `main` and a
  string on the branch; upstream errors are raised as `UpstreamFailureError` /
  `UpstreamUnavailableError` by the shared wrapper and mapped to `ApiError` in the
  chat and narrate services, matching how the ticket service already behaves.
- **`purgeChatAnswersForRoom` dropped.** The branch shipped it unused, with a
  comment to call it "from admin write paths once they exist". Those paths exist
  on `main` and already purge, transactionally, in `items/service.ts` (4 call
  sites) and `rooms/service.ts`. Duplicating it would have added a second,
  non-transactional way to do the same thing.
- **Jest to Vitest.** 36 test cases moved onto `main`'s harness
  (`ensureTestSchema`, `resetDatabase`, `createApp`). The branch used no
  Jest-specific mocking APIs, so this was mostly imports and helper names. The
  test-only provider seams were renamed from `__setLlmProviderForTesting` to
  `setLlmProviderForTests` to match `main`'s naming.
- **New env vars.** `LLM_BASE_URL`, `LLM_REASONING_TOKEN_HEADROOM`,
  `STORAGE_FORCE_PATH_STYLE`. `LLM_MODEL` and `ELEVENLABS_DEFAULT_VOICE_ID` gained
  defaults, since narration cannot proceed without a voice.

## 5. The offline-fallback defect, fixed during the port

Developer 2's LLM and TTS adapters fall back to canned output when their API key
is unset. That is a genuinely good idea — it is what keeps development and the
whole test suite off the network and free of vendor cost — but as written it was
silent and unconditional.

In production that meant: no `LLM_API_KEY` and visitors are read plausible
invented answers, with nothing logged as an error; no `ELEVENLABS_API_KEY` and
`FAKE_MP3:` placeholder bytes are cached as if they were narration. This is the
same class of defect as the `PAYMENTS_PROVIDER=fake` default already fixed in
Developer 3's port.

`config/env.ts` now refuses to boot in production without `LLM_API_KEY` or
`ELEVENLABS_API_KEY`, and refuses `STORAGE_PROVIDER=memory` there as well, since
memory-backed audio does not survive a restart. `STORAGE_PROVIDER` now defaults
to `memory` rather than `s3`, so development and tests need no bucket, and
selecting `s3` requires `STORAGE_BUCKET` and `STORAGE_PUBLIC_BASE_URL` in every
environment. Five unit tests in `tests/unit/envGuards.test.ts` cover these.

Worth keeping: the ElevenLabs adapter reports its cache model as
`<model>-offline-placeholder` when no key is configured, so placeholder bytes
cannot occupy the cache slot real synthesis would use. Without that, audio
generated before a key was configured would keep being served afterwards.

## 6. A de-duplication gap found and fixed during verification

The ported concurrency test failed once under full-suite load and passed in
isolation, which turned out to be a real defect rather than a flaky assertion.

`dedupeInFlight` released its map entry as soon as the model call settled, but the
`ChatAnswer` cache row is written *after* that. Between those two moments the
answer existed in neither place, so a request arriving there missed both and paid
for a second identical LLM call — precisely the stampede the mechanism exists to
prevent. Normal timing hides it, because a concurrent request usually arrives
while generation is still in flight; only scheduling delay exposes the window.

The fix moves the cache write inside the de-duplicated work, so the entry is held
until the row is visible and followers reuse the leader's persisted row instead of
each issuing their own upsert. `tests/integration/chat.test.ts` covers it with the
adversarial timing (zero model delay, second request yielded in on the next tick);
reverting the fix fails that test on the first iteration with two model calls
instead of one.

Worth noting what was *not* wrong: 72 concurrent requests across 12 fan-out rounds
produced no unique-constraint races on `questionHash`, because Prisma compiles
that upsert to an atomic `INSERT ... ON CONFLICT`.

## 7. Design worth keeping, for future readers

Two pieces of this branch are more careful than they first appear:

- **Synthesis de-duplication** (`narrate/service.ts`). The first caller for a
  given audio hash streams live from the vendor while the same bytes are buffered;
  concurrent callers await that buffer instead of each triggering their own
  billable synthesis. A tour group tapping the same room costs one TTS call.
- **Cache records are treated as hints, not truth.** A recorded audio URL is
  verified against storage before being served, so a row that outlived its bytes
  (memory storage after a restart) re-synthesizes instead of 500ing.

The chat module delimits the visitor question as untrusted input against prompt
injection, verifies any `matchedItemId` the model returns against the room's real
items before trusting it, and retries malformed JSON exactly once before failing
with 502.

## 8. Still open

- **The five new visitor routes are not in `openapi/openapi.yaml`.** That
  document's paths are hand-registered in `scripts/generate-openapi.ts`, so there
  is no automated drift check to catch this; the billing and ticket routes from
  Developer 3's port are missing for the same reason. These five matter more than
  the admin ones, since the visitor client is the main consumer.
- **Rate limiting is not covered by an automated test.** `createRateLimiter`
  skips entirely when `NODE_ENV=test`, so the chat limit (20 per 5 minutes) and
  the narrate limit (60 per 5 minutes) are unverified in CI. Same gap as the
  ticket validation limit.
- **`GET /narrate/answer/:answerId` is unauthenticated by design**, relying on
  the answer id being an unguessable UUID handed out only by `POST /chat`. That is
  reasonable, but it does mean a leaked id grants permanent access to that audio.
- **In-flight de-duplication is process-local.** Correct for a single instance;
  on more than one replica each would synthesize once. The code says so.
- **The Addis AI adapter is unverified.** Developer 2 flagged this: the plan
  documents the endpoint and the Amharic/Afan Oromo language constraint but not
  the full response schema. It should be tested against the real API before
  `LLM_PROVIDER=addisai` is used for anything real.

## 9. Verification

- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run format` clean.
- `npm test`: 15 files, 182 tests passing (45 of them in the four files touched
  by this integration).
- `npm run generate:openapi` produces no diff.
- `npm run seed` then `npm run pregenerate:narration` succeed against a live
  database: 8 rooms, 8 assets written.
- Live boot on a real seeded database, exercising the full visitor journey:
  `/museums/adwa` → `/waypoint/:id` (3 items, no `narrationScript` or `museumId`
  leaked) → `POST /chat` grounded on the tapped item → repeat request served from
  cache with the same audio handle → a casing-and-punctuation variant hitting the
  same cache entry → `/narrate/answer/:id` and `/narrate/room/:id` both streaming
  `audio/mpeg`.
