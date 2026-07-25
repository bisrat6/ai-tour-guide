import crypto from 'node:crypto';

/**
 * Cache keys for the answer and audio caches (dev2 §13.2). Ported from dev2's
 * branch unchanged apart from the node: import prefix.
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Lowercases, collapses whitespace, and strips trailing punctuation, so
 * "Who was Menelik?" and "who was menelik" share one cached answer.
 */
export function normalizeQuestion(question: string): string {
  return question
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/, '');
}

/** Must match the ChatAnswer.questionHash contract in docs/dev2-dev3-handoff.md. */
export function questionHash(roomId: string, itemId: string | null, question: string): string {
  return sha256(`${roomId}:${itemId ?? ''}:${normalizeQuestion(question)}`);
}

/**
 * The voice and model are part of the identity: the same script narrated by a
 * different voice is different audio and must not collide in the cache.
 */
export function audioContentHash(text: string, voiceId: string, model: string): string {
  return sha256(`${text}:${voiceId}:${model}`);
}
