# Testing

What protects what, where it runs, and how to run it locally. `main` only accepts pull requests
whose six CI jobs are green (`.github/workflows/ci.yml`); every row below names its job.

## Risk, level, job and command

| Risk                                                                | Level                                            | CI job (name in GitHub)                            | Local command                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A formula gives a wrong number (rule 1)                             | Unit, line coverage ≥ 95%                        | `checks` (Lint, typecheck, unit tests, build)      | `pnpm --filter @sbn/engine test`                                                         |
| A question, rule, follow-up, completeness or stored shape is wrong  | Unit, line coverage ≥ 95%, contract test (D-165) | `checks`                                           | `pnpm --filter @sbn/question-bank test`                                                  |
| Personal data reaches the model; a cost or input hash is wrong      | Unit, line coverage ≥ 95%                        | `checks`                                           | `pnpm --filter @sbn/ai test`                                                             |
| App logic: env parsing, plans pinned to CLAUDE.md §3, SEO, contrast | Unit, coverage at the measured level (D-164)     | `checks`                                           | `pnpm --filter @sbn/web test`                                                            |
| A message key is missing or not sent, or placeholders differ        | Unit (`src/i18n/*messages.test.ts`), typecheck   | `checks`                                           | `pnpm --filter @sbn/web test`, `pnpm typecheck`                                          |
| Type errors                                                         | Static                                           | `checks`                                           | `pnpm typecheck`                                                                         |
| Lint, accessibility lint, physical `left`/`right` styling (D-056)   | Static                                           | `checks`                                           | `pnpm lint`                                                                              |
| Unformatted files                                                   | Static                                           | `checks`                                           | `pnpm format:check`                                                                      |
| The production build fails                                          | Build                                            | `checks`                                           | `pnpm build`                                                                             |
| A secret reaches the browser (rule 7)                               | Build output scan                                | `checks`                                           | `pnpm check:bundle` (after `pnpm build`)                                                 |
| A route ships more JavaScript than its budget (D-171)               | Build output, gzipped per route                  | `checks`                                           | `node scripts/check-bundle-budget.mjs` (after `pnpm build`)                              |
| A table without RLS, a wrong policy, a database function misbehaves | pgTAP (`supabase/tests`)                         | `db` (Migrations and RLS checks)                   | `pnpm db:test`                                                                           |
| An unsafe or broken database function                               | Database lint                                    | `db`                                               | `pnpm db:lint`                                                                           |
| A page breaks, loses RTL/LTR, keyboard access or WCAG 2.2 AA (axe)  | End to end, site project                         | `e2e-smoke` (E2E, accessibility and RTL snapshots) | `pnpm test:e2e`                                                                          |
| A visual regression in Arabic or English, light or dark             | Screenshots, CI container only (D-055)           | `e2e-smoke`                                        | none: see [Snapshots](#snapshots)                                                        |
| Sign-up, the onboarding gate, the diagnostic or the account breaks  | End to end, auth project, local Supabase         | `e2e-auth` (E2E sign-in flows)                     | `pnpm test:e2e:auth`                                                                     |
| `database.types.ts` no longer matches the migrations                | Generated-file diff                              | `e2e-auth`                                         | `pnpm db:types`, then `git diff --exit-code apps/web/src/lib/supabase/database.types.ts` |
| A public page drops below SEO or accessibility 100 (D-097)          | Lighthouse                                       | `lighthouse`                                       | see [Lighthouse](#lighthouse)                                                            |
| A public page shifts on load, or exceeds its script or font bytes   | Lighthouse budget (D-171)                        | `lighthouse`                                       | see [Lighthouse](#lighthouse)                                                            |
| A secret is committed                                               | gitleaks over the full history (D-040)           | `secret-scan`                                      | none (CI only)                                                                           |
| A commit message is not conventional                                | commitlint                                       | none (local `commit-msg` hook)                     | runs on every commit                                                                     |

`pnpm verify` runs the main steps of the `checks` and `db` jobs, in order. Like the `db` job, it
lints and tests a database built from every migration: `pnpm db:reset` comes first, which wipes
the local data. It needs the local stack (`pnpm db:start`) for those last three steps. It leaves
out four steps those jobs also run: `node scripts/check-playwright-version.mjs`,
`pnpm exec vitest run --dir scripts` (the tests of the CI scripts),
`node scripts/check-bundle-budget.mjs` after the build, and
`node scripts/check-migrations.mjs origin/main`. The end-to-end, Lighthouse and secret-scan jobs
are separate.

## Git hooks (lefthook)

- pre-commit: Prettier and ESLint on the staged files.
- commit-msg: commitlint (Conventional Commits).
- pre-push: `pnpm typecheck && pnpm test`. Kept fast on purpose; `pnpm verify` is opt-in.

## Unit tests

`pnpm test` runs Vitest in every package. `packages/engine`, `packages/question-bank` and
`packages/ai` fail below 95% line coverage (their `vitest.config.ts`); `apps/web` fails below the
coverage measured when its gate was added, raised as tests are added (`apps/web/vitest.config.ts`,
D-164). Engine formulas are written
test-first from the SPEC formulas (CLAUDE.md §8.3). Unit tests never call the real model:
`anthropicClient()` accepts a `fetch` for tests, and `fakeClient()` stands in elsewhere.

## Database tests

```bash
pnpm db:start   # once; Docker must be running
pnpm db:reset   # applies every migration to a fresh local database
pnpm db:test    # pgTAP, supabase/tests/*.test.sql
pnpm db:lint
```

`supabase/tests/rls_guard.test.sql` fails as soon as a table in `public` lacks row level security.
Every new table, policy or function gets a pgTAP test next to the existing ones.

## End-to-end tests

Download Playwright's Chromium once: `pnpm --filter @sbn/web exec playwright install chromium`
(on a fresh WSL install, `--with-deps` also installs the system libraries and asks for sudo).

- `pnpm test:e2e` builds the web app, then runs the **site** project: pages, accessibility in
  both themes, RTL and LTR, keyboard and quality checks. No database needed. Screenshot tests are
  skipped outside CI.
- `pnpm test:e2e:auth` builds the web app, then runs the **auth** project against the local
  stack: sign-up by email code, the onboarding gate, Google hand-over, the account page and the
  diagnostic. Before running it:
  1. `pnpm db:start`, with `apps/web/.env.local` pointing at the local stack (see the README).
  2. Nothing else listening on port 3100: the run starts its own server and refuses to reuse one.

  The script starts the server with the settings the `e2e-auth` job uses: `AUTH_GOOGLE_ENABLED=true`,
  `AUTH_GOOGLE_VERIFY_PROVIDER=false` and `AI_PROVIDER=fake` (`apps/web/playwright.config.ts`).
  Codes are read from Mailpit (`MAILPIT_URL`, default `http://127.0.0.1:54324`). Each test signs
  up with a fresh address (`uniqueEmail`), so runs never share an account.

- The **og** project writes the share images: `pnpm --filter @sbn/web og:images` after a build.
  It overwrites `apps/web/public/og`; commit only images you meant to change.

In CI each test gets one retry, and a test that passes only on its retry fails the run
(`failOnFlakyTests`, D-166): an absence is proven with a barrier, never with a fixed wait. Failed
tests keep a trace (`trace: 'retain-on-failure'`): open it with
`pnpm --filter @sbn/web exec playwright show-trace <path from the output>`. In CI, download the
`playwright-report` or `playwright-report-auth` artifact.

New pages: add public ones to `apps/web/src/config/public-pages.ts` (sitemap, accessibility,
snapshots and Lighthouse follow) and signed-in ones to `apps/web/e2e/auth/a11y.spec.ts`.

## Snapshots

Baselines come only from the pinned Playwright container in CI (D-055); never generate or commit
them from a local run. After an intended visual change:

1. GitHub → Actions → **Update RTL snapshots** → Run workflow, on your branch.
2. Download the `rtl-snapshots` artifact and review every changed image.
3. Commit its `e2e/__screenshots__` folder (and `public/og` when share images changed) under
   `apps/web/`.

## Lighthouse

```bash
VERCEL_ENV=production SITE_INDEXABLE=true pnpm --filter @sbn/web build
pnpm --filter @sbn/web lighthouse
```

It also fails a page whose layout shift reaches 0.1, or that loads more script or font bytes than
`BYTE_BUDGETS` in `apps/web/scripts/lighthouse.mjs` (D-171). Needs Chrome (or `CHROME_PATH`) and
openssl. That build is indexable, and `VERCEL_ENV=production` makes `/design` return 404 (D-058),
so the end-to-end tests would fail against it; `pnpm test:e2e` and `pnpm test:e2e:auth` rebuild
first.
