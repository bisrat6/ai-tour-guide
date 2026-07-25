import { Readable } from 'stream';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { disconnectDb, resetDb } from '../helpers/db';
import { seedAdwaFixture } from '../helpers/fixtures';
import { audioContentHash } from '../../src/lib/hash';
import { env } from '../../src/config/env';
import {
  __setTtsProviderForTesting,
  getTtsProvider,
  TtsProvider,
  TtsSynthesizeInput,
  TtsSynthesizeOutput,
} from '../../src/providers/tts';

class DelayedScriptedTtsProvider implements TtsProvider {
  readonly name = 'scripted-test-double';
  readonly model = 'test-model';
  public calls = 0;

  constructor(private readonly delayMs: number) {}

  async synthesize(_input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    this.calls += 1;
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    return { stream: Readable.from([Buffer.from('FAKE_MP3_BYTES')]), contentType: 'audio/mpeg' };
  }
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 3000, intervalMs = 50): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

describe('Narration and audio pipeline (§11)', () => {
  afterAll(async () => {
    await disconnectDb();
  });

  beforeEach(async () => {
    await resetDb();
    __setTtsProviderForTesting(null);
  });

  afterEach(() => {
    __setTtsProviderForTesting(null);
  });

  describe('GET /narrate/room/:roomId', () => {
    it('redirects to the pre-generated roomAudioUrl when one already exists (warm path, §11.5)', async () => {
      const { room1 } = await seedAdwaFixture();
      await prisma.room.update({
        where: { id: room1.id },
        data: { roomAudioUrl: 'https://cdn.example.test/rooms/room_1.mp3' },
      });

      const res = await request(app).get(`/narrate/room/${room1.id}`).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://cdn.example.test/rooms/room_1.mp3');
    });

    it('synthesizes on the cold path, streams audio, and persists roomAudioUrl for next time', async () => {
      const { room1 } = await seedAdwaFixture();

      const res = await request(app).get(`/narrate/room/${room1.id}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
      expect(res.body.length).toBeGreaterThan(0);

      const persisted = await waitFor(async () => {
        const updated = await prisma.room.findUnique({ where: { id: room1.id } });
        return !!updated?.roomAudioUrl;
      });
      expect(persisted).toBe(true);

      const assetCount = await prisma.audioAsset.count();
      expect(assetCount).toBe(1);
    });

    it('returns 404 for a room belonging to a suspended museum', async () => {
      const { suspendedRoom } = await seedAdwaFixture();
      const res = await request(app).get(`/narrate/room/${suspendedRoom.id}`);
      expect(res.status).toBe(404);
    });

    it('de-dupes concurrent identical narration requests into a single TTS call', async () => {
      const { room1 } = await seedAdwaFixture();
      const scripted = new DelayedScriptedTtsProvider(50);
      __setTtsProviderForTesting(scripted);

      const [first, second] = await Promise.all([
        request(app).get(`/narrate/room/${room1.id}`),
        request(app).get(`/narrate/room/${room1.id}`),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.toString()).toBe('FAKE_MP3_BYTES');
      expect(second.body.toString()).toBe('FAKE_MP3_BYTES');
      expect(scripted.calls).toBe(1);

      const assetCount = await prisma.audioAsset.count();
      expect(assetCount).toBe(1);
    });

    it('returns 404 for a nonexistent room', async () => {
      await seedAdwaFixture();
      const res = await request(app).get('/narrate/room/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('re-synthesizes instead of failing when a cached record outlives its stored bytes', async () => {
      const { room1 } = await seedAdwaFixture();
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
  });

  describe('GET /narrate/answer/:answerId', () => {
    it('redirects to a real object-storage URL instead of proxying, when one is already cached', async () => {
      const { room1 } = await seedAdwaFixture();
      const chatRes = await request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me more' });
      expect(chatRes.status).toBe(200);

      const answerId = chatRes.body.audioUrl.replace('/narrate/answer/', '');
      const { model } = getTtsProvider();
      const contentHash = audioContentHash(chatRes.body.answer, env.ELEVENLABS_DEFAULT_VOICE_ID, model);
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

    it('streams audio for a stored chat answer produced by /chat', async () => {
      const { room1 } = await seedAdwaFixture();
      const chatRes = await request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me more' });
      expect(chatRes.status).toBe(200);

      const answerId = chatRes.body.audioUrl.replace('/narrate/answer/', '');
      const res = await request(app).get(`/narrate/answer/${answerId}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns 404 for an unknown answerId', async () => {
      await seedAdwaFixture();
      const res = await request(app).get('/narrate/answer/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('returns 404 when the answer belongs to a room in a suspended museum', async () => {
      const { suspendedRoom } = await seedAdwaFixture();
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
