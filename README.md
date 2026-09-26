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
