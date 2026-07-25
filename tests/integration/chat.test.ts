import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { disconnectDb, resetDb } from '../helpers/db';
import { seedAdwaFixture } from '../helpers/fixtures';
import { __setLlmProviderForTesting, LlmGenerateInput, LlmGenerateOutput, LlmProvider } from '../../src/providers/llm';
import { purgeChatAnswersForRoom } from '../../src/modules/chat/service';

class ScriptedLlmProvider implements LlmProvider {
  readonly name = 'scripted-test-double';
  public calls = 0;
  public receivedPrompts: LlmGenerateInput[] = [];

  constructor(private readonly responses: string[], private readonly delayMs = 0) {}

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    this.receivedPrompts.push(input);
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    const text = this.responses[Math.min(this.calls, this.responses.length - 1)];
    this.calls += 1;
    return { text };
  }
}

describe('Chat grounding (§10)', () => {
  afterAll(async () => {
    await disconnectDb();
  });

  beforeEach(async () => {
    await resetDb();
    __setLlmProviderForTesting(null);
  });

  afterEach(() => {
    __setLlmProviderForTesting(null);
  });

  it('Case 1: grounds strictly on the tapped item and echoes matchedItemId + imageUrl', async () => {
    const { room1, treatyItem } = await seedAdwaFixture();

    const res = await request(app).post('/chat').send({
      waypointId: room1.id,
      itemId: treatyItem.id,
      question: 'What was wrong with Article XVII?',
    });

    expect(res.status).toBe(200);
    expect(res.body.matchedItemId).toBe(treatyItem.id);
    expect(res.body.imageUrl).toBe(treatyItem.imageUrl);
    expect(res.body.answer).toBeTruthy();
    expect(res.body.audioUrl).toMatch(/^\/narrate\/answer\//);
    expect(res.body.cached).toBe(false);
  });

  it('Case 2: classifies a free-form question against the room items', async () => {
    const { room1, treatyItem } = await seedAdwaFixture();

    const res = await request(app).post('/chat').send({
      waypointId: room1.id,
      question: 'Tell me about the Treaty of Wuchale',
    });

    expect(res.status).toBe(200);
    expect(res.body.matchedItemId).toBe(treatyItem.id);
  });

  it('falls back to room-overview grounding for a generic question', async () => {
    const { room1 } = await seedAdwaFixture();

    const res = await request(app).post('/chat').send({
      waypointId: room1.id,
      question: 'What is this room about?',
    });

    expect(res.status).toBe(200);
    expect(res.body.matchedItemId).toBeNull();
    expect(res.body.answer).toBeTruthy();
  });

  it('treats a stale/invalid itemId as null rather than erroring', async () => {
    const { room1 } = await seedAdwaFixture();

    const res = await request(app).post('/chat').send({
      waypointId: room1.id,
      itemId: 'this-item-was-deleted',
      question: 'What happened in the 19th century?',
    });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeTruthy();
  });

  it('rejects a missing or blank question with 400 VALIDATION_ERROR', async () => {
    const { room1 } = await seedAdwaFixture();

    const res = await request(app).post('/chat').send({ waypointId: room1.id, question: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an oversized question with 400 rather than truncating it (§9.2)', async () => {
    const { room1 } = await seedAdwaFixture();
    const longQuestion = 'a'.repeat(501);

    const res = await request(app).post('/chat').send({ waypointId: room1.id, question: longQuestion });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a nonexistent waypoint', async () => {
    await seedAdwaFixture();
    const res = await request(app)
      .post('/chat')
      .send({ waypointId: '00000000-0000-0000-0000-000000000000', question: 'Hello?' });
    expect(res.status).toBe(404);
  });

  it('rejects a hallucinated matchedItemId from the model rather than trusting it', async () => {
    const { room1 } = await seedAdwaFixture();
    const scripted = new ScriptedLlmProvider([
      JSON.stringify({ matchedItemId: 'not-a-real-item-id', answer: 'A hallucinated but confident answer.' }),
    ]);
    __setLlmProviderForTesting(scripted);

    const res = await request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me something' });

    expect(res.status).toBe(200);
    expect(res.body.matchedItemId).toBeNull();
    expect(res.body.imageUrl).toBeNull();
    expect(scripted.calls).toBe(1);
  });

  it('retries once on malformed JSON, then returns 502 UPSTREAM_FAILURE if it fails again', async () => {
    const { room1 } = await seedAdwaFixture();
    const scripted = new ScriptedLlmProvider(['not json at all', 'still not json']);
    __setLlmProviderForTesting(scripted);

    const res = await request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me something' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILURE');
    expect(scripted.calls).toBe(2);
  });

  it('recovers when the retry after malformed JSON succeeds', async () => {
    const { room1 } = await seedAdwaFixture();
    const scripted = new ScriptedLlmProvider([
      'not json at all',
      JSON.stringify({ matchedItemId: null, answer: 'Recovered on retry.' }),
    ]);
    __setLlmProviderForTesting(scripted);

    const res = await request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me something' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('Recovered on retry.');
    expect(scripted.calls).toBe(2);
  });

  it('caches identical questions: a second identical request skips the LLM entirely', async () => {
    const { room1, treatyItem } = await seedAdwaFixture();
    const scripted = new ScriptedLlmProvider([
      JSON.stringify({ matchedItemId: treatyItem.id, answer: 'Cached-worthy answer.' }),
    ]);
    __setLlmProviderForTesting(scripted);

    const first = await request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me about it' });
    const second = await request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me about it' });

    expect(first.body.cached).toBe(false);
    expect(second.body.cached).toBe(true);
    expect(second.body.answer).toBe(first.body.answer);
    expect(second.body.audioUrl).toBe(first.body.audioUrl);
    expect(scripted.calls).toBe(1);
  });

  it('purging a room\'s cache causes the next identical question to call the LLM again', async () => {
    const { room1, treatyItem } = await seedAdwaFixture();
    const scripted = new ScriptedLlmProvider([
      JSON.stringify({ matchedItemId: treatyItem.id, answer: 'First answer.' }),
      JSON.stringify({ matchedItemId: treatyItem.id, answer: 'Second answer after cache purge.' }),
    ]);
    __setLlmProviderForTesting(scripted);

    await request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me about it' });
    await purgeChatAnswersForRoom(room1.id);
    const after = await request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me about it' });

    expect(after.body.cached).toBe(false);
    expect(after.body.answer).toBe('Second answer after cache purge.');
    expect(scripted.calls).toBe(2);
  });

  it('de-dupes concurrent identical questions into a single LLM call', async () => {
    const { room1, treatyItem } = await seedAdwaFixture();
    const scripted = new ScriptedLlmProvider(
      [JSON.stringify({ matchedItemId: treatyItem.id, answer: 'One call to rule them all.' })],
      50
    );
    __setLlmProviderForTesting(scripted);

    const [first, second] = await Promise.all([
      request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me about it' }),
      request(app).post('/chat').send({ waypointId: room1.id, question: 'Tell me about it' }),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.answer).toBe('One call to rule them all.');
    expect(second.body.answer).toBe('One call to rule them all.');
    expect(scripted.calls).toBe(1);

    const rows = await prisma.chatAnswer.findMany({ where: { roomId: room1.id } });
    expect(rows).toHaveLength(1);
  });

  it('persists a ChatAnswer row keyed by room/item/question hash', async () => {
    const { room1 } = await seedAdwaFixture();
    await request(app).post('/chat').send({ waypointId: room1.id, question: 'A brand new question' });
    const rows = await prisma.chatAnswer.findMany({ where: { roomId: room1.id } });
    expect(rows).toHaveLength(1);
  });
});
