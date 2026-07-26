/**
 * One-shot: upload local exhibit images to the public Supabase bucket and
 * print the resulting public URLs. Run from /repo/backend with the .env loaded.
 */
import { createReadStream, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

config({ quiet: true });

const client = new S3Client({
  region: process.env.STORAGE_REGION ?? 'eu-west-3',
  endpoint: process.env.STORAGE_ENDPOINT,
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
  },
});

const bucket = process.env.STORAGE_BUCKET ?? 'adwa-audio';
const publicBase = (process.env.STORAGE_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');

const files = [
  { key: 'exhibits/adwa/menelik.png', path: '/repo/frontend_assets/room1_hero.png' },
  { key: 'exhibits/adwa/taytu.png', path: '/repo/frontend_assets/room2_hero.png' },
  { key: 'exhibits/adwa/shield_spear.png', path: '/repo/frontend_assets/room2_item.png' },
  { key: 'exhibits/adwa/battle.png', path: '/repo/frontend_assets/room3_hero.png' },
  { key: 'exhibits/adwa/scramble_map.png', path: '/repo/frontend_assets/adwa_museum.png' },
  { key: 'exhibits/adwa/treaty_wuchale.png', path: '/repo/frontend_assets/treaty_wuchale.png' },
  { key: 'exhibits/adwa/negarit_drum.png', path: '/repo/frontend_assets/negarit_drum.png' },
  { key: 'exhibits/adwa/red_tent.png', path: '/repo/frontend_assets/red_tent.png' },
  { key: 'exhibits/adwa/crispi_telegram.png', path: '/repo/frontend_assets/crispi_telegram.png' },
  { key: 'exhibits/adwa/adwa_topo_map.png', path: '/repo/frontend_assets/adwa_topo_map.png' },
  { key: 'exhibits/adwa/st_george_icon.png', path: '/repo/frontend_assets/st_george_icon.png' },
  { key: 'exhibits/adwa/dabormida_uniform.png', path: '/repo/frontend_assets/dabormida_uniform.png' },
  { key: 'exhibits/adwa/newspaper_clippings.png', path: '/repo/frontend_assets/newspaper_clippings.png' },
  { key: 'exhibits/adwa/pan_african_emblem.png', path: '/repo/frontend_assets/pan_african_emblem.png' },
];

async function main() {
  for (const file of files) {
    if (!existsSync(file.path)) {
      console.error(`MISSING ${file.path}`);
      continue;
    }
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: file.key,
        Body: createReadStream(file.path),
        ContentType: 'image/png',
        // Public bucket path is already open via STORAGE_PUBLIC_BASE_URL.
      }),
    );
    console.log(`${basename(file.path)} -> ${publicBase}/${file.key}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
