import { describe, expect, it } from 'vitest';
import { loginRequestSchema } from '../../src/modules/auth/schemas.js';
import { createMuseumRequestSchema } from '../../src/modules/museums/schemas.js';
import { createRoomRequestSchema } from '../../src/modules/rooms/schemas.js';
import { errorEnvelopeSchema } from '../../src/shared/errorEnvelope.js';

describe('loginRequestSchema', () => {
  it('accepts a valid login body', () => {
    expect(loginRequestSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = loginRequestSchema.safeParse({ email: 'not-an-email', password: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('createMuseumRequestSchema', () => {
  it('rejects a slug with uppercase or spaces', () => {
    expect(
      createMuseumRequestSchema.safeParse({
        name: 'Test',
        slug: 'Not A Slug',
        adminEmail: 'a@b.com',
        adminPassword: 'longenough',
      }).success,
    ).toBe(false);
  });

  it('accepts a well-formed request', () => {
    expect(
      createMuseumRequestSchema.safeParse({
        name: 'Test Museum',
        slug: 'test-museum',
        adminEmail: 'a@b.com',
        adminPassword: 'longenough',
      }).success,
    ).toBe(true);
  });
});

describe('createRoomRequestSchema', () => {
  it('requires storyOrder to be at least 1', () => {
    expect(
      createRoomRequestSchema.safeParse({
        title: 'Room',
        roomOverviewText: 'x',
        narrationScript: 'x',
        storyOrder: 0,
      }).success,
    ).toBe(false);
  });
});

describe('errorEnvelopeSchema', () => {
  it('validates a well-formed error envelope', () => {
    expect(
      errorEnvelopeSchema.safeParse({
        error: { message: 'nope', code: 'NOT_FOUND', requestId: 'req-1' },
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown error code', () => {
    expect(
      errorEnvelopeSchema.safeParse({
        error: { message: 'nope', code: 'NOT_A_REAL_CODE', requestId: 'req-1' },
      }).success,
    ).toBe(false);
  });
});
