import { env } from '../../config/env.js';
import { providerCall, UpstreamFailureError } from '../resilience.js';
import type { LlmGenerateInput, LlmGenerateOutput, LlmProvider } from './types.js';

/**
 * Addis AI adapter (dev2 §12.1). Not the default: its chat_generate endpoint
 * requires a target_language of "am" (Amharic) or "om" (Afan Oromo), and this
 * product currently serves English only. Kept registered so re-introducing
 * Amharic is a config change rather than a rewrite — Addis AI would then cover
 * LLM, TTS, and STT in one vendor.
 *
 * Best-effort: dev2's plan documents the endpoint and the language constraint
 * but not the full response schema, so this targets the documented shape and
 * should be verified against the real API before LLM_PROVIDER=addisai is used
 * for anything real.
 */

interface AddisAiResponse {
  response?: string;
  text?: string;
  answer?: string;
}

const ENDPOINT = 'https://api.addisassistant.com/api/v1/chat_generate';
const MAX_ERROR_BODY_CHARS = 500;

export class AddisAiLlmProvider implements LlmProvider {
  readonly name = 'addisai';

  constructor(private readonly targetLanguage: 'am' | 'om' = 'am') {}

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    // No offline fallback here, unlike the OpenAI adapter: this provider is
    // opt-in, so selecting it without a key is a misconfiguration rather than a
    // development convenience.
    const apiKey = env.LLM_API_KEY;
    if (!apiKey) {
      throw new UpstreamFailureError('LLM_API_KEY is required when LLM_PROVIDER=addisai');
    }

    return providerCall({
      name: 'llm:addisai',
      operation: 'generate',
      timeoutMs: env.LLM_TIMEOUT_MS,
      fn: async (signal) => {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system_prompt: input.systemPrompt,
            prompt: input.userPrompt,
            target_language: this.targetLanguage,
            max_tokens: input.maxOutputTokens ?? 300,
            temperature: input.temperature ?? 0.2,
          }),
          signal,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new UpstreamFailureError(
            `Addis AI returned ${res.status}: ${body.slice(0, MAX_ERROR_BODY_CHARS)}`,
            res.status,
          );
        }

        const data = (await res.json()) as AddisAiResponse;
        const text = data.response ?? data.text ?? data.answer;
        if (!text) {
          throw new UpstreamFailureError('Addis AI returned an empty response');
        }
        return { text };
      },
    });
  }
}
