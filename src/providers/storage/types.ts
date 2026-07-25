import { Readable } from 'stream';

export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Buffer | Readable, contentType: string): Promise<{ url: string }>;
  head(key: string): Promise<{ exists: boolean; size?: number }>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
