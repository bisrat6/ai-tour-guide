import { ElevenLabsTtsProvider } from './elevenlabs.js';
import type { TtsProvider } from './types.js';

export type { TtsProvider, TtsSynthesizeInput, TtsSynthesizeOutput } from './types.js';

let testOverride: TtsProvider | null = null;

/** Test-only seam: lets integration tests inject a scripted TtsProvider double. */
export function setTtsProviderForTests(provider: TtsProvider | null): void {
  testOverride = provider;
}

let cached: TtsProvider | null = null;

export function getTtsProvider(): TtsProvider {
  if (testOverride) return testOverride;
  if (cached) return cached;
  cached = new ElevenLabsTtsProvider();
  return cached;
}
