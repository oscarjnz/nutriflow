import { defineConfig, devices } from '@playwright/test';

/**
 * E2E skeleton. Browsers are not installed by default — run
 * `pnpm exec playwright install chromium` before the first `pnpm test:e2e`.
 *
 * The dev server is started automatically and must have a valid `.env.local`
 * (Clerk + Supabase). Authenticated flows are deferred to a later sprint; the
 * current smoke test only asserts the public redirect behavior.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
