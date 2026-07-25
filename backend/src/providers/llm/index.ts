import { env } from '../../config/env.js';
import { AddisAiLlmProvider } from './addisai.js';
import { OpenAiLlmProvider } from './openai.js';
import type { LlmProvider } from './types.js';

export type { LlmProvider, LlmGenerateInput, LlmGenerateOutput } from './types.js';

let testOverride: LlmProvider | null = null;

/** Test-only seam: lets integration tests inject a scripted LlmProvider double. */
export function setLlmProviderForTests(provider: LlmProvider | null): void {
  testOverride = provider;
}

let cached: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (testOverride) return testOverride;
  if (cached) return cached;

  cached = env.LLM_PROVIDER === 'addisai' ? new AddisAiLlmProvider() : new OpenAiLlmProvider();
  return cached;
}
