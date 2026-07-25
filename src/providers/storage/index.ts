import { env } from '../../config/env';
import { MemoryStorageProvider } from './memory';
import { S3StorageProvider } from './s3';
import { StorageProvider } from './types';

export * from './types';

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;
  cached = env.STORAGE_PROVIDER === 's3' ? new S3StorageProvider() : new MemoryStorageProvider();
  return cached;
}

/** Test helper: forces a fresh provider instance (e.g. a clean MemoryStorageProvider). */
export function __resetStorageProviderForTesting(): void {
  cached = null;
}
