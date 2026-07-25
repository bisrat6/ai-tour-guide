import { defineConfig } from 'vitest/config';

// Compose injects DATABASE_URL=...@db:5432 into the api container. Force the
// test database before any module (including Prisma) reads process.env.
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://adwa:adwa@db-test:5432/adwa_test';
process.env['DATABASE_TEST_URL'] = 'postgresql://adwa:adwa@db-test:5432/adwa_test';
process.env['JWT_SECRET'] = 'test-secret-at-least-32-chars-long!!';
process.env['PAYMENTS_PROVIDER'] = 'fake';
process.env['TICKETS_PROVIDER'] = 'fake';
process.env['ENABLE_STUB_TICKET_VENDOR'] = 'false';
process.env['STUB_TICKET_CODES'] = 'DEMO-1234';
process.env['OUTBOUND_HTTP_ALLOW_PRIVATE_IPS'] = 'false';
process.env['CHAPA_SECRET_KEY'] = 'CHASECK_TEST-testkey';
process.env['CHAPA_BASE_URL'] = 'https://api.chapa.co/v1';
process.env['CHAPA_RETURN_URL'] = 'https://example.com/billing';
process.env['CHAPA_TIMEOUT_MS'] = '5000';
process.env['TICKET_VENDOR_TIMEOUT_MS'] = '5000';
process.env['CORS_ALLOWED_ORIGINS'] = 'http://localhost:5173';
process.env['SEED_SYSTEM_ADMIN_EMAIL'] = 'system@adwa.local';
process.env['SEED_SYSTEM_ADMIN_PASSWORD'] = 'Admin1234!';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setupEnv.ts'],
    fileParallelism: false,
  },
});
