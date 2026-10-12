import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Left out: the files that need a running browser (the page and the PDF reader). The
      // Playwright specs in apps/web/e2e/pdf render real PDFs with them in CI (D-237, D-241); the
      // unit tests cover everything that does not.
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/render/pdf.ts',
        'src/testing/index.ts',
        'src/testing/pdf-inspect.ts',
        // Test support for the report model (D-272): inputs built from the golden projects, a
        // plain-text reading of a model and small helpers. Tests import them, the application never.
        'src/testing/report-inputs.ts',
        'src/testing/model-text.ts',
        'src/testing/model-helpers.ts',
      ],
      reporter: ['text', 'lcov'],
      // D-237.
      thresholds: { statements: 95, lines: 95, branches: 90, functions: 95 },
    },
  },
});
