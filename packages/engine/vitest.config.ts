import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'lcov'],
      // CLAUDE.md §5 asks for 95% of lines; D-196 extends the gate to statements and branches and
      // asks for every function to be called: a formula nobody tests cannot ship (CICD-14).
      thresholds: { statements: 95, lines: 95, branches: 95, functions: 100 },
    },
  },
});
