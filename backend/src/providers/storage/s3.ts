import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import type { StorageProvider } from './types.js';

async function streamToBuffer(body: Buffer | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

/**
 * S3-compatible StorageProvider (dev2 §12.3). Targets the S3 API surface so the
 * same code works against AWS S3, Cloudflare R2, Backblaze B2, MinIO, or
 * DigitalOcean Spaces — the vendor choice stays a config change.
 *
 * config/env.ts guarantees STORAGE_BUCKET and STORAGE_PUBLIC_BASE_URL are set
 * whenever this provider is selected, so the non-null assertions below cannot
 * fire on a booted process.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    if (!env.STORAGE_BUCKET) {
      throw new Error('STORAGE_BUCKET is required when STORAGE_PROVIDER=s3');
    }
    this.bucket = env.STORAGE_BUCKET;
    this.client = new S3Client({
      region: env.STORAGE_REGION ?? 'auto',
      ...(env.STORAGE_ENDPOINT ? { endpoint: env.STORAGE_ENDPOINT } : {}),
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      ...(env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: env.STORAGE_ACCESS_KEY_ID,
              secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }

  async put(key: string, body: Buffer | Readable, contentType: string): Promise<{ url: string }> {
    // Buffered rather than streamed: S3 needs a known content length, and
    // narration audio is small enough that holding it briefly is not a concern.
    const buffer = await streamToBuffer(body);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    const base = (env.STORAGE_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
    return { url: `${base}/${key}` };
  }

  async head(key: string): Promise<{ exists: boolean; size?: number }> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { exists: true, ...(result.ContentLength ? { size: result.ContentLength } : {}) };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return { exists: false };
      throw err;
    }
  }

  async getStream(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return result.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
