import { env } from '../../config/env';
import { AddisAiLlmProvider } from './addisai';
import { OpenAiLlmProvider } from './openai';
import { LlmProvider } from './types';

export * from './types';

let testOverride: LlmProvider | null = null;

/** Test-only seam: lets integration tests inject a scripted LlmProvider double. */
export function __setLlmProviderForTesting(provider: LlmProvider | null): void {
  testOverride = provider;
}

let cached: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (testOverride) return testOverride;
  if (cached) return cached;

  cached = env.LLM_PROVIDER === 'addisai' ? new AddisAiLlmProvider() : new OpenAiLlmProvider();
  return cached;
}
