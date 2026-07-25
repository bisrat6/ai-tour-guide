import type { Readable } from 'node:stream';

/**
 * Object storage contract (dev2 §12.3). Narration audio is expensive to
 * synthesize and immutable once generated, so it is cached in object storage
 * rather than re-requested from the TTS vendor.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Buffer | Readable, contentType: string): Promise<{ url: string }>;
  head(key: string): Promise<{ exists: boolean; size?: number }>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
