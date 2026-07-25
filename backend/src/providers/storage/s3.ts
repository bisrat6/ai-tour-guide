import { Readable } from 'stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../../config/env';
import { StorageProvider } from './types';

async function streamToBuffer(stream: Buffer | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) return stream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * S3-compatible StorageProvider (§12.3). Targets the S3 API surface so the
 * same code works against AWS S3, Cloudflare R2, Backblaze B2, MinIO, or
 * DigitalOcean Spaces — the vendor decision (Q2) is deferred to a config
 * change, not a code change.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = env.STORAGE_BUCKET;
    this.client = new S3Client({
      region: env.STORAGE_REGION || 'auto',
      endpoint: env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials:
        env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY
          ? { accessKeyId: env.STORAGE_ACCESS_KEY_ID, secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY }
          : undefined,
    });
  }

  async put(key: string, body: Buffer | Readable, contentType: string): Promise<{ url: string }> {
    const buffer = await streamToBuffer(body);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType })
    );
    const base = env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '');
    return { url: `${base}/${key}` };
  }

  async head(key: string): Promise<{ exists: boolean; size?: number }> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { exists: true, size: result.ContentLength };
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
