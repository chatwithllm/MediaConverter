import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@tpd/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@tpd/backend/clients/tdarr.js': resolve(__dirname, '../backend/src/clients/tdarr.ts'),
      '@tpd/backend/clients/tdarr': resolve(__dirname, '../backend/src/clients/tdarr.ts'),
      '@tpd/backend/config-store.js': resolve(__dirname, '../backend/src/config-store.ts'),
      '@tpd/backend/config-store': resolve(__dirname, '../backend/src/config-store.ts'),
      '@tpd/backend': resolve(__dirname, '../backend/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
