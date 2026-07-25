/**
 * Offline room narration pre-generation (dev2 §11.5). Synthesizes every room's
 * narrationScript once and records a durable roomAudioUrl, so
 * GET /narrate/room/:roomId serves a warm cache in production instead of making
 * visitors wait on a TTS call.
 *
 * Usage: npm run pregenerate:narration
 *
 * Ported from dev2's branch, using main's shared prisma client rather than its
 * own PrismaClient instance.
 */
import type { Readable } from 'node:stream';
import '../src/config/env.js';
import { env } from '../src/config/env.js';
import { audioContentHash } from '../src/lib/hash.js';
import { logger } from '../src/lib/logger.js';
import { prisma } from '../src/lib/prisma.js';
import { getStorageProvider } from '../src/providers/storage/index.js';
import { getTtsProvider } from '../src/providers/tts/index.js';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

async function pregenerateNarration(): Promise<void> {
  const tts = getTtsProvider();
  const storage = getStorageProvider();

  const rooms = await prisma.room.findMany({
    include: { museum: { select: { defaultVoiceId: true } } },
  });
  console.log(`Pre-generating narration for ${rooms.length} rooms...`);

  let synthesized = 0;
  let reused = 0;
  let failed = 0;

  for (const room of rooms) {
    const voiceId = room.museum.defaultVoiceId ?? env.ELEVENLABS_DEFAULT_VOICE_ID;
    const contentHash = audioContentHash(room.narrationScript, voiceId, tts.model);
    const key = `audio/${contentHash}.mp3`;

    try {
      // Two rooms with identical scripts and voice share one asset, so this also
      // avoids paying twice for the same audio.
      const existing = await prisma.audioAsset.findUnique({ where: { contentHash } });
      if (existing) {
        await prisma.room.update({
          where: { id: room.id },
          data: { roomAudioUrl: existing.url },
        });
        reused += 1;
        console.log(`  reused   "${room.title}"`);
        continue;
      }

      const { stream, contentType } = await tts.synthesize({
        text: room.narrationScript,
        voiceId,
      });
      const buffer = await streamToBuffer(stream);
      const { url } = await storage.put(key, buffer, contentType);

      await prisma.audioAsset.create({
        data: { contentHash, url, voiceId, model: tts.model, byteSize: buffer.length },
      });
      await prisma.room.update({ where: { id: room.id }, data: { roomAudioUrl: url } });

      synthesized += 1;
      console.log(`  wrote    "${room.title}" (${buffer.length} bytes)`);
    } catch (err) {
      // One unavailable voice or malformed script should not abandon the rest.
      failed += 1;
      logger.error({ roomId: room.id, err }, 'narration pre-generation failed for room');
      console.error(`  FAILED   "${room.title}": ${(err as Error).message}`);
    }
  }

  console.log(
    `[pregenerate] synthesized=${synthesized} reused=${reused} failed=${failed} total=${rooms.length}`,
  );
  if (failed > 0) process.exitCode = 1;
}

pregenerateNarration()
  .catch((err: unknown) => {
    logger.error({ err }, 'narration pre-generation crashed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
