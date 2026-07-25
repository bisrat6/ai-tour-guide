import { Readable } from 'stream';
import { StorageProvider } from './types';

async function toBuffer(body: Buffer | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * In-memory StorageProvider (§12.3) — backs local development and the test
 * suite so neither touches the network or a real bucket. Never used in
 * production: Render's disk is ephemeral and process memory is even more so.
 */
export class MemoryStorageProvider implements StorageProvider {
  readonly name = 'memory';
  private readonly store = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer | Readable, contentType: string): Promise<{ url: string }> {
    const buffer = await toBuffer(body);
    this.store.set(key, { body: buffer, contentType });
    return { url: `memory://${key}` };
  }

  async head(key: string): Promise<{ exists: boolean; size?: number }> {
    const entry = this.store.get(key);
    return entry ? { exists: true, size: entry.body.length } : { exists: false };
  }

  async getStream(key: string): Promise<Readable> {
    const entry = this.store.get(key);
    if (!entry) throw new Error(`memory storage: key not found: ${key}`);
    return Readable.from([entry.body]);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /** Test helper only. */
  clear(): void {
    this.store.clear();
  }
}
