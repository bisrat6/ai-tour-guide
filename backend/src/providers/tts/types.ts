import type { Readable } from 'node:stream';

/**
 * TTS provider contract (dev2 §12.2). Audio is returned as a stream so the
 * narrate module can forward bytes to the visitor as they arrive rather than
 * waiting for a whole file.
 */
export interface TtsSynthesizeInput {
  text: string;
  voiceId: string;
}

export interface TtsSynthesizeOutput {
  stream: Readable;
  contentType: string;
}

export interface TtsProvider {
  readonly name: string;
  /** Mixed into every audio content hash, so it is cache identity, not the wire id. */
  readonly model: string;
  synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput>;
}
