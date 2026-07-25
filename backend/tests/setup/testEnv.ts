/**
 * Runs before every Vitest file. Swaps TEST_DATABASE_URL into DATABASE_URL
 * so integration tests hit a throwaway database (§17.1) — never the
 * developer's working DATABASE_URL, which they truncate between tests.
 *
 * Must stay free of any import that eventually loads src/config/env.ts,
 * because that module validates and freezes process.env on first import.
 */
import { config } from 'dotenv';

config({ quiet: true });

process.env.NODE_ENV = 'test';

// Refuse to run rather than truncate the database someone is developing
// against. resetDatabase() issues TRUNCATE ... CASCADE across every table
// between tests, so pointing both variables at one database silently destroys
// seeded content — and the mistake is invisible until the data is already gone.
if (
  process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL &&
  process.env.TEST_DATABASE_URL === process.env.DATABASE_URL
) {
  throw new Error(
    'TEST_DATABASE_URL and DATABASE_URL point at the same database. ' +
      'Integration tests TRUNCATE every table between tests, which would wipe it. ' +
      'Point TEST_DATABASE_URL at a separate, throwaway database (see .env.example).',
  );
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
