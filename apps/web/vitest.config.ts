import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside a React Server Components build; tests run in plain Node.
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // The app's own logic (CICD-7). Left out: the Supabase client factories and the generated
      // database types, which only wire a library, and the Server Action files, which the
      // end-to-end tests drive through the pages.
      include: ['src/lib/**/*.ts', 'src/config/**/*.ts', 'src/seo/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.ts',
        'src/lib/supabase/server.ts',
        'src/lib/supabase/proxy.ts',
        'src/lib/supabase/database.types.ts',
        'src/lib/**/actions.ts',
      ],
      reporter: ['text', 'lcov'],
      // The coverage measured when the gate was added, rounded down (D-164). Raise it as tests are
      // added; never lower it to make a change pass.
      thresholds: { lines: 89, statements: 88, functions: 85, branches: 81 },
    },
  },
});
