import { defineConfig, devices } from '@playwright/test';

const PORT = '3100';
const isCI = Boolean(process.env.CI);

// `pnpm test:e2e:auth` starts the server with the settings the e2e-auth CI job sets (ci.yml): the
// Google button without asking Supabase, whose local stack has no Google credentials (D-089), and
// the AI stand-in, so no test needs a key or costs anything (D-123). CI passes them itself.
const authRun = process.env.npm_lifecycle_event === 'test:e2e:auth';
const AUTH_SERVER_ENV = {
  AUTH_GOOGLE_ENABLED: 'true',
  AUTH_GOOGLE_VERIFY_PROVIDER: 'false',
  AI_PROVIDER: 'fake',
};

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // A test that passes only when retried fails the run (CICD-8): the retry shows what went wrong
  // in the trace, and the flake is fixed rather than hidden.
  failOnFlakyTests: isCI,
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
    // Pages, accessibility and snapshots: no database needed (`pnpm test:e2e`).
    { name: 'site', testIgnore: /auth\//, use: { ...devices['Desktop Chrome'] } },
    // Sign-in flows: need the local Supabase stack (`pnpm db:start`) and its Mailpit inbox
    // (`pnpm test:e2e:auth`).
    { name: 'auth', testMatch: /auth\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    // Share images: writes public/og (`pnpm og:images`), run on demand only.
    { name: 'og', testMatch: /og-images\.gen\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    // A server already running on the port was started without the sign-in settings.
    reuseExistingServer: !isCI && !authRun,
    timeout: 120_000,
    ...(authRun ? { env: AUTH_SERVER_ENV } : {}),
  },
});
