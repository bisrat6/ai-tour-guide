import axios from 'axios';
import { env } from '../../config/env';
import { resilientCall } from '../../lib/resilientCall';
import { LlmGenerateInput, LlmGenerateOutput, LlmProvider } from './types';

/**
 * Addis AI adapter (C4). NOT the default — its `chat_generate` endpoint
 * requires `target_language` of "am" (Amharic) or "om" (Afan Oromo), and
 * this product currently serves English only. Kept registered so a future
 * Amharic re-introduction (§9.4) is a config change, not a rewrite: Addis AI
 * would then cover LLM, TTS, and STT in one vendor.
 *
 * Best-effort implementation: the plan documents the endpoint and the
 * language constraint but not the full request/response schema, so this
 * adapter targets the documented shape and should be verified against the
 * real API before `LLM_PROVIDER=addisai` is used for anything real.
 */
export class AddisAiLlmProvider implements LlmProvider {
  readonly name = 'addisai';

  constructor(private readonly targetLanguage: 'am' | 'om' = 'am') {}

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    if (!env.LLM_API_KEY) {
      throw new Error('Addis AI provider requires LLM_API_KEY to be configured');
    }

    return resilientCall({ providerName: 'addisai-llm', timeoutMs: env.LLM_TIMEOUT_MS }, async (signal) => {
      const response = await axios.post(
        'https://api.addisassistant.com/api/v1/chat_generate',
        {
          system_prompt: input.systemPrompt,
          prompt: input.userPrompt,
          target_language: this.targetLanguage,
          max_tokens: input.maxOutputTokens ?? 300,
          temperature: input.temperature ?? 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${env.LLM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          signal,
        }
      );

      const text = response.data?.response ?? response.data?.text ?? response.data?.answer;
      if (!text) {
        throw new Error('Addis AI returned an empty response');
      }
      return { text };
    });
  }
}
