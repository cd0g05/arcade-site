import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Two environments in one run: lib/ and route tests need real node (they talk to a
    // live Postgres), while admin component tests need a DOM. Component test files opt in
    // per-file with an `@vitest-environment jsdom` docblock rather than splitting configs.
    environment: 'node',
    // Loads .env.local before any test module imports lib/db/client.ts, which
    // throws at import time without DATABASE_URL.
    setupFiles: ['./lib/load-env.ts', './lib/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
