import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CORS_ALLOWED_ORIGINS: z.string().default(''),

  LLM_PROVIDER: z.enum(['openai', 'addisai']).default('openai'),
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  TTS_PROVIDER: z.enum(['elevenlabs']).default('elevenlabs'),
  ELEVENLABS_API_KEY: z.string().default(''),
  ELEVENLABS_MODEL: z.string().default('eleven_flash_v2_5'),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().default('21m00Tcm4TlvDq8ikWAM'),
  TTS_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),

  STORAGE_PROVIDER: z.enum(['s3', 'memory']).default('memory'),
  STORAGE_BUCKET: z.string().default(''),
  STORAGE_REGION: z.string().default(''),
  STORAGE_ENDPOINT: z.string().default(''),
  STORAGE_ACCESS_KEY_ID: z.string().default(''),
  STORAGE_SECRET_ACCESS_KEY: z.string().default(''),
  STORAGE_PUBLIC_BASE_URL: z.string().default(''),

  CHAT_RATE_LIMIT_PER_5MIN: z.coerce.number().int().positive().default(20),
  CHAT_MAX_QUESTION_CHARS: z.coerce.number().int().positive().default(500),
  ANSWER_CACHE_TTL_HOURS: z.coerce.number().int().positive().default(24),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Dev-only fallbacks (fake LLM/TTS responses, in-memory storage) are safe for
 * local development and tests but must never run silently in production —
 * a deploy missing a vendor key should refuse to start, not serve real
 * visitors canned answers with no indication anything is wrong.
 */
export function getProductionConfigWarnings(cfg: Env): string[] {
  if (cfg.NODE_ENV !== 'production') return [];

  const warnings: string[] = [];
  if (!cfg.LLM_API_KEY) warnings.push('LLM_API_KEY is not set (LLM calls would fall back to fake responses)');
  if (!cfg.ELEVENLABS_API_KEY) {
    warnings.push('ELEVENLABS_API_KEY is not set (TTS calls would fall back to fake audio)');
  }
  if (cfg.STORAGE_PROVIDER === 'memory') {
    warnings.push('STORAGE_PROVIDER is "memory" (audio would not persist across restarts/instances)');
  }
  return warnings;
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:');
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const productionWarnings = getProductionConfigWarnings(parsed.data);
  if (productionWarnings.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Refusing to start in production with dev-only configuration:');
    // eslint-disable-next-line no-console
    productionWarnings.forEach((w) => console.error(`  - ${w}`));
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
