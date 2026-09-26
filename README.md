# Startup Brand Name

Arabic-first platform at startupbrandname.com: a business model diagnostic that produces a numbers-backed analysis and report.

- Project rules: [CLAUDE.md](CLAUDE.md)
- Functional spec: [docs/SPEC.md](docs/SPEC.md)
- Decisions log: [docs/DECISIONS.md](docs/DECISIONS.md)
- Open questions: [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md)

## Requirements

- Node.js 24 LTS and pnpm (the version is pinned in `package.json`). On Windows, work inside WSL2 (Ubuntu); see D-048
- Git
- Docker Desktop, only for the local Supabase stack

## First run

```bash
pnpm install
pnpm db:start
```

`pnpm db:start` prints the local API URL and publishable key. Copy `.env.example` to
`apps/web/.env.local`, fill in those two values, then start the app:

```bash
pnpm --filter @sbn/web dev
```

Before the first `pnpm test:e2e`, download Playwright's Chromium:

```bash
pnpm --filter @sbn/web exec playwright install chromium
```

**Windows:** Smart App Control blocks unsigned native binaries. This repo avoids tools that
ship them (see D-031 in `docs/DECISIONS.md`); check that list before adding a CLI dependency.

## Scripts

| Command                     | What it does                                                          |
| --------------------------- | --------------------------------------------------------------------- |
| `pnpm lint`                 | ESLint, zero warnings allowed                                         |
| `pnpm typecheck`            | TypeScript in every package                                           |
| `pnpm test`                 | Unit tests (engine enforces ≥ 95% line coverage)                      |
| `pnpm build`                | Production build of the web app                                       |
| `pnpm test:e2e`             | Builds the web app, then runs the Playwright smoke test               |
| `pnpm check:bundle`         | Fails if secret key material appears in client-reachable build output |
| `pnpm format`               | Prettier                                                              |
| `pnpm db:start` / `db:stop` | Local Supabase in Docker                                              |
| `pnpm db:reset`             | Recreate the local database from `supabase/migrations`                |
| `pnpm db:test`              | pgTAP tests in `supabase/tests` (includes the RLS guard)              |
| `pnpm db:lint`              | Lint database functions                                               |

## Design system (M1)

- Tokens: `apps/web/src/styles/tokens.css`. Colour contrast is tested in
  `apps/web/src/styles/contrast.test.ts`; a colour change that breaks WCAG 2.2 AA fails the build.
- Components: `apps/web/src/components/ui/`. Browse them at `/ar/design` and `/en/design`
  (local and preview only).
- Styling uses logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`);
  `pnpm lint` rejects `left`/`right` utilities. The same layout then serves Arabic (RTL) and
  English (LTR).
- Visual snapshots (both languages) run in CI only. After an intended visual change, run the
  "Update RTL snapshots" workflow, download its artifact and commit it under
  `apps/web/e2e/__screenshots__`.

## Languages

- Arabic at `/ar/…` (default) and English at `/en/…`; `/` redirects to the saved or browser
  language (D-067, D-070). Routing lives in `apps/web/src/i18n/`, the proxy in `apps/web/src/proxy.ts`.
- Interface text: `apps/web/messages/ar.json` and `en.json`. Arabic is the reference: a key missing
  from English fails the typecheck, and `messages.test.ts` rejects extra keys, empty strings and
  mismatched `{placeholders}`.
- Server Components read the language with `currentLocale()` or `getTranslations()`. Server
  Actions and Route Handlers cannot, so they receive the locale explicitly.
- Search indexing stays off until public launch: set `SITE_INDEXABLE=true` on the Vercel
  Production environment to turn it on.

## Sign-in (M2)

- Email code or Google, through Supabase Auth, called from the server only (D-077). Signup asks
  the two declarations first; accounts without them wait at `/onboarding` and are purged after
  24 hours (D-065, D-079).
- Locally, codes land in Mailpit at http://127.0.0.1:54324 (started by `pnpm db:start`).
- After a migration, run `pnpm db:types` and commit `apps/web/src/lib/supabase/database.types.ts`;
  CI fails when it is out of date.
- Sign-in tests need the local stack:
  `pnpm --filter @sbn/web exec playwright test --project=auth`. The other tests run with
  `--project=site`.
- Hosted setup (email, templates, Google, redirect URLs): [docs/runbooks/auth-setup.md](docs/runbooks/auth-setup.md).

## Environments

| Environment | App                                    | Database                                     |
| ----------- | -------------------------------------- | -------------------------------------------- |
| Local       | `next dev`                             | Supabase in Docker                           |
| Preview     | Vercel Preview, functions in `fra1`    | Supabase staging, `eu-central-1` (Frankfurt) |
| Production  | Vercel Production, functions in `fra1` | Supabase prod, `eu-central-1` (Frankfurt)    |

`GET /api/health` returns `{ status, region, supabase: { reachable, latency_ms, reason } }`.
When Supabase is unreachable, `reason` is `http_<status>` (for example `http_401`: the key does not
belong to the project at `NEXT_PUBLIC_SUPABASE_URL`), `timeout` or `network`.
In production `region` must be `fra1`.

## Database migrations

1. Create one with `pnpm supabase migration new <name>`.
2. CI applies every migration to an empty database and runs the pgTAP tests. Any table in
   `public` without row level security fails the build.
3. Merging to `main` pushes new migrations to staging (`DB deploy` workflow).
4. Production: run the `DB deploy` workflow manually with target `production`; it waits for
   the typed confirmation `migrate production` (required reviewers need GitHub Enterprise on private repos).

The app and the database deploy independently, so every migration must be backward-compatible:
add first, migrate data, remove in a later release.

## Commits

Conventional messages (`feat:`, `fix:`, `test:`, `chore:`, `ci:`, `docs:`), enforced by a
commit-msg hook. Pre-push runs typecheck and tests.
