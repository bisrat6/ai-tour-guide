import { PassThrough, type Readable } from 'node:stream';
import type { Response } from 'express';
import { env } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';
import { audioContentHash } from '../../lib/hash.js';
import { dedupeInFlight } from '../../lib/inFlight.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { UpstreamFailureError, UpstreamUnavailableError } from '../../providers/resilience.js';
import { getStorageProvider } from '../../providers/storage/index.js';
import { getTtsProvider } from '../../providers/tts/index.js';

function audioKeyFor(contentHash: string): string {
  return `audio/${contentHash}.mp3`;
}

/**
 * The memory storage provider hands back `memory://` URLs that no client can
 * fetch, so those bytes must be proxied. A real object-storage URL is directly
 * fetchable and is redirected to instead — proxying it would cost this process
 * bandwidth and latency on every cache hit for nothing.
 */
function isRedirectableUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Serves previously cached audio, reporting false if it could not, so the caller
 * falls through to synthesis. A cache row is only a hint: with memory storage
 * the bytes are gone after a restart while the row survives, so a recorded URL
 * is verified against storage rather than trusted into a 500.
 */
async function serveCachedAudio(res: Response, url: string, key: string): Promise<boolean> {
  if (isRedirectableUrl(url)) {
    res.redirect(302, url);
    return true;
  }

  const storage = getStorageProvider();
  const { exists } = await storage.head(key);
  if (!exists) {
    logger.warn({ key, url }, 'cached audio record points at bytes that are gone, re-synthesizing');
    return false;
  }

  const stream = await storage.getStream(key);
  res.setHeader('Content-Type', 'audio/mpeg');
  stream.pipe(res);
  return true;
}

/**
 * Tees the TTS byte stream to the initiating response while buffering it,
 * resolving with the full buffer once the stream ends. Used only by the leader
 * of a synthesis — the request that actually triggered the vendor call.
 */
async function teeStreamToResponseAndBuffer(
  source: Readable,
  contentType: string,
  res: Response,
): Promise<Buffer> {
  const toClient = new PassThrough();
  const toBuffer = new PassThrough();

  res.status(200);
  res.setHeader('Content-Type', contentType);
  toClient.pipe(res);

  const chunks: Buffer[] = [];
  toBuffer.on('data', (chunk: Buffer) => chunks.push(chunk));

  const buffered = new Promise<void>((resolve) => {
    toBuffer.on('end', () => resolve());
    toBuffer.on('error', () => resolve());
  });

  source.on('error', (err) => {
    logger.error({ err: String(err) }, 'tts stream errored mid-flight');
    toClient.destroy(err);
    toBuffer.destroy(err);
  });

  source.pipe(toClient);
  source.pipe(toBuffer);

  await buffered;
  return Buffer.concat(chunks);
}

/** Persists a synthesized buffer to storage and records the AudioAsset row (dev2 §11.3). */
async function persistAudioAsset(
  key: string,
  buffer: Buffer,
  contentType: string,
  meta: { contentHash: string; voiceId: string; model: string },
): Promise<string> {
  try {
    const { url } = await getStorageProvider().put(key, buffer, contentType);
    await prisma.audioAsset.upsert({
      where: { contentHash: meta.contentHash },
      create: {
        contentHash: meta.contentHash,
        url,
        voiceId: meta.voiceId,
        model: meta.model,
        byteSize: buffer.length,
      },
      update: { url, byteSize: buffer.length },
    });
    return url;
  } catch (err) {
    // Synthesis already reached the leader's client, so a failed cache write
    // only means the next request pays for synthesis again. Log, do not fail.
    logger.error({ err: String(err) }, 'failed to persist AudioAsset after streaming');
    return '';
  }
}

interface SynthesisResult {
  url: string;
  buffer: Buffer;
  contentType: string;
}

/**
 * De-dupes concurrent synthesis of identical audio (dev2 §13.5). If two requests
 * for the same audio arrive before the first is cached, only the leader calls
 * the TTS provider and streams live; followers await the same result and are
 * served the buffered bytes, rather than each triggering a billable call.
 */
const inFlightSynthesis = new Map<string, Promise<SynthesisResult>>();

async function synthesizeStreamAndCache(
  res: Response,
  contentHash: string,
  key: string,
  voiceId: string,
  text: string,
): Promise<void> {
  let result: SynthesisResult;
  try {
    result = await dedupeInFlight(inFlightSynthesis, contentHash, async () => {
      const tts = getTtsProvider();
      const { stream, contentType } = await tts.synthesize({ text, voiceId });
      const buffer = await teeStreamToResponseAndBuffer(stream, contentType, res);
      const url = await persistAudioAsset(key, buffer, contentType, {
        contentHash,
        voiceId,
        model: tts.model,
      });
      return { url, buffer, contentType };
    });
  } catch (err) {
    if (err instanceof UpstreamUnavailableError) {
      throw ApiError.upstreamUnavailable('Narration is temporarily unavailable.');
    }
    if (err instanceof UpstreamFailureError) {
      logger.error({ contentHash, err }, 'tts synthesis failed');
      throw ApiError.upstreamFailure('Narration could not be generated right now.');
    }
    throw err;
  }

  // We were the leader: the response has already streamed.
  if (res.headersSent) return;

  // We were a follower, so this response was never touched by the shared
  // synthesis above. Send it now from the buffered result.
  if (isRedirectableUrl(result.url)) {
    res.redirect(302, result.url);
    return;
  }
  res.setHeader('Content-Type', result.contentType);
  res.status(200).send(result.buffer);
}

/** GET /narrate/room/:roomId (dev2 §11.2). */
export async function streamRoomNarration(roomId: string, res: Response): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { museum: { select: { status: true, defaultVoiceId: true } } },
  });

  if (!room || room.museum.status === 'SUSPENDED') {
    throw ApiError.notFound('Room not found.');
  }

  const voiceId = room.museum.defaultVoiceId ?? env.ELEVENLABS_DEFAULT_VOICE_ID;
  const tts = getTtsProvider();
  const contentHash = audioContentHash(room.narrationScript, voiceId, tts.model);
  const key = audioKeyFor(contentHash);

  // Pre-generated, which is the expected warm path in production (dev2 §11.5).
  if (room.roomAudioUrl && (await serveCachedAudio(res, room.roomAudioUrl, key))) {
    return;
  }

  const existingAsset = await prisma.audioAsset.findUnique({ where: { contentHash } });
  if (existingAsset && (await serveCachedAudio(res, existingAsset.url, key))) {
    await prisma.room.update({ where: { id: room.id }, data: { roomAudioUrl: existingAsset.url } });
    return;
  }

  // Cold path: synthesize now, stream to this client, and record it so the room
  // never re-synthesizes.
  await synthesizeStreamAndCache(res, contentHash, key, voiceId, room.narrationScript);

  const asset = await prisma.audioAsset.findUnique({ where: { contentHash } });
  if (asset?.url) {
    await prisma.room.update({ where: { id: room.id }, data: { roomAudioUrl: asset.url } });
  }
}

/**
 * GET /narrate/answer/:answerId (dev2 §11.2). The id is unguessable and only
 * ever handed out by POST /chat, which is what keeps this route open.
 */
export async function streamAnswerNarration(answerId: string, res: Response): Promise<void> {
  const chatAnswer = await prisma.chatAnswer.findUnique({
    where: { id: answerId },
    include: { room: { include: { museum: { select: { status: true, defaultVoiceId: true } } } } },
  });

  if (!chatAnswer || chatAnswer.room.museum.status === 'SUSPENDED') {
    throw ApiError.notFound('Answer not found.');
  }

  const voiceId = chatAnswer.room.museum.defaultVoiceId ?? env.ELEVENLABS_DEFAULT_VOICE_ID;
  const tts = getTtsProvider();
  const contentHash = audioContentHash(chatAnswer.answer, voiceId, tts.model);
  const key = audioKeyFor(contentHash);

  const existingAsset = await prisma.audioAsset.findUnique({ where: { contentHash } });
  if (existingAsset && (await serveCachedAudio(res, existingAsset.url, key))) {
    if (chatAnswer.audioHash !== contentHash) {
      await prisma.chatAnswer.update({
        where: { id: chatAnswer.id },
        data: { audioHash: contentHash },
      });
    }
    return;
  }

  await synthesizeStreamAndCache(res, contentHash, key, voiceId, chatAnswer.answer);
  await prisma.chatAnswer.update({
    where: { id: chatAnswer.id },
    data: { audioHash: contentHash },
  });
}
