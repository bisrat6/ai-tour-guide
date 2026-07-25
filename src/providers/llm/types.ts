export interface LlmGenerateInput {
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: 'text' | 'json';
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LlmGenerateOutput {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  readonly name: string;
  generate(input: LlmGenerateInput): Promise<LlmGenerateOutput>;
}
