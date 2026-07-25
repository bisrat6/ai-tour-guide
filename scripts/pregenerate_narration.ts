import { PrismaClient } from '@prisma/client';
import { audioContentHash } from '../src/lib/hash';
import { env } from '../src/config/env';
import { getTtsProvider } from '../src/providers/tts';
import { getStorageProvider } from '../src/providers/storage';

const prisma = new PrismaClient();

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Offline pre-generation (§11.5). Synthesizes every room's narrationScript
 * once and writes a durable roomAudioUrl, so GET /narrate/room/:roomId is a
 * cold path in production rather than something visitors wait on.
 */
async function pregenerateNarration() {
  console.log('Starting offline room narration pre-generation...');

  const tts = getTtsProvider();
  const storage = getStorageProvider();

  const rooms = await prisma.room.findMany({ include: { museum: { select: { defaultVoiceId: true } } } });
  console.log(`Found ${rooms.length} rooms to process.`);

  for (const room of rooms) {
    const voiceId = room.museum.defaultVoiceId ?? env.ELEVENLABS_DEFAULT_VOICE_ID;
    const contentHash = audioContentHash(room.narrationScript, voiceId, tts.model);
    const key = `audio/${contentHash}.mp3`;

    try {
      const existing = await prisma.audioAsset.findUnique({ where: { contentHash } });
      if (existing) {
        await prisma.room.update({ where: { id: room.id }, data: { roomAudioUrl: existing.url } });
        console.log(`[${room.id}] "${room.title}" — reused cached audio.`);
        continue;
      }

      const { stream, contentType } = await tts.synthesize({ text: room.narrationScript, voiceId });
      const buffer = await streamToBuffer(stream);
      const { url } = await storage.put(key, buffer, contentType);

      await prisma.audioAsset.create({
        data: { contentHash, url, voiceId, model: tts.model, byteSize: buffer.length },
      });
      await prisma.room.update({ where: { id: room.id }, data: { roomAudioUrl: url } });

      console.log(`[${room.id}] "${room.title}" — synthesized and stored (${buffer.length} bytes).`);
    } catch (err) {
      console.error(`[${room.id}] "${room.title}" — narration generation failed:`, (err as Error).message);
    }
  }

  console.log('Narration pre-generation complete.');
}

pregenerateNarration()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
