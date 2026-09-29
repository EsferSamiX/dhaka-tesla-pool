import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the main flows, run against a running stack:
 * `docker compose up -d --build`, then `npm test` here. E2E_BASE_URL points
 * them elsewhere (e.g. a preview deploy).
 *
 * Tests run one at a time: new rides auto-join any compatible open pool, so
 * parallel tests could end up sharing a Tesla. Each test also uses its own
 * pickup zone and fresh accounts, and cleans up its trips.
 */
export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // PW_CHANNEL=chrome uses an installed Chrome instead of downloading one.
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL },
    },
  ],
});
