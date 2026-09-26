import { defineConfig, devices } from '@playwright/test';

const PORT = '3100';
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Baselines come from the pinned Playwright container in CI, so no per-platform suffix (D-055).
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled' },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'ar-JO',
    trace: 'retain-on-failure',
  },
  projects: [
    // Pages, accessibility and snapshots: no database needed.
    { name: 'site', testIgnore: /auth\//, use: { ...devices['Desktop Chrome'] } },
    // Sign-in flows: need the local Supabase stack (`pnpm db:start`) and its Mailpit inbox.
    { name: 'auth', testMatch: /auth\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
