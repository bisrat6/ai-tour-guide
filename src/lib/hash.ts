import crypto from 'crypto';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Lowercases, collapses whitespace, and strips trailing punctuation (§13.2). */
export function normalizeQuestion(question: string): string {
  return question
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/, '');
}

export function questionHash(roomId: string, itemId: string | null, question: string): string {
  return sha256(`${roomId}:${itemId ?? ''}:${normalizeQuestion(question)}`);
}

export function audioContentHash(text: string, voiceId: string, model: string): string {
  return sha256(`${text}:${voiceId}:${model}`);
}
