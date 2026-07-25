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

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
