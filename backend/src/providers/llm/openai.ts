import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { providerCall, UpstreamFailureError } from '../resilience.js';
import type { LlmGenerateInput, LlmGenerateOutput, LlmProvider } from './types.js';

/**
 * Default LlmProvider (dev2 §12.1). Talks to any vendor exposing an
 * OpenAI-compatible /chat/completions endpoint — OpenAI, Gemini, Groq,
 * OpenRouter — so LLM_BASE_URL and LLM_MODEL pick the vendor and switching is a
 * .env change rather than a code change.
 *
 * Addis AI is not the default: its chat endpoint requires a target_language of
 * "am" or "om", and this product currently serves English only.
 *
 * Ported from dev2's branch with axios replaced by fetch, so this shares main's
 * one resilience wrapper with the payment and ticketing adapters instead of
 * carrying a second implementation.
 */

/** Only the fields we read; vendors add many more. */
interface ChatCompletionResponse {
  choices?: {
    message?: { content?: string };
    finish_reason?: string;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const MAX_ERROR_BODY_CHARS = 500;

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    // No key configured means development or test, where the offline fallback
    // keeps the suite off the network. config/env.ts refuses to boot production
    // without a key, so this branch is unreachable there.
    if (!env.LLM_API_KEY) {
      return fakeGenerate(input);
    }

    const maxTokens = (input.maxOutputTokens ?? 300) + env.LLM_REASONING_TOKEN_HEADROOM;

    return providerCall({
      // Keyed by hostname so switching LLM_BASE_URL does not inherit the
      // previous vendor's circuit-breaker state.
      name: llmVendorName(),
      operation: 'generate',
      timeoutMs: env.LLM_TIMEOUT_MS,
      fn: async (signal) => {
        const res = await fetch(env.LLM_BASE_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.LLM_API_KEY ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: env.LLM_MODEL,
            messages: [
              { role: 'system', content: input.systemPrompt },
              { role: 'user', content: input.userPrompt },
            ],
            temperature: input.temperature ?? 0.2,
            max_tokens: maxTokens,
            ...(input.responseFormat === 'json'
              ? { response_format: { type: 'json_object' } }
              : {}),
          }),
          signal,
        });

        if (!res.ok) {
          // Vendors explain refusals in the body — an exhausted quota, a model
          // the account cannot reach — while the status alone says nothing.
          const body = await res.text().catch(() => '');
          throw new UpstreamFailureError(
            `LLM vendor returned ${res.status}: ${body.slice(0, MAX_ERROR_BODY_CHARS)}`,
            res.status,
          );
        }

        const data = (await res.json()) as ChatCompletionResponse;
        const choice = data.choices?.[0];
        const text = choice?.message?.content;
        if (!text) {
          throw new UpstreamFailureError('LLM returned an empty completion');
        }

        if (choice?.finish_reason === 'length') {
          // Truncated output surfaces downstream as unparseable JSON or a
          // half-finished sentence read aloud, with nothing pointing at the
          // token ceiling as the cause.
          logger.warn(
            { model: env.LLM_MODEL, maxTokens },
            'LLM response truncated at the token limit — raise LLM_REASONING_TOKEN_HEADROOM if this model reasons before answering',
          );
        }

        const usage = data.usage
          ? {
              inputTokens: data.usage.prompt_tokens ?? 0,
              outputTokens: data.usage.completion_tokens ?? 0,
            }
          : undefined;

        return { text, ...(usage ? { usage } : {}) };
      },
    });
  }
}

function llmVendorName(): string {
  try {
    return `llm:${new URL(env.LLM_BASE_URL).hostname}`;
  } catch {
    return 'llm:openai';
  }
}

/**
 * Deterministic offline fallback, used only when LLM_API_KEY is unset. It
 * answers from the prompt's own context so the chat tests can assert grounding
 * without a network call or vendor cost.
 */
async function fakeGenerate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
  if (input.responseFormat === 'json') {
    return { text: fakeClassifyAndAnswer(input.userPrompt) };
  }
  return { text: fakeSingleItemAnswer(input.userPrompt) };
}

function fakeSingleItemAnswer(userPrompt: string): string {
  const contextMatch = userPrompt.match(/CONTEXT:\n([\s\S]*?)\n\nAnswer in/);
  const context = contextMatch?.[1] ?? userPrompt;
  const firstSentence = context.split(/(?<=[.!?])\s/)[0] ?? context.slice(0, 160);
  return `Based on the exhibit record: ${firstSentence}`;
}

function fakeClassifyAndAnswer(userPrompt: string): string {
  const questionMatch = userPrompt.match(/<question>\n([\s\S]*?)\n<\/question>/);
  const question = (questionMatch?.[1] ?? '').toLowerCase();

  const itemBlocks = [
    ...userPrompt.matchAll(/ID:\s*([^\n]+)\nName:\s*([^\n]+)\n[\s\S]*?Detail Text:\s*([^\n]+)/g),
  ];

  for (const [, id, name, detail] of itemBlocks) {
    if (!id || !name || !detail) continue;
    const nameWords = name
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3);
    if (nameWords.some((word) => question.includes(word))) {
      const firstSentence = detail.split(/(?<=[.!?])\s/)[0] ?? detail.slice(0, 160);
      return JSON.stringify({
        matchedItemId: id.trim(),
        answer: `Regarding ${name.trim()}: ${firstSentence}`,
      });
    }
  }

  const overviewMatch = userPrompt.match(/ROOM OVERVIEW:\n([\s\S]*?)\n\nITEMS/);
  const overview = overviewMatch?.[1] ?? '';
  const overviewSentence = overview.split(/(?<=[.!?])\s/)[0] ?? overview.slice(0, 160);
  return JSON.stringify({ matchedItemId: null, answer: overviewSentence });
}
