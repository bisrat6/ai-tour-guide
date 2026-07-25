import axios from 'axios';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { resilientCall } from '../../lib/resilientCall';
import { LlmGenerateInput, LlmGenerateOutput, LlmProvider } from './types';

/**
 * Default LlmProvider (§12.1, C4). Addis AI cannot serve an English-only
 * product — its chat endpoint requires target_language "am" or "om" — so a
 * general model is the default here, with Addis AI registered as a
 * ready-to-swap adapter for when Amharic returns.
 *
 * Talks to any vendor exposing an OpenAI-compatible /chat/completions
 * endpoint (OpenAI itself, Gemini, Groq, OpenRouter, ...) — LLM_BASE_URL and
 * LLM_MODEL pick the vendor/model, so switching is a .env change, not a
 * code change. LLM_API_KEY is passed the same way (Bearer token) for all of
 * them.
 */
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    if (!env.LLM_API_KEY) {
      return fakeGenerate(input);
    }

    return resilientCall({ providerName: llmProviderBreakerKey(), timeoutMs: env.LLM_TIMEOUT_MS }, async (signal) => {
      const response = await axios.post(
        env.LLM_BASE_URL,
        {
          model: env.LLM_MODEL,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
          temperature: input.temperature ?? 0.2,
          max_tokens: (input.maxOutputTokens ?? 300) + env.LLM_REASONING_TOKEN_HEADROOM,
          ...(input.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${env.LLM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          signal,
        }
      );

      const choice = response.data?.choices?.[0];
      const text = choice?.message?.content;
      if (!text) {
        throw new Error('OpenAI returned an empty completion');
      }
      if (choice?.finish_reason === 'length') {
        // Truncated output would otherwise surface downstream as unparseable JSON or a
        // half-finished sentence read aloud to a visitor, with nothing pointing at the
        // token ceiling as the cause.
        logger.warn(
          { model: env.LLM_MODEL, maxTokens: (input.maxOutputTokens ?? 300) + env.LLM_REASONING_TOKEN_HEADROOM },
          'llm response truncated at the token limit — raise LLM_REASONING_TOKEN_HEADROOM if this model reasons before answering'
        );
      }
      const usage = response.data?.usage
        ? {
            inputTokens: response.data.usage.prompt_tokens ?? 0,
            outputTokens: response.data.usage.completion_tokens ?? 0,
          }
        : undefined;
      return { text, usage };
    });
  }
}

/** Per-vendor circuit-breaker/log key, so switching LLM_BASE_URL doesn't share failure state with the previous vendor. */
function llmProviderBreakerKey(): string {
  try {
    return `llm:${new URL(env.LLM_BASE_URL).hostname}`;
  } catch {
    return 'openai-llm';
  }
}

/**
 * Deterministic offline fallback used only when LLM_API_KEY is unset — keeps
 * local development and the integration test suite free of real network
 * calls and vendor cost, without inventing a separate "fake" provider that
 * would sit outside the documented provider set.
 */
async function fakeGenerate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
  if (input.responseFormat === 'json') {
    return { text: fakeClassifyAndAnswer(input.userPrompt) };
  }
  return { text: fakeSingleItemAnswer(input.userPrompt) };
}

function fakeSingleItemAnswer(userPrompt: string): string {
  const contextMatch = userPrompt.match(/CONTEXT:\n([\s\S]*?)\n\nAnswer in/);
  const context = contextMatch ? contextMatch[1] : userPrompt;
  const firstSentence = context.split(/(?<=[.!?])\s/)[0] || context.slice(0, 160);
  return `Based on the exhibit record: ${firstSentence}`;
}

function fakeClassifyAndAnswer(userPrompt: string): string {
  const questionMatch = userPrompt.match(/<question>\n([\s\S]*?)\n<\/question>/);
  const question = (questionMatch ? questionMatch[1] : '').toLowerCase();

  const itemBlocks = [...userPrompt.matchAll(/ID:\s*([^\n]+)\nName:\s*([^\n]+)\n[\s\S]*?Detail Text:\s*([^\n]+)/g)];

  for (const [, id, name, detail] of itemBlocks) {
    const nameWords = name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (nameWords.some((w) => question.includes(w))) {
      const firstSentence = detail.split(/(?<=[.!?])\s/)[0] || detail.slice(0, 160);
      return JSON.stringify({ matchedItemId: id.trim(), answer: `Regarding ${name.trim()}: ${firstSentence}` });
    }
  }

  const overviewMatch = userPrompt.match(/ROOM OVERVIEW:\n([\s\S]*?)\n\nITEMS/);
  const overview = overviewMatch ? overviewMatch[1] : '';
  const overviewSentence = overview.split(/(?<=[.!?])\s/)[0] || overview.slice(0, 160);
  return JSON.stringify({ matchedItemId: null, answer: overviewSentence });
}
