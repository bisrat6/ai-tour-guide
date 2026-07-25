import { Readable } from 'node:stream';
import type { StorageProvider } from './types.js';

async function toBuffer(body: Buffer | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

/**
 * In-memory StorageProvider (dev2 §12.3), backing development and the test
 * suite so neither touches the network or a real bucket. config/env.ts refuses
 * to boot production with it: cached narration would not survive a restart.
 *
 * The `memory://` URLs it returns are deliberately not fetchable, which is what
 * makes the narrate module proxy the bytes instead of redirecting.
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
