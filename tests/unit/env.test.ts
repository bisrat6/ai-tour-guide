import { Env, getProductionConfigWarnings } from '../../src/config/env';

function buildEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'production',
    PORT: 3000,
    DATABASE_URL: 'postgresql://localhost:5432/db',

    JWT_SECRET: 'a'.repeat(32),
    JWT_EXPIRES_IN: '12h',
    CORS_ALLOWED_ORIGINS: '',

    LLM_PROVIDER: 'openai',
    LLM_API_KEY: 'sk-real-key',
    LLM_MODEL: 'gpt-4o-mini',
    LLM_TIMEOUT_MS: 15000,

    TTS_PROVIDER: 'elevenlabs',
    ELEVENLABS_API_KEY: 'real-key',
    ELEVENLABS_MODEL: 'eleven_flash_v2_5',
    ELEVENLABS_DEFAULT_VOICE_ID: '21m00Tcm4TlvDq8ikWAM',
    TTS_TIMEOUT_MS: 20000,

    STORAGE_PROVIDER: 's3',
    STORAGE_BUCKET: 'bucket',
    STORAGE_REGION: 'auto',
    STORAGE_ENDPOINT: '',
    STORAGE_ACCESS_KEY_ID: 'key',
    STORAGE_SECRET_ACCESS_KEY: 'secret',
    STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.test',

    CHAT_RATE_LIMIT_PER_5MIN: 20,
    CHAT_MAX_QUESTION_CHARS: 500,
    ANSWER_CACHE_TTL_HOURS: 24,

    ...overrides,
  };
}

describe('getProductionConfigWarnings', () => {
  it('returns no warnings when NODE_ENV is not production, regardless of config', () => {
    const cfg = buildEnv({ NODE_ENV: 'development', LLM_API_KEY: '', ELEVENLABS_API_KEY: '', STORAGE_PROVIDER: 'memory' });
    expect(getProductionConfigWarnings(cfg)).toEqual([]);
  });

  it('returns no warnings in production when every vendor key/storage is properly configured', () => {
    expect(getProductionConfigWarnings(buildEnv())).toEqual([]);
  });

  it('flags a missing LLM_API_KEY in production', () => {
    const warnings = getProductionConfigWarnings(buildEnv({ LLM_API_KEY: '' }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/LLM_API_KEY/);
  });

  it('flags a missing ELEVENLABS_API_KEY in production', () => {
    const warnings = getProductionConfigWarnings(buildEnv({ ELEVENLABS_API_KEY: '' }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/ELEVENLABS_API_KEY/);
  });

  it('flags STORAGE_PROVIDER=memory in production', () => {
    const warnings = getProductionConfigWarnings(buildEnv({ STORAGE_PROVIDER: 'memory' }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/STORAGE_PROVIDER/);
  });

  it('flags all three simultaneously when all are dev-only', () => {
    const warnings = getProductionConfigWarnings(
      buildEnv({ LLM_API_KEY: '', ELEVENLABS_API_KEY: '', STORAGE_PROVIDER: 'memory' })
    );
    expect(warnings).toHaveLength(3);
  });
});
