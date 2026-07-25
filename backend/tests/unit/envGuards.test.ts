/**
 * The boot guards in config/env.ts. Asserted against the schema directly
 * because loadEnv() calls process.exit on failure, which a test cannot survive.
 */
import { describe, expect, it } from 'vitest';
import { envSchemaWithProductionGuards } from '../../src/config/env.js';

/** The minimum a production process needs before the guards are the only thing left to fail. */
const productionBase = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/adwa',
  JWT_SECRET: 'a'.repeat(48),
  JWT_EXPIRES_IN: '1h',
};

function parse(overrides: Record<string, string>) {
  return envSchemaWithProductionGuards.safeParse({ ...productionBase, ...overrides });
}

function issuePaths(result: ReturnType<typeof parse>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('production boot guards', () => {
  it('refuses the fake payment provider, which would grant tiers without payment', () => {
    const result = parse({ PAYMENTS_PROVIDER: 'fake' });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('PAYMENTS_PROVIDER');
  });

  it('refuses a production boot that merely omits PAYMENTS_PROVIDER', () => {
    // The default is 'fake', so silence must fail too — a deploy that forgets
    // the variable is exactly the case this guard exists for.
    const result = parse({});

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('PAYMENTS_PROVIDER');
  });

  it('accepts chapa with credentials', () => {
    const result = parse({
      PAYMENTS_PROVIDER: 'chapa',
      CHAPA_SECRET_KEY: 'CHASECK-live-key',
      CHAPA_RETURN_URL: 'https://adwa.example.com/billing/return',
    });

    expect(result.success).toBe(true);
  });

  it('refuses chapa without its credentials', () => {
    const result = parse({ PAYMENTS_PROVIDER: 'chapa' });

    expect(issuePaths(result)).toEqual(
      expect.arrayContaining(['CHAPA_SECRET_KEY', 'CHAPA_RETURN_URL']),
    );
  });

  it('refuses a sandbox Chapa key', () => {
    const result = parse({
      PAYMENTS_PROVIDER: 'chapa',
      CHAPA_SECRET_KEY: 'CHASECK_TEST-abc123',
      CHAPA_RETURN_URL: 'https://adwa.example.com/billing/return',
    });

    expect(issuePaths(result)).toContain('CHAPA_SECRET_KEY');
  });

  it('refuses the stub ticket vendor and private-IP egress', () => {
    const result = parse({
      PAYMENTS_PROVIDER: 'chapa',
      CHAPA_SECRET_KEY: 'CHASECK-live-key',
      CHAPA_RETURN_URL: 'https://adwa.example.com/billing/return',
      ENABLE_STUB_TICKET_VENDOR: 'true',
      OUTBOUND_HTTP_ALLOW_PRIVATE_IPS: 'true',
    });

    expect(issuePaths(result)).toEqual(
      expect.arrayContaining(['ENABLE_STUB_TICKET_VENDOR', 'OUTBOUND_HTTP_ALLOW_PRIVATE_IPS']),
    );
  });

  it('leaves the fake provider alone outside production', () => {
    const result = envSchemaWithProductionGuards.safeParse({
      ...productionBase,
      NODE_ENV: 'development',
      PAYMENTS_PROVIDER: 'fake',
    });

    expect(result.success).toBe(true);
  });
});
