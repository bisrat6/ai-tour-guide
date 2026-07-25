import { TtsProvider } from './types';
import { ElevenLabsTtsProvider } from './elevenlabs';

export * from './types';

let testOverride: TtsProvider | null = null;

/** Test-only seam: lets integration tests inject a scripted TtsProvider double. */
export function __setTtsProviderForTesting(provider: TtsProvider | null): void {
  testOverride = provider;
}

let cached: TtsProvider | null = null;

export function getTtsProvider(): TtsProvider {
  if (testOverride) return testOverride;
  if (cached) return cached;
  cached = new ElevenLabsTtsProvider();
  return cached;
}
