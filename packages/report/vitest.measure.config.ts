import { defineConfig } from 'vitest/config';

// Only for `pnpm --filter @sbn/report run pdf:measure` (scripts/measure.ts): it is not a test and
// never runs with the unit tests.
export default defineConfig({
  test: {
    include: ['scripts/measure.ts'],
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
});
