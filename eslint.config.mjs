import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/.next/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/next-env.d.ts',
    'supabase/**',
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // Next.js app: Next rules plus the strict accessibility set (CLAUDE.md rule 11).
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [nextVitals],
    // An explicit React version: eslint-plugin-react's "detect" calls an API ESLint 10 removed.
    settings: { react: { version: '19.3' } },
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      // Pages Router rule; this app uses the App Router only.
      '@next/next/no-html-link-for-pages': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ExportNamedDeclaration VariableDeclarator[id.name='runtime'][init.value='edge']",
          message:
            'The edge runtime runs outside fra1. Keep functions on Node.js next to Supabase Frankfurt (CLAUDE.md §3).',
        },
      ],
    },
  },

  // Engine: pure, deterministic calculations only (CLAUDE.md rule 1).
  {
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['packages/engine/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'fs',
                'path',
                'http',
                'https',
                'next',
                'next/*',
                'react',
                'react/*',
                '@supabase/*',
                '@anthropic-ai/*',
              ],
              message: 'The engine is pure: no I/O, framework or network imports.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'fetch',
        'process',
        'window',
        'document',
        'setTimeout',
        'setInterval',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Engine output must be deterministic.' },
        { object: 'Date', property: 'now', message: 'Pass the reference date in as an input.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Pass the reference date in as an input.',
        },
      ],
    },
  },
]);
