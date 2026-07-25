import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_TEST_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CORS_ALLOWED_ORIGINS: z.string().default(''),

  // Chapa
  CHAPA_SECRET_KEY: z.string().min(1, 'CHAPA_SECRET_KEY is required'),
  CHAPA_BASE_URL: z.string().url().default('https://api.chapa.co/v1'),
  CHAPA_RETURN_URL: z.string().url('CHAPA_RETURN_URL must be a valid URL'),
  CHAPA_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  PAYMENTS_PROVIDER: z.enum(['chapa', 'fake']).default('fake'),

  // Ticketing
  TICKETS_PROVIDER: z.enum(['http', 'fake']).default('fake'),
  TICKET_VENDOR_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  ENABLE_STUB_TICKET_VENDOR: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  STUB_TICKET_CODES: z.string().default(''),
  OUTBOUND_HTTP_ALLOW_PRIVATE_IPS: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  // Seed
  SEED_SYSTEM_ADMIN_EMAIL: z.string().email().default('system@adwa.local'),
  SEED_SYSTEM_ADMIN_PASSWORD: z.string().min(8).default('Admin1234!'),
});

// Production guards
const productionGuardSchema = envSchema.superRefine((data, ctx) => {
  if (data.NODE_ENV !== 'production') return;

  if (data.ENABLE_STUB_TICKET_VENDOR) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ENABLE_STUB_TICKET_VENDOR must be false in production',
    });
  }
  if (data.OUTBOUND_HTTP_ALLOW_PRIVATE_IPS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'OUTBOUND_HTTP_ALLOW_PRIVATE_IPS must be false in production',
    });
  }
  if (data.CHAPA_SECRET_KEY.startsWith('CHASECK_TEST-')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'CHAPA_SECRET_KEY appears to be a test/sandbox key — cannot use in production',
    });
  }
});

function parseEnv() {
  const result = productionGuardSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`);
    console.error('[adwa-backend] Fatal: invalid environment variables:\n' + messages.join('\n'));
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = typeof env;
