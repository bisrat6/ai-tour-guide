/**
 * LLM provider contract (dev2 §12.1). The interface exists so a second vendor
 * is a new adapter rather than a change to the chat module.
 */
export interface LlmGenerateInput {
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: 'text' | 'json';
  maxOutputTokens?: number;
  temperature?: number;
}

export interface LlmGenerateOutput {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  readonly name: string;
  generate(input: LlmGenerateInput): Promise<LlmGenerateOutput>;
}
