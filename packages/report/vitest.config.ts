import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Left out: the files that need a running browser (the page, the shared
      // browser, the PDF reader). The Playwright specs in apps/web/e2e/pdf render real
      // PDFs with them in CI (D-237, D-241); the unit tests cover everything that does not.
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/render/pdf.ts',
        'src/render/shared.ts',
        'src/testing/index.ts',
        'src/testing/pdf-inspect.ts',
      ],
      reporter: ['text', 'lcov'],
      // D-237.
      thresholds: { statements: 95, lines: 95, branches: 90, functions: 95 },
    },
  },
});
