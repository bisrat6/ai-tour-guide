/**
 * Narration and the audio pipeline (dev2 §11): the pre-generated warm path, cold
 * synthesis, cache verification, and TTS cost controls.
 * Ported from dev2's narrate.test.ts onto this repo's test harness.
 */
import { Readable } from 'node:stream';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { audioContentHash } from '../../src/lib/hash.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetBreakersForTests } from '../../src/providers/resilience.js';
import { resetStorageProviderForTests } from '../../src/providers/storage/index.js';
import type {
  TtsProvider,
  TtsSynthesizeInput,
  TtsSynthesizeOutput,
} from '../../src/providers/tts/index.js';
import { getTtsProvider, setTtsProviderForTests } from '../../src/providers/tts/index.js';
import { ensureTestSchema, resetDatabase } from '../helpers/db.js';
import { seedVisitorFixture } from '../helpers/visitorFixture.js';

/** The delay is what makes a concurrent second request overlap the first. */
class DelayedScriptedTtsProvider implements TtsProvider {
  readonly name = 'scripted-test-double';
  readonly model = 'test-model';
  calls = 0;

  constructor(private readonly delayMs: number) {}

  async synthesize(_input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    this.calls += 1;
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    return { stream: Readable.from([Buffer.from('FAKE_MP3_BYTES')]), contentType: 'audio/mpeg' };
  }
}

/**
 * roomAudioUrl is written after the response has already streamed, so the
 * assertion has to wait for it rather than read immediately.
 */
async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 3000,
  intervalMs = 50,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

describe('narration and audio', () => {
  const app = createApp();

  beforeAll(() => {
    ensureTestSchema();
  });

  beforeEach(async () => {
    await resetDatabase();
    setTtsProviderForTests(null);
    // Memory storage would otherwise carry audio across test cases.
    resetStorageProviderForTests();
    resetBreakersForTests();
  });

  afterEach(() => {
    setTtsProviderForTests(null);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /narrate/room/:roomId', () => {
    it('redirects to pre-generated audio instead of proxying it', async () => {
      const { room1 } = await seedVisitorFixture();
      await prisma.room.update({
        where: { id: room1.id },
        data: { roomAudioUrl: 'https://cdn.example.test/rooms/room_1.mp3' },
      });

      const res = await request(app).get(`/narrate/room/${room1.id}`).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://cdn.example.test/rooms/room_1.mp3');
    });

    it('synthesizes on the cold path, streams the audio, and records it for next time', async () => {
      const { room1 } = await seedVisitorFixture();

      const res = await request(app).get(`/narrate/room/${room1.id}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
      expect(res.body.length).toBeGreaterThan(0);

      expect(
        await waitFor(async () => {
          const updated = await prisma.room.findUnique({ where: { id: room1.id } });
          return Boolean(updated?.roomAudioUrl);
        }),
      ).toBe(true);
      expect(await prisma.audioAsset.count()).toBe(1);
    });

    it('re-synthesizes when a cache record outlives the bytes it points at', async () => {
      const { room1 } = await seedVisitorFixture();
      // Mimics memory storage after a restart: the row survives, the bytes do not.
      await prisma.room.update({
        where: { id: room1.id },
        data: { roomAudioUrl: 'memory://audio/vanished.mp3' },
      });

      const res = await request(app).get(`/narrate/room/${room1.id}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('collapses concurrent identical narration requests into one TTS call', async () => {
      const { room1 } = await seedVisitorFixture();
      const scripted = new DelayedScriptedTtsProvider(50);
      setTtsProviderForTests(scripted);

      const [first, second] = await Promise.all([
        request(app).get(`/narrate/room/${room1.id}`),
        request(app).get(`/narrate/room/${room1.id}`),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      // The follower is served the leader's buffered bytes, not its own synthesis.
      expect(first.body.toString()).toBe('FAKE_MP3_BYTES');
      expect(second.body.toString()).toBe('FAKE_MP3_BYTES');
      expect(scripted.calls).toBe(1);
      expect(await prisma.audioAsset.count()).toBe(1);
    });

    it('404s an unknown room and a room in a suspended museum alike', async () => {
      const { suspendedRoom } = await seedVisitorFixture();

      expect(
        (await request(app).get('/narrate/room/00000000-0000-0000-0000-000000000000')).status,
      ).toBe(404);
      expect((await request(app).get(`/narrate/room/${suspendedRoom.id}`)).status).toBe(404);
    });
  });

  describe('GET /narrate/answer/:answerId', () => {
    it('streams audio for an answer handle handed out by /chat', async () => {
      const { room1 } = await seedVisitorFixture();
      const chatRes = await request(app)
        .post('/chat')
        .send({ waypointId: room1.id, question: 'Tell me more' });
      expect(chatRes.status).toBe(200);

      const answerId = chatRes.body.audioUrl.replace('/narrate/answer/', '');
      const res = await request(app).get(`/narrate/answer/${answerId}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
      expect(res.body.length).toBeGreaterThan(0);

      // The synthesized audio is linked back to the answer for the next request.
      const stored = await prisma.chatAnswer.findUnique({ where: { id: answerId } });
      expect(stored?.audioHash).toBeTruthy();
    });

    it('redirects to already-cached object storage rather than proxying', async () => {
      const { room1 } = await seedVisitorFixture();
      const chatRes = await request(app)
        .post('/chat')
        .send({ waypointId: room1.id, question: 'Tell me more' });
      expect(chatRes.status).toBe(200);

      const answerId = chatRes.body.audioUrl.replace('/narrate/answer/', '');
      const { model } = getTtsProvider();
      const contentHash = audioContentHash(
        chatRes.body.answer,
        env.ELEVENLABS_DEFAULT_VOICE_ID,
        model,
      );
      await prisma.audioAsset.create({
        data: {
          contentHash,
          url: 'https://cdn.example.test/answers/cached.mp3',
          voiceId: env.ELEVENLABS_DEFAULT_VOICE_ID,
          model,
        },
      });

      const res = await request(app).get(`/narrate/answer/${answerId}`).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://cdn.example.test/answers/cached.mp3');
    });

    it('uses the museum voice when one is configured, keying the cache to it', async () => {
      const { museum, room1 } = await seedVisitorFixture();
      await prisma.museum.update({
        where: { id: museum.id },
        data: { defaultVoiceId: 'museum-specific-voice' },
      });

      const chatRes = await request(app)
        .post('/chat')
        .send({ waypointId: room1.id, question: 'Tell me more' });
      const answerId = chatRes.body.audioUrl.replace('/narrate/answer/', '');

      const res = await request(app).get(`/narrate/answer/${answerId}`);
      expect(res.status).toBe(200);

      const asset = await prisma.audioAsset.findFirst();
      expect(asset?.voiceId).toBe('museum-specific-voice');
    });

    it('404s an unknown answer id', async () => {
      await seedVisitorFixture();

      const res = await request(app).get('/narrate/answer/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
    });

    it('404s an answer whose room belongs to a suspended museum', async () => {
      const { suspendedRoom } = await seedVisitorFixture();
      const answer = await prisma.chatAnswer.create({
        data: {
          roomId: suspendedRoom.id,
          questionHash: 'test-hash-suspended',
          question: 'irrelevant',
          answer: 'irrelevant',
        },
      });

      const res = await request(app).get(`/narrate/answer/${answer.id}`);

      expect(res.status).toBe(404);
    });
  });
});
