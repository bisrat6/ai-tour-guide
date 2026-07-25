import { describe, expect, it } from 'vitest';
import { deterministicUuid } from '../../mock/deterministicId.js';

describe('deterministicUuid', () => {
  it('is stable across calls for the same seed', () => {
    expect(deterministicUuid('adwa:room:room_1')).toBe(deterministicUuid('adwa:room:room_1'));
  });

  it('differs for different seeds', () => {
    expect(deterministicUuid('adwa:room:room_1')).not.toBe(deterministicUuid('adwa:room:room_2'));
  });

  it('is shaped like a UUID', () => {
    const uuid = deterministicUuid('anything');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
