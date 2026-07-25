import { Readable } from 'stream';

export interface TtsSynthesizeInput {
  text: string;
  voiceId: string;
  signal?: AbortSignal;
}

export interface TtsSynthesizeOutput {
  stream: Readable;
  contentType: string;
}

export interface TtsProvider {
  readonly name: string;
  readonly model: string;
  synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput>;
}
