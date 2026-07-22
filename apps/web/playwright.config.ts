import { defineConfig, devices } from '@playwright/test'

/**
 * E2E suite for the signup flow — a separate task from the default
 * `pnpm turbo run test`, since it needs a live web + api stack (plus a
 * throwaway Postgres) rather than running standalone. See `e2e/README.md`
 * for how to stand that stack up locally.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:4000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
