import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Must run before any app module imports env.ts / prisma.ts (§17.1).
    setupFiles: ['tests/setup/testEnv.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
