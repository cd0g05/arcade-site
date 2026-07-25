import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    // Loads .env.local before any test module imports lib/db/client.ts, which
    // throws at import time without DATABASE_URL.
    setupFiles: ['./lib/load-env.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
