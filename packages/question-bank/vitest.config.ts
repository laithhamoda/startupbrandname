import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'lcov'],
      // The rules decide what founders may save: keep them fully exercised (M3 definition of done).
      thresholds: { lines: 95 },
    },
  },
});
