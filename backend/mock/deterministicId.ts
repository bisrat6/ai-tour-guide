import { createHash } from 'node:crypto';

/**
 * A stable, UUID-shaped id derived from a seed string (e.g. `${museumSlug}:${legacyId}`).
 * Not a real UUID v5 — just SHA-256 truncated and reformatted with valid
 * version/variant nibbles — but it looks right and, critically for a mock
 * server that other developers build fixtures against, it is the same on
 * every restart.
 */
export function deterministicUuid(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  const version = '4';
  const variant = ((parseInt(hex[16] ?? '8', 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    version + hex.slice(13, 16),
    variant + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}
