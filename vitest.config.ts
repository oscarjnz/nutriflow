import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/nutrition/**', 'src/lib/validation/**', 'src/lib/crypto/hash.ts'],
      thresholds: {
        // The deterministic nutrition core must stay fully covered (CLAUDE.md §5).
        'src/lib/nutrition/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
