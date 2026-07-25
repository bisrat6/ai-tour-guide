/**
 * Tests must be deterministic and network-free regardless of whatever real
 * vendor credentials happen to be sitting in the developer's local .env —
 * otherwise adding a working LLM_API_KEY for manual testing silently turns
 * every un-scripted /chat and /narrate integration test into a real,
 * flaky, billable network call. Forcing these blank here (before
 * src/config/env.ts is first imported and freezes its singleton `env`)
 * guarantees the deterministic fake providers run unless a test explicitly
 * injects a scripted double via __setLlmProviderForTesting /
 * __setTtsProviderForTesting.
 *
 * Storage is pinned to memory for the same reason plus one more: a configured
 * bucket makes the suite upload throwaway fixture audio into the real
 * (possibly production) bucket, and the resulting public https urls change
 * observable behaviour, since cached audio is redirected to rather than
 * proxied.
 */
process.env.LLM_API_KEY = '';
process.env.ELEVENLABS_API_KEY = '';
process.env.STORAGE_PROVIDER = 'memory';
process.env.STORAGE_BUCKET = '';
process.env.STORAGE_ENDPOINT = '';
process.env.STORAGE_ACCESS_KEY_ID = '';
process.env.STORAGE_SECRET_ACCESS_KEY = '';
process.env.STORAGE_PUBLIC_BASE_URL = '';
