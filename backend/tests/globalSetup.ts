import { execSync } from 'node:child_process';

const TEST_DATABASE_URL = 'postgresql://adwa:adwa@db-test:5432/adwa_test';

/**
 * Apply migrations to db-test once before the suite.
 * Must force DATABASE_URL — the api container's compose env points at `db`.
 */
export default async function globalSetup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
    },
  });
}
