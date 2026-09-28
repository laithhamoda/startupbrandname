# Contributing

How changes reach `main`, and short checklists for the changes that touch many files. Read
[CLAUDE.md](CLAUDE.md) first: its rules win over everything here. How the parts fit together:
[docs/architecture.md](docs/architecture.md). How to test: [docs/TESTING.md](docs/TESTING.md).

## Where to work

- Only in the WSL2 clone at `~/code/startupbrandname` (D-048). Start Claude Code and VS Code from
  there (`code .` inside WSL opens it through Remote WSL). The Windows copy `C:\dev\vivarise-bms`
  is retired: its `CLAUDE.md` and code are out of date.
- First run: `corepack enable` (pnpm then follows `packageManager` in `package.json`),
  `pnpm install`, `pnpm db:start`, and `apps/web/.env.local` copied from `.env.example` with the
  local URL and publishable key that `pnpm db:start` prints. See the README.

## Pull requests

- Branch from `main`. `main` accepts changes only through pull requests whose six CI jobs are
  green: Lint, typecheck, unit tests, build · E2E, accessibility and RTL snapshots (Chromium) ·
  Lighthouse, public pages (SEO and accessibility 100) · E2E sign-in flows (local Supabase) ·
  Migrations and RLS checks · Secret scan.
- One milestone at a time, with a plan approved first (CLAUDE.md §8). No scope creep.
- Small commits in Conventional Commits form (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`,
  `ci`, `perf`, optional scope), checked by commitlint: lower-case subject, body lines of at most
  100 characters, explaining why. Hooks format, lint and test; never skip them with `--no-verify`.
- Fill in the pull request template. `pnpm verify` runs the `checks` and `db` jobs locally.

## Releases and migrations

The app and the database deploy separately: Vercel deploys `main` to production at once, while
production migrations run only from `main`, after the owner approves the `DB deploy` run on
GitHub. So:

- A migration only adds (expand). Drops, renames and changed function signatures go in a later
  pull request (contract), after production has been migrated and no deployed code uses the old
  object.
- App code must keep working on the previous schema until production is migrated: when a table,
  column or function it needs is missing, the feature stays off (fail closed).
- Never edit a merged migration. Fix forward with a new one.

The full order, rollback and kill switches: [docs/runbooks/operations.md](docs/runbooks/operations.md).

## Code conventions

- TypeScript `strict`; zod at every server boundary (rule 7). Server-only modules import
  `server-only`.
- **Server Actions.** A form action returns a typed result, a union keyed by `status` (for
  example `SaveResult` in `apps/web/src/lib/diagnostic/actions.ts`), for everything a visitor can
  cause: invalid input, a rule that rejects an answer, a limit, a failed write. It throws only for
  invariants, states that can only mean a bug. Every action parses its input with zod and receives
  the locale explicitly (Server Actions cannot read `[locale]`).
- Styling: design tokens and logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`,
  `end-`); `pnpm lint` rejects `left`/`right` (D-056). Western digits isolated in `<bdi>`, currency
  after the number.
- No legal, tax or regulatory value in code (rule 8), no invented fact (rule 9), no number from
  the model in a report (rule 1).
- Comments say why, and cite the decision (`D-123`) or rule they implement.

## Checklists

### A new environment variable

- [ ] Server variable: add it to `apps/web/src/env/server.ts` with a comment; flags use
      `booleanFlag` (exactly `"true"` or `"false"`). Browser variable: `NEXT_PUBLIC_` only, in
      `apps/web/src/env/client.ts`; it is inlined at build time.
- [ ] Tests in `apps/web/src/env/env.test.ts` for its default and its invalid values.
- [ ] `.env.example`, in the right section, with a comment and a safe local value.
- [ ] A secret: add its name to `SERVER_ONLY_VARS` in `scripts/scan-client-bundle.mjs`.
- [ ] CI: add it to the job in `.github/workflows/ci.yml` that needs it.
- [ ] Vercel: set it for Production and Preview (Sensitive for secrets). A change applies to the
      next deployment only.
- [ ] The variable table in `docs/runbooks/operations.md`.

### A question, option or follow-up

- [ ] Edit `packages/question-bank/src/questions/<axis>.ts` (or `follow-ups.ts`), in Arabic and
      English (D-106). Core IDs `A1`–`H8` are fixed; follow-ups are `F6.1` (URL `F6-1`, D-117),
      matching the check on `answers.question_id`.
- [ ] Stored answers keep working. An answer whose stored value no longer fits its field counts
      as missing (`parseAnswers` in `apps/web/src/lib/diagnostic/project.ts`): the founder loses it
      without a message. Renaming an option `value` or changing a field kind needs either a
      read-time mapping in the question bank or a migration that rewrites
      `answers.normalized_value`, plus a test with an answer in the old shape. Labels may change
      freely.
- [ ] `pnpm --filter @sbn/question-bank test` (coverage ≥ 95%); completeness weights stay as in
      D-102 and D-105.
- [ ] A change to SPEC behaviour: a decision, and a row in `docs/SPEC-CHANGES.md`.

### A settings key

- [ ] Key matches `^[a-z0-9_.]{1,80}$`; value inserted or updated by a new migration with a comment
      giving its source (prices carry `source_url` and `checked_at`, D-122).
- [ ] A pgTAP assertion of the value in `supabase/tests`.
- [ ] The app reads it with zod and fails closed when it is missing or invalid (as
      `readSettings` in `apps/web/src/lib/ai/service.ts` does).
- [ ] Entitlement values also match `apps/web/src/config/plans.ts` (`plans.test.ts` reads the
      migration).
- [ ] The settings table in `docs/runbooks/operations.md`.

### A migration

- [ ] `pnpm supabase migration new <name>`; a header comment naming the decisions it implements.
- [ ] Expand only (see [Releases and migrations](#releases-and-migrations)); the app in the same
      pull request works on the previous schema.
- [ ] Every new table: RLS enabled, `revoke all` from `anon` and `authenticated`, then only the
      grants and policies it needs, with `(select auth.uid())`.
- [ ] Every `security definer` function: `set search_path = ''`, checks `auth.uid()`, execute
      revoked from `public` and `anon`, granted to `authenticated` only.
- [ ] A table or column that holds a user's data: add it to the export in
      `docs/runbooks/data-requests.md` and to `docs/privacy/processing-register.md`.
- [ ] pgTAP tests; `pnpm db:reset`, `pnpm db:test`, `pnpm db:lint`.
- [ ] `pnpm db:types` and commit `apps/web/src/lib/supabase/database.types.ts`.
- [ ] After merge: staging migrates by itself; production follows the release order in
      `docs/runbooks/operations.md`.

### A UI string

- [ ] `apps/web/messages/ar.json` first (Modern Standard Arabic, the reference), then the same key
      in `en.json`, with the same `{placeholders}`. A technical term gets its English in
      parentheses on first occurrence only (CLAUDE.md §3).
- [ ] No text hard-coded in components. Public page bodies live in `apps/web/src/content` (D-095).
- [ ] `pnpm --filter @sbn/web test` (`messages.test.ts`) and `pnpm typecheck`.

### A visual change

- [ ] Tokens only (`apps/web/src/styles/tokens.css`; `contrast.test.ts` guards WCAG AA).
- [ ] Checked at `/ar/design` and `/en/design`, at 360px, in both themes, with the keyboard.
- [ ] Snapshots regenerated by the "Update RTL snapshots" workflow, reviewed and committed; never
      from a local run (D-055). Share images too when a page title changed (D-096).

### A decision or an open question

- [ ] New decisions go at the end of `docs/DECISIONS.md` with the next free ID, the date, the
      decision and the reason. Merged rows are never reworded or reordered: a new entry amends or
      supersedes them.
- [ ] A resolved open question is marked in `docs/OPEN-QUESTIONS.md` with its decision ID;
      numbers never change.
- [ ] `CLAUDE.md` and `docs/SPEC.md` change only with the owner's explicit approval. Where a
      decision departs from the SPEC, add a row to `docs/SPEC-CHANGES.md`.

### A dependency

- [ ] Exact version (`.npmrc` has `save-exact`); dev tools go in the root `package.json` (D-024).
- [ ] No install scripts (D-033).
- [ ] A new tool or major version: a decision with the reason.
