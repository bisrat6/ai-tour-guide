import { config } from 'dotenv';
import { z } from 'zod';

// quiet: true suppresses dotenv's stdout "tip" ads (see motdotla/dotenv#1020),
// which would otherwise print on every process start, including production.
config({ quiet: true });

/**
 * §5 Environment variables. The process refuses to start if a required
 * variable is missing or malformed — a backend that boots with a missing
 * JWT_SECRET and fails on first login is worse than one that never boots.
 *
 * Third-party provider variables are intentionally optional here: they are
 * not this role's routes (§10-§13, owned by Developers 2 and 3), and are
 * only actually required once the feature that depends on them exists.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Read directly by tests/setup/testEnv.ts before this module loads, which
  // swaps it into DATABASE_URL for the test process only (§17.1) — never
  // used by the app itself, documented here just so it isn't a mystery var.
  TEST_DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+(ms|s|m|h|d|w|y)$/, 'Must look like a duration, e.g. 12h, 30m, 7d')
    .default('12h'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  SEED_SYSTEM_ADMIN_EMAIL: z.email().optional(),
  SEED_SYSTEM_ADMIN_PASSWORD: z.string().min(8).optional(),
  // Shared password for the one MUSEUM_ADMIN seeded per museum (§16.3) —
  // local development convenience only, never used in production seeding.
  SEED_MUSEUM_ADMIN_PASSWORD: z.string().min(8).optional(),

  LLM_PROVIDER: z.enum(['openai', 'addisai']).default('openai'),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  TTS_PROVIDER: z.enum(['elevenlabs']).default('elevenlabs'),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_MODEL: z.string().default('eleven_flash_v2_5'),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().optional(),
  TTS_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),

  STORAGE_PROVIDER: z.enum(['s3', 'memory']).default('s3'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_BASE_URL: z.string().optional(),

  CHAT_RATE_LIMIT_PER_5MIN: z.coerce.number().int().positive().default(20),
  CHAT_MAX_QUESTION_CHARS: z.coerce.number().int().positive().default(500),
  ANSWER_CACHE_TTL_HOURS: z.coerce.number().int().positive().default(24),

  // Payments (dev3 §4). CHAPA_SECRET_KEY and CHAPA_RETURN_URL are optional
  // here, not required as on dev3's branch: the same optional-until-needed rule
  // as the LLM/TTS vars above, so tests and the fake provider don't need a
  // Chapa account. The chapa adapter fails loudly if they're missing when used.
  PAYMENTS_PROVIDER: z.enum(['chapa', 'fake']).default('fake'),
  CHAPA_SECRET_KEY: z.string().optional(),
  CHAPA_BASE_URL: z.url().default('https://api.chapa.co/v1'),
  CHAPA_RETURN_URL: z.url().optional(),
  CHAPA_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

  // Ticketing (dev3 §6).
  TICKETS_PROVIDER: z.enum(['http', 'fake']).default('fake'),
  TICKET_VENDOR_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  ENABLE_STUB_TICKET_VENDOR: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  STUB_TICKET_CODES: z.string().default(''),
  // Lets the SSRF guard reach a vendor on localhost during development. The
  // production guard below refuses to boot with this on.
  OUTBOUND_HTTP_ALLOW_PRIVATE_IPS: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
});

/**
 * Configuration that is merely wrong in development but dangerous in
 * production, so it is rejected at boot rather than at first use.
 *
 * Exported so tests can assert the guards without booting a second process.
 */
export const envSchemaWithProductionGuards = envSchema.superRefine((data, ctx) => {
  // Selecting the real payment provider without its credentials is a
  // misconfiguration in any environment, so this one is not production-only.
  if (data.PAYMENTS_PROVIDER === 'chapa') {
    if (!data.CHAPA_SECRET_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['CHAPA_SECRET_KEY'],
        message: 'is required when PAYMENTS_PROVIDER=chapa',
      });
    }
    if (!data.CHAPA_RETURN_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['CHAPA_RETURN_URL'],
        message: 'is required when PAYMENTS_PROVIDER=chapa',
      });
    }
  }

  if (data.NODE_ENV !== 'production') return;

  // The fake provider reports every checkout as paid, so leaving the default in
  // place would hand out paid tiers without taking any money. Refused at boot
  // rather than at first use: the first use is a granted subscription.
  if (data.PAYMENTS_PROVIDER === 'fake') {
    ctx.addIssue({
      code: 'custom',
      path: ['PAYMENTS_PROVIDER'],
      message: 'must not be "fake" in production — it grants paid tiers without taking payment',
    });
  }
  if (data.ENABLE_STUB_TICKET_VENDOR) {
    ctx.addIssue({
      code: 'custom',
      path: ['ENABLE_STUB_TICKET_VENDOR'],
      message: 'must be false in production',
    });
  }
  if (data.OUTBOUND_HTTP_ALLOW_PRIVATE_IPS) {
    ctx.addIssue({
      code: 'custom',
      path: ['OUTBOUND_HTTP_ALLOW_PRIVATE_IPS'],
      message: 'must be false in production',
    });
  }
  if (data.CHAPA_SECRET_KEY?.startsWith('CHASECK_TEST-')) {
    ctx.addIssue({
      code: 'custom',
      path: ['CHAPA_SECRET_KEY'],
      message: 'looks like a sandbox key — refusing to use it in production',
    });
  }
});

function loadEnv() {
  const parsed = envSchemaWithProductionGuards.safeParse(process.env);
  if (!parsed.success) {
    // Deliberately not using the app logger here: this runs before it (or
    // anything else) is safe to construct, and boot failures need to be
    // visible even if logging itself is misconfigured.
    console.error('Invalid environment configuration — refusing to start:');
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
