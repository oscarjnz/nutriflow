import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Coverage is reported for the parts that matter (the deterministic
      // nutrition math + validation), but no hard threshold gates the build.
      // Tests focus on the health-critical calculations, not blanket coverage.
      include: ['src/lib/nutrition/**', 'src/lib/validation/**', 'src/lib/crypto/hash.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
