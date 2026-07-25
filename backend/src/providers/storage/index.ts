import { env } from '../../config/env.js';
import { MemoryStorageProvider } from './memory.js';
import { S3StorageProvider } from './s3.js';
import type { StorageProvider } from './types.js';

export type { StorageProvider } from './types.js';

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;
  cached = env.STORAGE_PROVIDER === 's3' ? new S3StorageProvider() : new MemoryStorageProvider();
  return cached;
}

/**
 * Test helper: forces a fresh provider, which for memory storage also means an
 * empty store. Without it, cached audio leaks between test files.
 */
export function resetStorageProviderForTests(): void {
  cached = null;
}
