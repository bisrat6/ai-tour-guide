import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    restoreMocks: true,
    unstubGlobals: true,
    // Exercises the live-API path; without a base URL the client refuses to build a request.
    env: { VITE_API_BASE_URL: 'https://api.test' },
  },
})
