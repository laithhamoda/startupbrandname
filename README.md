# Startup Brand Name

Arabic-first platform at startupbrandname.com: a business model diagnostic that produces a numbers-backed analysis and report.

- Project rules: [CLAUDE.md](CLAUDE.md), then the functional spec [docs/SPEC.md](docs/SPEC.md) with
  the decisions that changed it in [docs/SPEC-CHANGES.md](docs/SPEC-CHANGES.md)
- How it is built: [docs/architecture.md](docs/architecture.md)
- How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md); how to test: [docs/TESTING.md](docs/TESTING.md)
- Decisions log: [docs/DECISIONS.md](docs/DECISIONS.md); open questions:
  [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md)
- Running it: [operations](docs/runbooks/operations.md) (releases, rollback, kill switches,
  variables), [sign-in setup](docs/runbooks/auth-setup.md), [launch and SEO](docs/runbooks/launch-seo.md)
- Privacy and security: [processing register](docs/privacy/processing-register.md),
  [breach response](docs/runbooks/breach-response.md), [data requests](docs/runbooks/data-requests.md),
  [M9 checklist](docs/security/m9-checklist.md)

## Requirements

- Linux: on Windows, work only in the WSL2 (Ubuntu) clone at `~/code/startupbrandname` (D-048).
  The old Windows copy is retired and out of date.
- Node.js 24 (`.nvmrc`) and pnpm, whose version `package.json` pins through Corepack.
- Git.
- Docker, only for the local Supabase stack.

## First run

```bash
corepack enable
pnpm install
pnpm db:start
```

`pnpm db:start` prints the local API URL and publishable key. Copy `.env.example` to
`apps/web/.env.local` and fill in those two values; the rest of the file already suits local work,
including `AI_PROVIDER=fake`, which never calls the paid API. Then:

```bash
pnpm dev
```

The app runs at http://localhost:3000. Before the first end-to-end run, download Playwright's
Chromium: `pnpm --filter @sbn/web exec playwright install chromium`.

## Scripts

| Command                                | What it does                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                             | The web app in development mode, port 3000                                                             |
| `pnpm verify`                          | The main steps of the `checks` and `db` CI jobs, in order; needs the local stack, wipes its data       |
| `pnpm format` / `format:check`         | Prettier: write, or check only                                                                         |
| `pnpm lint`                            | ESLint with zero warnings, and the check that rejects `left`/`right` styling                           |
| `pnpm typecheck`                       | TypeScript in every package                                                                            |
| `pnpm test`                            | Unit tests in all packages; line coverage gates in engine, question bank, AI (95%) and web app (D-164) |
| `pnpm build`                           | Production build of the web app                                                                        |
| `pnpm check:bundle`                    | After a build: fails if secret key material appears in client-reachable output                         |
| `node scripts/check-bundle-budget.mjs` | After a build: fails a route that sends more JavaScript than its budget (D-171)                        |
| `pnpm test:e2e`                        | Builds, then runs the Playwright **site** project: pages, accessibility, RTL and LTR (no database)     |
| `pnpm test:e2e:auth`                   | Builds, then runs the **auth** project against the local stack, with the settings of the e2e-auth job  |
| `pnpm db:start` / `db:stop`            | Local Supabase in Docker                                                                               |
| `pnpm db:reset`                        | Recreate the local database from `supabase/migrations`                                                 |
| `pnpm db:test`                         | pgTAP tests in `supabase/tests` (includes the RLS guard)                                               |
| `pnpm db:lint`                         | Lint database functions                                                                                |
| `pnpm db:types`                        | Regenerate `apps/web/src/lib/supabase/database.types.ts` from the local database                       |
| `pnpm --filter @sbn/web og:images`     | After a build: rewrite the share images in `apps/web/public/og`                                        |
| `pnpm --filter @sbn/web lighthouse`    | After an indexable production build: Lighthouse on every public page ([TESTING.md](docs/TESTING.md))   |

## Debugging

- **Database:** Supabase Studio at http://127.0.0.1:54323 (tables, SQL editor, auth users).
- **Sign-in codes:** Mailpit at http://127.0.0.1:54324.
- **Components:** `/ar/design` and `/en/design` (local and preview only).
- **Server code:** VS Code → Run and Debug → "Next.js: debug server-side" starts `next dev` with the
  inspector (`.vscode/launch.json`). The workspace recommends its extensions.
- **End-to-end failures:** Playwright keeps a trace for each failed test; open it with
  `pnpm --filter @sbn/web exec playwright show-trace <path from the output>`. In CI, download the
  `playwright-report` artifact.
- **Hosted:** `GET /api/health` (below); Vercel → Logs for server errors, written as JSON lines by
  `apps/web/src/lib/log.ts` (event names and error codes only, never answers or email addresses;
  `LOG_LEVEL` sets the lowest level written, D-126); Supabase → Logs for auth and database.

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
  the country and the project question first (D-086); accounts without answers wait at
  `/onboarding` and are purged after 24 hours (D-065, D-079).
- Locally, codes land in Mailpit at http://127.0.0.1:54324 (started by `pnpm db:start`).
- After a migration, run `pnpm db:types` and commit `apps/web/src/lib/supabase/database.types.ts`;
  CI fails when it is out of date.
- Sign-in tests need the local stack: `pnpm test:e2e:auth`. `pnpm test:e2e` runs the rest.
- Hosted setup (email, templates, Google, redirect URLs): [docs/runbooks/auth-setup.md](docs/runbooks/auth-setup.md).

## Public site (M2b)

- Seven public pages in both languages: home, `/how-it-works`, `/methodology`, `/pricing`,
  `/glossary`, `/faq`, `/about` (D-091). The list lives in `apps/web/src/config/public-pages.ts` and
  feeds the sitemap, `llms.txt`, the share images and the Lighthouse check.
- Page text: `apps/web/src/content/` (D-095). Plans and prices: `apps/web/src/config/plans.ts`,
  pinned to CLAUDE.md §3 by tests.
- Share images: `apps/web/public/og/{ar,en}/*.png`. After changing a page title, build and run
  `pnpm --filter @sbn/web og:images` (D-096).
- Lighthouse (SEO and accessibility must be 100, D-097):
  `VERCEL_ENV=production SITE_INDEXABLE=true pnpm --filter @sbn/web build`, then
  `pnpm --filter @sbn/web lighthouse`. Needs Chrome (or `CHROME_PATH`) and openssl.
- Launch steps (indexing, Search Console, Bing, analytics):
  [docs/runbooks/launch-seo.md](docs/runbooks/launch-seo.md).

## Question bank (M3)

- `packages/question-bank`: the 64 questions and their follow-ups in Arabic and English, the
  answer shapes (zod), rules R1–R8, completeness and gating, and validation tasks. Pure code with
  no I/O; `pnpm --filter @sbn/question-bank test` keeps its line coverage at or above 95%.
- Answers are stored in `answers` with their provenance; projects are created only through
  `create_project()`, which enforces the plan's project limit (D-109). Completeness and tasks are
  computed from the answers, never stored (D-113).
- The diagnostic (M3b): `/[locale]/projects`, `/projects/new`, `/projects/{id}` (overview) and
  `/projects/{id}/q/{step}` (one question at a time, D-117). Review the components without an
  account at `/ar/design/diagnostic` (local and preview only, D-118).

## AI in the diagnostic (M3c)

- `packages/ai`: the Anthropic client, the review prompt, de-identification with numbered
  placeholders (`deidentify.ts`, D-148, D-149), the price schema and input hashing. Server-only;
  the client bundle scan fails the build if it leaks.
- Typed answers are reviewed by Claude Haiku only for users whose cross-border consent is current,
  that is, given to a text version listed in `consent.crossborder.accepted_versions` (D-103,
  D-147), within 40 calls per user per day and 5 USD per day overall (D-120, in `settings`).
  Dialect or mixed answers ask the founder to confirm «فهمت أن…» before the MSA version is saved;
  the typed text stays in `raw_text` (D-119).
- Each call is reserved with `reserve_ai_run()` and, when it returns, recorded in `tool_runs` with
  `record_ai_run()`, which computes its cost in the database. The day's spend, calls cut off or
  not recorded included, is in `private.ai_spend_daily` (D-146). One save spends at most 8 seconds
  on AI review; when they run out, the answer gets the fixed checks only (D-150). The whole path
  is in [architecture](docs/architecture.md#4-runtime-view-saving-an-answer).
- `ANTHROPIC_API_KEY` goes in Vercel as a Sensitive variable (Production and Preview). Without it,
  or with `AI_PROVIDER=off`, the diagnostic uses the fixed checks only. Locally and in CI,
  `AI_PROVIDER=fake` stands in for the model (D-123). The model and its price live in `settings`
  (D-122); changing them before M7 is a migration ([operations](docs/runbooks/operations.md)).

## Environments

| Environment | App                                    | Database                                     |
| ----------- | -------------------------------------- | -------------------------------------------- |
| Local       | `next dev`                             | Supabase in Docker                           |
| Preview     | Vercel Preview, functions in `fra1`    | Supabase staging, `eu-central-1` (Frankfurt) |
| Production  | Vercel Production, functions in `fra1` | Supabase prod, `eu-central-1` (Frankfurt)    |

Variables per environment and the settings keys: [operations](docs/runbooks/operations.md#variables).

`GET /api/health` returns `{ status, region, ai, supabase: { reachable, latency_ms, reason } }`;
`ai` is `on` or `off`, never why (D-152).
When Supabase is unreachable, `reason` is `http_<status>` (for example `http_401`: the key does not
belong to the project at `NEXT_PUBLIC_SUPABASE_URL`), `timeout` or `network`.
In production `region` must be `fra1`.

## Database migrations

1. Create one with `pnpm supabase migration new <name>`; then `pnpm db:reset`, `pnpm db:test` and
   `pnpm db:types` (checklist in [CONTRIBUTING.md](CONTRIBUTING.md#a-migration)).
2. CI applies every migration to an empty database and runs the pgTAP tests. Any table in
   `public` without row level security fails the build.
3. Merging to `main` pushes new migrations to staging (`DB deploy` workflow).
4. Production: the owner runs `DB deploy` from `main` with target `production` (and the
   confirmation the form asks for), then approves the `db-production` environment.

Vercel deploys `main` at once, so the app runs on the old schema until production is migrated. A
migration therefore only adds, the app keeps working without it (the feature stays off), and drops
or renames come in a later pull request. Never edit a merged migration. The full order, rollback
and kill switches: [docs/runbooks/operations.md](docs/runbooks/operations.md).

## Contributing

`main` accepts changes only through pull requests whose six CI jobs are green. Commits are
Conventional Commits, checked by a commit-msg hook; pre-commit formats and lints staged files, and
pre-push runs the typecheck and tests. A form's Server Action returns a typed result and throws
only for invariants. The rest, with a checklist per kind of change: [CONTRIBUTING.md](CONTRIBUTING.md).
