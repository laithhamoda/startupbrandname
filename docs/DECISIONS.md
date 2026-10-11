# Decisions

Every decision not covered by `CLAUDE.md`, with date and reason (CLAUDE.md §7, §8.4).
Unresolved items live in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

## How to read this log

Each row is one decision, with the date it was made and why. Rows are added at the end and never
reworded: a later decision amends or supersedes an earlier one, and the earlier row's Status says
which (D-172). `Active`: in force as written. `Amended by D-xxx`: in force, except for what the
later decision changes; read both. `Superseded by D-xxx`: no longer in force; read the later one
instead. `Done`: a one-time step that was carried out, kept as history. `Open`: decided, but
waiting for a step by the owner or the lead that no later entry records as taken, such as a plan
upgrade, a review or a dashboard setting; the rest of the row is in force. A question left to the
owner is not such a step: it lives in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md), and its row stays
`Active`. Where a row and the code on `main` disagree, the code wins and a new entry says so
(D-174). The SPEC sections that decisions changed are listed in [SPEC-CHANGES.md](SPEC-CHANGES.md).

From M4 on, a new decision is written as a heading and a short list rather than a table row
(D-173), so that adding one no longer re-pads a whole table. When it amends or supersedes an
earlier decision, that decision's Status changes in the same pull request:

```markdown
### D-NNN (YYYY-MM-DD): Short title

- **Decision:** what was decided, naming the files, settings or tables it concerns.
- **Reason:** why, with the rule, finding or owner decision behind it.
- **Status:** Active
```

## Topic index

A decision may sit under several topics. A new decision joins its topics in the same pull request.

- **Product, plans and vouchers:** D-022, D-035, D-037, D-038, D-050, D-060, D-071, D-094, D-109,
  D-174.
- **Auth and accounts:** D-018, D-034, D-059, D-061, D-065, D-074, D-077, D-078, D-079, D-084,
  D-085, D-086, D-087, D-089, D-129, D-131, D-163, D-168, D-174.
- **Markets, countries and languages:** D-026, D-063, D-066, D-067, D-068, D-069, D-070, D-075,
  D-080, D-081, D-088, D-129, D-180, D-186, D-233, D-236.
- **Diagnostic and question bank:** D-072, D-102, D-104, D-105, D-106, D-108, D-110 to D-119, D-129,
  D-149, D-156 to D-161, D-163, D-165, D-167, D-182, D-183, D-197 to D-199, D-231, D-232.
- **Calculation engine:** D-178 to D-190, D-193 to D-196, D-200 to D-224, D-227 to D-230,
  D-238.
- **Report, canvases and PDF (M5):** D-225 to D-238, D-239 to D-241.
- **AI and cost:** D-062, D-071, D-072, D-073, D-082, D-103, D-107, D-119 to D-124, D-143, D-146 to
  D-152, D-155, D-183, D-191, D-226.
- **Privacy, consent and security:** D-013, D-016, D-040, D-041, D-061, D-062, D-074, D-077,
  D-082, D-085, D-092, D-098, D-103, D-107, D-126, D-130, D-137, D-138, D-142, D-144 to D-149,
  D-153, D-154, D-175, D-232, D-234, D-235.
- **Legal:** D-059, D-066, D-068, D-082, D-086, D-137, D-145, D-147, D-154, D-186, D-233.
- **Design and accessibility:** D-007, D-008, D-049 to D-053, D-055 to D-058, D-099, D-118, D-128,
  D-131, D-158, D-159, D-161, D-162, D-170, D-231.
- **Public site and SEO:** D-027, D-054, D-076, D-090 to D-098, D-100, D-101, D-153.
- **Performance:** D-054, D-150, D-151, D-167 to D-171.
- **CI and repository:** D-001 to D-007, D-012 to D-016, D-020, D-023 to D-025, D-028, D-030 to
  D-033, D-039 to D-041, D-048, D-055, D-083, D-097, D-125, D-127, D-134, D-136, D-139 to D-142,
  D-144, D-164 to D-166, D-171 to D-174, D-176, D-178, D-192.
- **Release and operations:** D-009 to D-012, D-017, D-019, D-021, D-022, D-029, D-036, D-042 to
  D-047, D-064, D-123, D-126, D-132, D-133, D-135, D-138, D-140, D-141, D-143, D-152, D-155, D-177,
  D-191.

## M0: repo, tooling, CI, environments

Approved by the owner on 2026-09-24 (D-001 to D-019 as proposed in the M0 plan).

| ID    | Date       | Decision                                                                                                                                                                                                                                                          | Reason                                                                                                 | Status                  |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------- |
| D-001 | 2026-09-24 | Repository lives at `C:\dev\vivarise-bms`, outside OneDrive. `CLAUDE.md` at the root, spec at `docs/SPEC.md`.                                                                                                                                                     | OneDrive sync breaks `node_modules` with file locks and can corrupt `.git`.                            | Amended by D-048        |
| D-002 | 2026-09-24 | pnpm workspaces + Turborepo (Turborepo later replaced, see D-031). Node 24 LTS pinned via `.nvmrc`, `engines` and `packageManager`.                                                                                                                               | Monorepo layout in CLAUDE.md §7 with cached tasks; Node 24 is the current LTS and supported by Vercel. | Amended by D-031        |
| D-003 | 2026-09-24 | Internal packages are named `@vivarise/*` (renamed `@sbn/*`, D-039) and consumed as TypeScript source (no per-package build).                                                                                                                                     | Simplest setup for a solo builder; no build step between packages.                                     | Amended by D-039        |
| D-004 | 2026-09-24 | TypeScript `strict` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`.                                                                                                                                                                | Catches missing-index bugs in financial code.                                                          | Active                  |
| D-005 | 2026-09-24 | ESLint flat config: typescript-eslint strict-type-checked, Next.js core-web-vitals, jsx-a11y strict. The engine may not import I/O, framework or network modules, or call `Math.random`, `Date.now` or `new Date()`. `export const runtime = 'edge'` is an error. | Enforces rules 1 and 11 mechanically; edge functions run outside fra1.                                 | Active                  |
| D-006 | 2026-09-24 | Vitest for unit tests; the engine's 95% line-coverage gate is active from day one.                                                                                                                                                                                | CLAUDE.md §5.                                                                                          | Active                  |
| D-007 | 2026-09-24 | Playwright installed in M0 with one RTL smoke test. Visual snapshots start in M1 and are generated on Linux (CI) only.                                                                                                                                            | Windows and Linux render fonts differently; snapshots must come from one OS.                           | Amended by D-055        |
| D-008 | 2026-09-24 | Tailwind, fonts and Radix are deferred to M1. The M0 page is unstyled.                                                                                                                                                                                            | Styling belongs to the design milestone.                                                               | Done                    |
| D-009 | 2026-09-24 | Environment variables are validated by zod in `apps/web/src/env/server.ts` (imports `server-only`) and `client.ts` (`NEXT_PUBLIC_*` only). A variable joins a schema in the milestone that first uses it; `.env.example` documents all of them.                   | Rule 7.                                                                                                | Active                  |
| D-010 | 2026-09-24 | Supabase publishable (`sb_publishable_…`) and secret (`sb_secret_…`) keys only; no legacy `anon` / `service_role` keys.                                                                                                                                           | Supabase retires the legacy keys at the end of 2026.                                                   | Active                  |
| D-011 | 2026-09-24 | Three environments: local (Supabase in Docker), staging (Vercel Preview + Supabase staging), production (Vercel Production + Supabase prod). No Supabase branching.                                                                                               | Branching is a paid add-on; two projects cover the need.                                               | Active                  |
| D-012 | 2026-09-24 | CI applies every migration to an empty database and runs pgTAP. Merges to `main` push migrations to staging automatically; production is a manual run gated by GitHub Environment approval. Migrations must be backward-compatible (expand, migrate, contract).   | Vercel deploys the app independently of the database.                                                  | Amended by D-140, D-141 |
| D-013 | 2026-09-24 | A pgTAP test fails CI if any table in `public` lacks RLS.                                                                                                                                                                                                         | Rule 6, enforced automatically.                                                                        | Active                  |
| D-014 | 2026-09-24 | Baseline migration creates a `private` schema, closed to API roles, for future RLS helper functions.                                                                                                                                                              | Keeps security-definer helpers off the Data API.                                                       | Active                  |
| D-015 | 2026-09-24 | Git hooks via lefthook: pre-commit formats and lints staged files, commit-msg enforces conventional commits, pre-push runs typecheck and tests.                                                                                                                   | CLAUDE.md §8.7.                                                                                        | Active                  |
| D-016 | 2026-09-24 | CI runs gitleaks over the full history and scans the built client output for secret key material.                                                                                                                                                                 | Rule 7, enforced automatically.                                                                        | Active                  |
| D-017 | 2026-09-24 | `GET /api/health` returns only status, Vercel region and Supabase reachability/latency.                                                                                                                                                                           | Proves fra1 to Frankfurt co-location without exposing configuration.                                   | Amended by D-152        |
| D-018 | 2026-09-24 | "Allow new users to sign up" stays off in Supabase staging and production until M2 ships the eligibility gate.                                                                                                                                                    | Stops accounts being created through the API before the gate exists.                                   | Superseded by D-065     |
| D-019 | 2026-09-24 | Vercel functions pinned with `regions: ["fra1"]`; no failover region outside the EU.                                                                                                                                                                              | CLAUDE.md §3.                                                                                          | Active                  |

## Owner answers to the M0 questions (2026-09-24)

| ID    | Date       | Decision                                                                                                                                         | Reason                                                                                                                                              | Status                  |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| D-020 | 2026-09-24 | GitHub repository `laithhamoda/vivarise-bms`, private (renamed `laithhamoda/startupbrandname`, D-039).                                           | Owner gave the account (corrected from `laithrhamoda` on 2026-09-25); repository name taken from the M0 plan.                                       | Amended by D-039, D-140 |
| D-021 | 2026-09-24 | Vercel team `laithhamodas-projects`. Upgrade to Pro before M7 or public launch, whichever comes first.                                           | Vercel Hobby is for non-commercial use only.                                                                                                        | Open                    |
| D-022 | 2026-09-24 | The product runs as a standalone app on its own domain, `startupbrandname.com`, not inside vivarise.net. Until launch it runs on `*.vercel.app`. | Owner's answer. CLAUDE.md §2 still describes a module inside vivarise.net; whether the domain and brand are final is tracked in OPEN-QUESTIONS #33. | Amended by D-037        |

## Made during M0 implementation (2026-09-24)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                        | Reason                                                                                                                                                                                                                                                                                     | Status                  |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| D-023 | 2026-09-24 | Exact version pins: Node 24 LTS, pnpm 10.34.5, TypeScript 6.0.3, ESLint 9.39.5 (later 10.11.0, see D-032), Vitest 4.1.11, `@types/node` 24.13.6. Latest for the rest: Next.js 16.3.6, React 19.3.0, zod 4.6.5, Turbo 2.11.3, Playwright 1.63.0, Supabase CLI 2.117.0, typescript-eslint 8.70.1. | TypeScript 7 is excluded because typescript-eslint 8.70 supports `<6.1`. ESLint 10 is excluded because eslint-plugin-jsx-a11y 6.10.2 supports up to 9. Vitest 5.0 (released 2026-09-03) and pnpm 12 (released 2026-08-26) are too new to trust. `@types/node` matches the Node 24 runtime. | Amended by D-031, D-032 |
| D-024 | 2026-09-24 | Shared dev tooling (TypeScript, ESLint, Vitest, Prettier, Turbo, Supabase CLI) is installed once at the workspace root; packages declare only runtime dependencies.                                                                                                                             | One version of each tool across the repo.                                                                                                                                                                                                                                                  | Amended by D-031        |
| D-025 | 2026-09-24 | Empty packages run `vitest run --passWithNoTests` instead of carrying placeholder tests. The engine keeps `ENGINE_VERSION` and its test, so its coverage gate is live.                                                                                                                          | No fake code; real tests arrive with each package's milestone.                                                                                                                                                                                                                             | Active                  |
| D-026 | 2026-09-24 | `MARKET_DZ_ENABLED` joins the server env schema in M0 (exception to D-009): defaults to false, accepts only `"true"` / `"false"`.                                                                                                                                                               | Locked flag from CLAUDE.md §3; guards against the `"false"` → true coercion bug from day one.                                                                                                                                                                                              | Amended by D-068        |
| D-027 | 2026-09-24 | Pages carry `robots: noindex, nofollow` until launch.                                                                                                                                                                                                                                           | Keeps `*.vercel.app` preview and production URLs out of search indexes.                                                                                                                                                                                                                    | Active                  |
| D-028 | 2026-09-24 | GitHub Actions are pinned to full commit SHAs, with the version in a comment.                                                                                                                                                                                                                   | Protects CI from a compromised action tag.                                                                                                                                                                                                                                                 | Active                  |
| D-029 | 2026-09-24 | Migration secrets are scoped per GitHub Environment: `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` in both `staging` and `production`; `SUPABASE_ACCESS_TOKEN` at repository level. Replaces the per-environment secret names in the M0 plan.                                               | One workflow for both targets; production credentials are only usable after approval.                                                                                                                                                                                                      | Amended by D-046        |
| D-030 | 2026-09-24 | Open questions are tracked in `docs/OPEN-QUESTIONS.md`.                                                                                                                                                                                                                                         | More than 60 items must survive across sessions.                                                                                                                                                                                                                                           | Active                  |

## Changes from verifying M0 (2026-09-25)

| ID    | Date       | Decision                                                                                                                                                                                             | Reason                                                                                                                                                                                                                                                                                                         | Status           |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| D-031 | 2026-09-25 | Turborepo removed. Root scripts run package scripts with `pnpm -r --if-present run <task>`; `test:e2e` builds the web app first. Supersedes the Turborepo part of D-002.                             | Windows Smart App Control on the owner's machine blocks the unsigned `turbo.exe`, and switching Smart App Control off cannot be undone without reinstalling Windows. Task caching is not needed at this repo size.                                                                                             | Amended by D-048 |
| D-032 | 2026-09-25 | ESLint 10.11.0 and `@eslint/js` 10.0.1 instead of 9.39.5. React version set explicitly (`19.3`) in the lint config. `@next/next/no-html-link-for-pages` is off. Amends D-023.                        | npm marks ESLint 9 as "no longer supported". `eslint-plugin-jsx-a11y` 6.10.2 still declares ESLint ≤ 9 as a peer but runs correctly on 10 (verified with planted violations). `eslint-plugin-react`'s version detection calls an API removed in ESLint 10. The disabled rule only applies to the Pages Router. | Active           |
| D-033 | 2026-09-25 | No dependency may run install scripts. `lefthook` and `unrs-resolver` are listed in `ignoredBuiltDependencies`. The Supabase CLI no longer needs an install script (it ships per-platform binaries). | Least privilege at install time. Git hooks are installed by the root `prepare` script instead.                                                                                                                                                                                                                 | Active           |
| D-034 | 2026-09-25 | `supabase/config.toml` is the CLI default for Postgres 17. Local sign-ups stay enabled for development; D-018 applies only to the hosted projects.                                                   | The local stack needs sign-ups for M2 development and tests.                                                                                                                                                                                                                                                   | Active           |

## Product scope (2026-09-25)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Reason                                                                                                                                                                         | Status                  |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| D-035 | 2026-09-25 | Business-name finder is in scope (owner chose option A). Suggestions come from the founder's diagnostic answers, in Arabic with a Latin spelling. Every name is checked live against official sources (the .com registry via RDAP first; trade-name registers and trademark offices in Jordan and Algeria later) and shown with the source and check date. No name is ever labelled available without a live check. The owner's list (`docs/data/name-candidates.txt`, 1,813 names) is one extra candidate source. Milestone not set yet; it needs the M3 diagnostic answers. | Owner decision. Rule 9 (never fabricate availability) and rule 2 (provenance on every fact). A fixed list goes stale: a spot check found both unregistered and for-sale names. | Active                  |
| D-036 | 2026-09-25 | Supabase: a new organisation "Vivarise" (renamed "Startup Brand Name", D-039) under the owner's existing Supabase login, on the Free plan, holding a staging and a production project in Central EU (Frankfurt). Production moves to Pro before real user data (M2).                                                                                                                                                                                                                                                                                                          | Owner's answer to #61. Keeps Bayty and this product separate for billing and access.                                                                                           | Amended by D-039, D-064 |

## Platform identity (2026-09-25)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                 | Reason                                                                                                                                | Status           |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| D-037 | 2026-09-25 | The platform is "Startup Brand Name" at `startupbrandname.com`: the owner's own standalone platform, not part of or technically connected to vivarise.net. CLAUDE.md §2 (context) and §5 (deck brand) updated. Supersedes the "module inside Vivarise" context.                                                                                                                                                                          | Owner's statement.                                                                                                                    | Active           |
| D-038 | 2026-09-25 | Trainees (not trainers) of the owner's "AI in Entrepreneurship" course get the Course buyer tier: free for 12 months from activation. They activate with Viva Rise marketing codes in the locked `VIVA` + 8 hex format; the owner chose to keep the `VIVA` prefix. Issuing details to follow (OPEN-QUESTIONS #63).                                                                                                                       | Owner's answers. Matches the existing Course buyer tier and voucher rules in CLAUDE.md §3.                                            | Active           |
| D-039 | 2026-09-25 | Internal names renamed before the first push: root package `startupbrandname`, workspace scope `@sbn/*`, local Supabase project id `startupbrandname`. Planned hosted names: GitHub repository `laithhamoda/startupbrandname`, Supabase organisation "Startup Brand Name" with projects `startupbrandname-staging` and `startupbrandname-prod`, Vercel project `startupbrandname`. The local folder stays `C:\dev\vivarise-bms` for now. | Owner approved renaming. Cheapest before anything is pushed or deployed; renaming the local folder would mean re-cloning mid-session. | Amended by D-048 |

## Changes after the first push (2026-09-25)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                | Reason                                                                                                                                                                                                                                                                                    | Status           |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| D-040 | 2026-09-25 | The CI secret scan runs the gitleaks CLI 8.30.1 (download verified by pinned SHA-256) over the full git history, replacing `gitleaks/gitleaks-action`.                                                                                                                                                                                                                                                                                                  | The action failed on the repository's first push (it scans from the parent of the root commit, which does not exist), scans only the pushed range rather than full history (D-016), and its licence needs a paid key if the repo moves to a GitHub organisation. The CLI is MIT-licensed. | Active           |
| D-041 | 2026-09-25 | `.gitleaks.toml` keeps the default rules and allowlists only values matching `sb_publishable_…` for the `generic-api-key` rule.                                                                                                                                                                                                                                                                                                                         | The full-history scan flagged two fake publishable keys in test files. Publishable keys are public by design; secret keys (`sb_secret_…`) and every other rule remain enforced.                                                                                                           | Active           |
| D-042 | 2026-09-25 | Vercel project `startupbrandname` (team `laithhamodas-projects`): framework Next.js, Root Directory `apps/web` with files outside the root included in the build, Node.js 24.x, functions in `fra1` (also pinned by `apps/web/vercel.json`), domains `startupbrandname.com` (primary) and `www.startupbrandname.com` (308 redirect to the primary). Deployments come only from the connected GitHub repo, never from dashboard redeploys of old builds. | The first deployments were redeploys of an empty project, which failed or served nothing and ran in `iad1` (USA).                                                                                                                                                                         | Amended by D-043 |
| D-043 | 2026-09-25 | The `www.startupbrandname.com` → `startupbrandname.com` redirect (308, path kept) lives in `apps/web/vercel.json`, matched on the host, instead of the dashboard's domain setting. Amends D-042.                                                                                                                                                                                                                                                        | Version-controlled and reviewable; the Vercel connection cannot edit a domain's redirect. Same result for visitors and search engines.                                                                                                                                                    | Active           |
| D-044 | 2026-09-25 | Supabase projects in organisation "Startup Brand Name": `startupbrandname-prod` (ref `blexotsepkuslrnawbbq`) and `startupbrandname-staging` (ref `mllysinjzlkhpcgbckil`), both `eu-central-1` (Frankfurt), Postgres 17, legacy JWT keys disabled. A first project created in `eu-west-1` (Ireland) was deleted while still empty. Vercel Production uses the prod project; Preview will use staging.                                                    | D-011 and D-036; a project's region cannot be changed after creation, and Ireland would put the database away from the `fra1` functions.                                                                                                                                                  | Active           |
| D-045 | 2026-09-25 | Vercel variables: Production pairs the prod Supabase URL with the prod publishable key; Preview pairs the staging URL with the staging key. When `/api/health` reports `http_401`, first check that both values come from the same project.                                                                                                                                                                                                             | A staging key saved against the prod URL caused a 401 on the first production check (fixed the same day).                                                                                                                                                                                 | Active           |
| D-046 | 2026-09-25 | The DB deploy workflow uses GitHub Environments `db-staging` and `db-production` (was `staging` / `production`), each holding `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`; `db-production` requires the owner's approval. Amends D-029.                                                                                                                                                                                                           | Vercel creates GitHub Environments named `Production` and `Preview` for its deployments, and environment names are case-insensitive, so `production` would have shared Vercel's environment.                                                                                              | Amended by D-140 |
| D-047 | 2026-09-26 | Production migrations are gated by: manual `workflow_dispatch` only (pushes migrate staging only), a required typed confirmation `migrate production`, and the owner's approval in chat before Claude triggers a run. Replaces the "required reviewer" part of D-012 and D-046.                                                                                                                                                                         | GitHub docs: on Free, Pro and Team plans, required reviewers are only available for public repositories; this repo is private.                                                                                                                                                            | Amended by D-140 |
| D-048 | 2026-09-26 | Development moves into WSL2 (Ubuntu 26.04) at `~/code/startupbrandname`: Node.js 24 from the official nodejs.org tarball (SHA-256 verified) in `~/.local/node`, pnpm via corepack, Git credentials reused from the Windows GitHub CLI. The Windows copy `C:\dev\vivarise-bms` is retired and no longer updated. Supersedes the location in D-001 and the Windows workaround in D-031.                                                                   | Windows Smart App Control blocked unsigned native tools twice (Turbo, then rolldown, which Vitest needs), and its WebAssembly fallback cannot resolve Windows paths. Linux in WSL2 matches the CI runners and keeps Smart App Control on (owner chose this over turning it off).          | Amended by D-136 |

## M1 design plan (approved 2026-09-26)

The owner approved the M1 design plan (https://claude.ai/artifact/WgbNTLv2TmWzEaYsme3Pxs) with every recommended option ("do all required recommendations").

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Reason                                                                                                                                                                                                  | Status |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D-049 | 2026-09-26 | Accessible "ink" variants for text on light backgrounds: gold-ink `#8C6A12` and teal-ink `#0B6E8A`. The brand tokens `#000000`, `#D4A537`, `#1FA3C7` are unchanged; gold and teal appear as text only on black.                                                                                                                                                                                                                                                       | On the light paper background gold is 2.16:1 and teal 2.80:1, below WCAG AA 4.5:1; the ink variants reach 4.77:1 and 5.52:1.                                                                            | Active |
| D-050 | 2026-09-26 | Brand lockup: Latin wordmark "Startup Brand Name" with the fixed Arabic descriptor "استوديو نموذج العمل". Resolves OPEN-QUESTIONS #65 (option A).                                                                                                                                                                                                                                                                                                                     | Keeps the chosen domain and name while giving the Arabic-only UI an Arabic identity line.                                                                                                               | Active |
| D-051 | 2026-09-26 | Business Model Canvas uses the standard geometry: customer segments on the right, where RTL reading starts; revenue bottom right, costs bottom left. Resolves #57 (option A) and replaces "mirrored" in CLAUDE.md §6.                                                                                                                                                                                                                                                 | Matches the canvas trainees know from books and the course, and satisfies "starts at the right with customer segments". A full mirror would move customer segments to the left.                         | Active |
| D-052 | 2026-09-26 | Theme follows the operating system with a manual toggle; the verdict slab stays black and gold in both themes.                                                                                                                                                                                                                                                                                                                                                        | Respects user preference; keeps the one signature element constant.                                                                                                                                     | Active |
| D-053 | 2026-09-26 | Wireframes are low-fidelity HTML instead of ASCII (CLAUDE.md §6).                                                                                                                                                                                                                                                                                                                                                                                                     | Arabic text inside monospace ASCII art reorders under bidi and breaks alignment, so it cannot show real RTL layouts.                                                                                    | Done   |
| D-054 | 2026-09-26 | SEO and GEO (visibility in search engines and AI answer engines) are in scope. M1 adds the foundations: per-page metadata, semantic landmarks, an indexing switch (`SITE_INDEXABLE`, off until public launch per D-027) driving robots meta, `robots.txt` and `sitemap.xml`, Organization/WebSite JSON-LD, and a performance budget. New milestone M2b (public site and content) follows M2; public calculators follow M4; verified registration guides follow M5/M8. | Owner request for the best SEO and GEO in the field. Ranking depends on content and authority as well as engineering, so the technical base is built first and content is planned as its own milestone. | Active |

## M1 implementation (2026-09-26)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                     | Reason                                                                                                                                                            | Status |
| ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D-055 | 2026-09-26 | RTL visual snapshots run only in CI, inside the pinned Playwright image `mcr.microsoft.com/playwright:v1.63.0-resolute` (Ubuntu 26.04, pinned by digest). Baselines are produced by the manual "Update RTL snapshots" workflow, downloaded, reviewed and committed under `apps/web/e2e/__screenshots__`. Local runs skip the snapshot tests; accessibility and quality tests run everywhere. | Pixel comparisons are only stable when baselines and checks come from the same image. Ubuntu 26.04 matches the WSL dev environment.                               | Active |
| D-056 | 2026-09-26 | Tailwind 4.3 with every default colour, text size, radius and shadow removed; only the design tokens exist as utilities. Physical left/right styling is blocked by `scripts/check-logical-css.mjs` in `pnpm lint` (opt-out comment `logical-css-ignore` with a reason).                                                                                                                      | Makes off-palette colours and non-logical properties impossible to ship by accident (CLAUDE.md §5, §6).                                                           | Active |
| D-057 | 2026-09-26 | Interactive primitives come from the `radix-ui` package (Dialog, Tooltip, Tabs, RadioGroup, Checkbox) under an RTL `Direction.Provider`; selects are native `<select>` elements; icons are `lucide-react`.                                                                                                                                                                                   | Radix gives accessible behaviour with custom styling; native selects are the most reliable on phones; one icon set with explicit mirroring for directional icons. | Active |
| D-058 | 2026-09-26 | The component gallery at `/design` is for design review and tests only: `noindex`, disallowed in `robots.txt`, and returns 404 on the production deployment. The theme is applied before first paint by a small inline script; the M9 Content-Security-Policy must allow it with a hash or nonce.                                                                                            | Keeps an internal page out of the public site; records a dependency for the security hardening milestone.                                                         | Active |

## Eligibility (2026-09-26)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                         | Reason                                                                                                                                                                                   | Status              |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| D-059 | 2026-09-26 | The platform is for adults only (18+). Signup requires declaring secondary-school completion and being 18 or older; a no to either ends signup with a clear message and stores nothing, not even the email. The guardian-consent flow is removed from M2. No date of birth is collected (unchanged). Supersedes CLAUDE.md §3 Eligibility item 2, the guardian parts of M2, and SPEC G6, T17 and the users table. | Owner decision, explicitly changing a locked rule. It also avoids processing minors' data under Jordan's data-protection law and Algeria's Law 18-07, and removes an email-consent flow. | Superseded by D-086 |

## M2 preparation (approved 2026-09-26)

The owner approved all recommendations offered before the M2 plan.

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                            | Reason                                                                                                                              | Status                         |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| D-060 | 2026-09-26 | Course voucher codes (`course_12m`) can be activated for 12 months from issue; other codes keep the 60-day window. Replaces the "30 September after exams" rule in CLAUDE.md §3. Resolves #71.                                                                                                                      | With the platform 18+ only (D-059), some trainees may still be under 18 on 30 September. A fixed 12-month window needs no age data. | Active                         |
| D-061 | 2026-09-26 | Transactional email is sent by Resend from its EU region (Ireland, `eu-west-1`) on a sending subdomain of startupbrandname.com, configured as custom SMTP for Supabase Auth. Resolves #32.                                                                                                                          | Keeps email processing in the EU next to Supabase Frankfurt; Supabase's built-in email is not for production.                       | Active                         |
| D-062 | 2026-09-26 | Cross-border consent is optional. Without it the account works with every non-AI feature (deterministic answer checks, calculations, canvases, reports); AI features (dialect normalisation by the model, the mentor) stay off with a clear explanation, and consent can be given or withdrawn later. Resolves #27. | Consent must be freely given, so refusing it cannot block the whole service.                                                        | Amended by D-147               |
| D-063 | 2026-09-26 | The market is the country the user declares at signup, not IP geolocation. Jordan creates an account; Algeria joins the waitlist while `MARKET_DZ_ENABLED=false`. Partly resolves #28.                                                                                                                              | IP location is unreliable (VPNs, travel) and adds a data processor; a declaration is explicit.                                      | Amended by D-066, D-068, D-069 |
| D-064 | 2026-09-26 | Supabase production moves to the Pro plan before signup opens to the public. Confirms D-036.                                                                                                                                                                                                                        | Daily backups and no automatic pausing once real users exist.                                                                       | Open                           |

## Global and bilingual (owner decisions, 2026-09-26)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Reason                                                                                                                                     | Status           |
| ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| D-065 | 2026-09-26 | Sign-in by email one-time code **and** Google. Google (Google LLC, USA) is listed as a processor. An account created through Google stays incomplete, with no access to anything, until both declarations are made; a refusal deletes it immediately; incomplete accounts are deleted automatically after 24 hours. Public signup is therefore enabled in Supabase and enforcement moves to the onboarding gate and RLS (amends D-018). The email-code path still stores nothing on refusal. | Owner choice. Google creates the account before the declarations can be checked, so the gate and the 24-hour purge keep D-059 enforceable. | Amended by D-086 |
| D-066 | 2026-09-26 | The platform is global: signup is open in every country. Country-specific legal, tax and registration content is verified country by country, starting with Jordan and Algeria; elsewhere those sections say no verified data exists yet. Where SPEC assumes only Jordan and Algeria (currencies, country list, legal texts), this decision supersedes it.                                                                                                                                   | Owner decision, changing the locked "Markets" rule.                                                                                        | Active           |
| D-067 | 2026-09-26 | Languages: Modern Standard Arabic (default, RTL) and English (LTR), chosen by the user. Arabic/English foundations (routing, message catalogues, LTR layout) are built in M2; English question bank, report and mentor follow in their milestones.                                                                                                                                                                                                                                           | Owner decision, changing the locked "MSA only" rule. The logical-properties rule (D-056) already lets one layout serve both directions.    | Active           |
| D-068 | 2026-09-26 | Algeria opens now, like every other country, before the Law 18-07 legal opinion. The owner accepts that legal risk. `MARKET_DZ_ENABLED` remains as a kill switch, set to `true`.                                                                                                                                                                                                                                                                                                             | Owner decision after being told the law restricts transfers of personal data abroad.                                                       | Active           |
| D-069 | 2026-09-26 | No waitlist is needed while every country is open. Any future waitlist uses email confirmation (double opt-in).                                                                                                                                                                                                                                                                                                                                                                              | Follows D-066 and D-068; keeps the owner's choice for later.                                                                               | Active           |

## Language URLs and free tier (owner decisions, 2026-09-26)

| ID    | Date       | Decision                                                                                                                                                                                                                                                 | Reason                                                                                                     | Status |
| ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| D-070 | 2026-09-26 | Every page lives under `/ar/` or `/en/`. `/` redirects to the saved language, else the browser language, else Arabic; `x-default` points at `/`. Resolves #75.                                                                                           | Owner choice.                                                                                              | Active |
| D-071 | 2026-09-26 | AI mentor quota: Free 3 messages per day, Weekly 10 per day (was 0 and 10 per week). Monthly and above unchanged. A global daily AI spend cap, set by the admin, protects cost. Changes the locked entitlements table; supersedes SPEC where it differs. | Owner decision. Weekly was raised so a paid plan never gets less than the free one.                        | Active |
| D-072 | 2026-09-26 | No AI action (mentor or tool) runs before the project has an idea statement that a Haiku check accepts as a coherent business idea; otherwise the user is asked to clarify.                                                                              | Owner decision. Keeps answers grounded in a project and stops use of the mentor as a free general chatbot. | Active |
| D-073 | 2026-09-26 | Each mentor reply offers 2 to 3 suggested follow-up questions the user can tap.                                                                                                                                                                          | Owner decision. Helps free users get value from 3 messages a day.                                          | Active |
| D-074 | 2026-09-26 | Bot protection (Cloudflare Turnstile) is added in M9, before public launch; M2 relies on Supabase Auth rate limits.                                                                                                                                      | Owner choice.                                                                                              | Active |

## M2 build (2026-09-26)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Reason                                                                                                                                                                | Status                  |
| ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| D-075 | 2026-09-26 | Arabic and English run on next-intl 4 with `localePrefix: 'always'`. `app/[locale]/layout.tsx` is the root layout, and the language is read with `next/root-params` (next-intl deprecated `setRequestLocale`). Arabic `messages/ar.json` is the reference catalogue. Server Actions and Route Handlers pass the locale explicitly. The language cookie is a session cookie (next-intl default), so it needs no consent banner. In English, currency codes follow the number (`250 JOD`), matching the Arabic order.                                                        | ICU messages cover the six Arabic plural forms; typed keys catch missing translations at build time.                                                                  | Active                  |
| D-076 | 2026-09-26 | URLs outside the language routes that contain a dot (for example `/wp-login.php`) get Next.js's plain 404, not a styled one.                                                                                                                                                                                                                                                                                                                                                                                                                                               | The styled alternative (`dynamicParams = false` with the experimental global 404) logs an internal error on every such request, which bots would turn into log noise. | Active                  |
| D-077 | 2026-09-26 | The browser never talks to Supabase. Server Components, Server Actions, the proxy and the auth callback do, with the publishable key and the user's session, so RLS applies. Session cookies are therefore httpOnly (and Secure on Vercel). The proxy refreshes an expiring session before routing. The app holds no secret key in M2: deletions run inside the database.                                                                                                                                                                                                  | Injected scripts cannot read the session; fewer secrets to leak.                                                                                                      | Active                  |
| D-078 | 2026-09-26 | Signup order: declarations first, checked in the browser (a "no" sends nothing), then email or Google. The answers travel in a 30-minute httpOnly cookie holding only country, language and the cross-border choice, and are recorded right after the account exists; the sign-in paths delete that cookie. Email sign-in uses a 6-digit code valid 10 minutes, never a link. The sign-in page gives the same answer whether or not an account exists.                                                                                                                     | Keeps D-059 (nothing stored on refusal) with both sign-in methods; codes survive mail scanners; no account enumeration.                                               | Amended by D-086, D-087 |
| D-079 | 2026-09-26 | A profile row exists only after onboarding; it is the "complete" flag. complete_onboarding() deletes the account on a "no"; a closed country at the gate deletes it too; pg_cron purges accounts still incomplete after 24 hours, every hour at minute 17. The signed-in home is /projects.                                                                                                                                                                                                                                                                                | One source of truth for completeness; D-065.                                                                                                                          | Amended by D-086        |
| D-080 | 2026-09-26 | Country list: the 249 ISO 3166-1 codes plus XK, named by the runtime's Unicode CLDR data in each language and sorted by that language's collation. Sensitive names await the owner (#77).                                                                                                                                                                                                                                                                                                                                                                                  | No hand-kept name list; names stay correct in both languages.                                                                                                         | Amended by D-088        |
| D-081 | 2026-09-26 | The market switch (MARKET_DZ_ENABLED) is enforced by the app, not the database. Someone calling the database API directly could still declare a closed country; if a country must ever be closed for legal reasons, the list moves into the database.                                                                                                                                                                                                                                                                                                                      | Algeria is open (D-068), so the gap has no effect today.                                                                                                              | Active                  |
| D-082 | 2026-09-26 | The optional cross-border consent covers sending project content, without name or email, to Anthropic (United States) for AI features. Hosting processors (Supabase and Vercel in Germany, Resend in Ireland, Google in the United States for Google sign-in) are listed in the privacy policy, not behind that consent.                                                                                                                                                                                                                                                   | Matches D-062 and SPEC §11 ("naming processors and countries"). Legal review must confirm the hosting basis (#73).                                                    | Amended by D-147        |
| D-083 | 2026-09-26 | CI gains an `e2e-auth` job on the host runner: local Supabase (database, auth, API, Mailpit), a check that database.types.ts matches the schema, and the sign-in tests. Snapshot tests stay in the pinned container job.                                                                                                                                                                                                                                                                                                                                                   | The container has no Docker; the sign-in tests take no screenshots.                                                                                                   | Active                  |
| D-084 | 2026-09-26 | After a refusal or a closed country at the onboarding gate, the account is deleted and the user is redirected to `/not-eligible`, which says the account was deleted. Supabase sends at most one code per address per minute; the sign-in pages show the rate-limit message when that is hit.                                                                                                                                                                                                                                                                              | Clearing the session inside a Server Action re-renders the gate, which would send the signed-out user to sign-in before any message could show.                       | Amended by D-086, D-174 |
| D-085 | 2026-09-26 | The Supabase security advisor warns that signed-in users can run complete_onboarding, set_crossborder_consent and delete_my_account (SECURITY DEFINER). Accepted: they are the app's own API, each acts only on auth.uid(), and anon cannot run them. `AUTH_GOOGLE_ENABLED` (default false) shows the Google button only where Supabase has Google configured.                                                                                                                                                                                                             | Avoids a false alarm later; no visitor ever sees Supabase's raw provider error.                                                                                       | Active                  |
| D-086 | 2026-09-26 | Signup no longer asks about secondary school or age. It asks the country, "Do you have a project or a project idea?" (yes / no, stored as `profiles.has_project`, information only), the terms and the optional cross-border consent. The age check ("aged 18 or older?") moves to payment in M7. Nothing refuses an account at onboarding any more; a closed country still does. Replaces D-059 and the eligibility rule in CLAUDE.md §3; supersedes SPEC G5/G6 and the users-table columns for the declarations. Migration `20260926140000_signup_without_declarations`. | Owner decision, after being told that minors could then sign up without a guardian's consent (legal risk recorded as #79).                                            | Active                  |
| D-087 | 2026-09-26 | Sign-in codes are 8 digits (Supabase "Email OTP length" = 8 in both hosted projects and locally); the pages say so. The form accepts 6 to 10 digits so a different dashboard setting never locks anyone out. Amends D-078 (6 digits).                                                                                                                                                                                                                                                                                                                                      | Owner choice after staging sent 8-digit codes; longer codes are also harder to guess.                                                                                 | Active                  |
| D-088 | 2026-09-27 | The country list does not offer IL. PS is named "فلسطين" in Arabic and "Palestine" in English instead of the CLDR names ("الأراضي الفلسطينية" / "Palestinian Territories"). Other names stay as CLDR gives them until the owner decides (#77).                                                                                                                                                                                                                                                                                                                             | Owner decision.                                                                                                                                                       | Active                  |
| D-089 | 2026-09-27 | The Google button appears only when AUTH_GOOGLE_ENABLED is true **and** the environment's Supabase project reports Google enabled (its public `/auth/v1/settings`, cached 60 seconds, 2-second timeout). If Supabase cannot be asked, the button stays hidden. The Server Action applies the same check. AUTH_GOOGLE_VERIFY_PROVIDER=false skips the check, for tests only.                                                                                                                                                                                                | Production showed Supabase's raw "provider is not enabled" page when Vercel had the flag on but Supabase had Google off. Owner approved the safeguard.                | Active                  |

## M2b (owner decisions, 2026-09-27)

| ID    | Date       | Decision                                                                                                                                                                                     | Reason                                                                                                    | Status |
| ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| D-090 | 2026-09-27 | Public pages allow every AI crawler, answer engines and training crawlers alike. Private routes (account, projects, onboarding, API, auth) stay disallowed for all crawlers. Resolves #66.   | Owner choice for the widest visibility in AI answers (GEO); public marketing pages hold no personal data. | Active |
| D-091 | 2026-09-27 | Public page slugs are English in both languages (`/ar/how-it-works`, `/en/how-it-works`). Resolves #67.                                                                                      | Readable when shared; no percent-encoded Arabic in links.                                                 | Active |
| D-092 | 2026-09-27 | Traffic is measured with cookieless Vercel Web Analytics (no consent banner), plus Google Search Console and Bing Webmaster Tools at launch. No Google Analytics. Resolves #68.              | Privacy by design and no extra processor for visitor tracking.                                            | Active |
| D-093 | 2026-09-27 | The public sample report is built after M4/M5, from a fictional example project whose numbers come from the engine and are labelled as an example. M2b only describes the report's sections. | Rule 1: no number in a report may come from anywhere but the engine.                                      | Active |

## M2b (build decisions, 2026-09-27)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Reason                                                                                                                              | Status           |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| D-094 | 2026-09-27 | The pricing table highlights the Annual plan with the gold rule, as in the M1 design plan example. A business choice, changed in `apps/web/src/config/plans.ts` (`HIGHLIGHTED_PLAN`); open for the owner (#82).                                                                                                                                                                                                                                                                   | One highlighted column keeps gold for a single element; Annual is the example the approved design plan used.                        | Active           |
| D-095 | 2026-09-27 | Public page bodies live in typed server-only modules (`apps/web/src/content`), not in `messages/*.json`. Arabic is the reference; a test checks that English has the same shape. The plan table (`config/plans.ts`) is the one source for the pricing page, the structured-data offers and llms.txt, and is pinned to CLAUDE.md §3 by tests; M7 entitlements will read it.                                                                                                        | The message catalogue is sent to the browser in full; page text need not be. One plan table means no price can drift between pages. | Active           |
| D-096 | 2026-09-27 | Share images (1200×630 PNG per page and language, `apps/web/public/og`) are Chromium screenshots of a hidden card route, `/[locale]/og-card/[page]`. The route is noindex and answers 404 on every Vercel deployment. Regenerate with `pnpm --filter @sbn/web og:images` after a build, or with the snapshot workflow.                                                                                                                                                            | Next's image generator (satori) does not shape Arabic; a real browser does.                                                         | Active           |
| D-097 | 2026-09-27 | Lighthouse runs in CI on all 14 public pages and requires SEO and accessibility 100; performance and best practices are reported only. It serves the production build (VERCEL_ENV=production, SITE_INDEXABLE=true) as https://startupbrandname.com through a local HTTPS proxy with a throwaway certificate; Chrome maps that host to the proxy and resolves no other. Lighthouse CI (@lhci/cli) was dropped: it passes Chrome flags as one string, which broke the host mapping. | Canonical, hreflang and robots.txt are only meaningful on the real host and scheme; nothing may reach the live site from a test.    | Amended by D-171 |
| D-098 | 2026-09-27 | Vercel Web Analytics loads only when VERCEL=1 and VERCEL_ENV=production. Query strings and fragments are removed from every event. The privacy draft lists it.                                                                                                                                                                                                                                                                                                                    | Previews and test builds never count, and no code or token in a URL reaches the statistics (D-092).                                 | Amended by D-153 |
| D-099 | 2026-09-27 | Header links fold into a menu button below 1280px; on those widths the language and theme controls sit inside the menu. Glossary and About are linked from the footer only.                                                                                                                                                                                                                                                                                                       | At 1024px the Arabic labels wrapped onto two lines; the phone header now holds the brand and one button.                            | Active           |
| D-100 | 2026-09-27 | The About page describes the platform only. Founder and operator details are added when the owner provides them (#81); no placeholder is published.                                                                                                                                                                                                                                                                                                                               | Rule 9 and E-E-A-T: nothing about a person is invented, and a public page never shows a placeholder.                                | Active           |
| D-101 | 2026-09-27 | Structured data: Organization and WebSite on every page; WebPage and WebApplication with USD offers (home), HowTo (how it works), Article (methodology), WebApplication (pricing), DefinedTermSet (glossary), FAQPage (FAQ), AboutPage (about), and BreadcrumbList on inner pages. No ratings or reviews. Google shows FAQ and HowTo rich results for few sites; the markup stays valid and is read by answer engines.                                                            | Machine-readable facts for search and AI answers (D-054) without claiming anything that does not exist.                             | Active           |

## M3 (owner decisions and plan, 2026-09-27)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Reason                                                                                                                                 | Status                  |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| D-102 | 2026-09-27 | Inside each axis a ★ question weighs 2 and any other question 1; the axis weights stay as in SPEC §3. The 20 ★ questions of the quick mode then reach 53.4% completeness, enough for the one-page summary. Resolves #35.                                                                                                                                                                                                                                                                                  | Owner decision. Keeps the SPEC axis weights and the 40% gate while letting the quick mode earn the summary it is designed for.         | Active                  |
| D-103 | 2026-09-27 | AI in M3 (Haiku: dialect normalization, classification the fixed checks cannot do, the idea check of D-072) runs only for users who gave the cross-border consent. Without it, the diagnostic uses fixed checks only. A daily cap per user and a global daily spend cap live in `settings` and are admin-adjustable; the first values are set in the M3c plan and revised after measurement. Resolves #58 (mechanism).                                                                                    | Owner decision. Consent is required for any processing by Anthropic (D-082); caps protect cost on the free tier.                       | Amended by D-147        |
| D-104 | 2026-09-27 | An «لا أعرف» answer counts as answered for completeness. It is stored as `source = assumption`, `confidence = low`, `validated = false`, creates a validation task, and is flagged in the report. Resolves #36 for «لا أعرف».                                                                                                                                                                                                                                                                             | Owner decision. Founders without data can move forward without inventing a number, and the gap stays visible.                          | Active                  |
| D-105 | 2026-09-27 | Completeness is computed over the 64 core questions only; follow-up questions do not count. An optional question (B6) counts like the others when answered and as missing when skipped. Completes #36.                                                                                                                                                                                                                                                                                                    | One fixed denominator per project, so the score never jumps when a follow-up appears.                                                  | Active                  |
| D-106 | 2026-09-27 | Claude drafts all question-bank text: Arabic labels taken verbatim from SPEC, English versions, help examples, option lists, follow-ups and the R1–R8 responses (R1, R2, R5 and R8 keep the SPEC wording). The sector list follows the ISIC Rev.4 sections. The owner reviews everything before launch. Resolves the authoring part of #19, #37 and #76; the review stays open.                                                                                                                           | Owner decision. Unblocks M3 without waiting for content, with the owner keeping the final say.                                         | Open                    |
| D-107 | 2026-09-27 | De-identification lives in `packages/ai/src/deidentify.ts` (the monorepo layout of CLAUDE.md §7) and ships in M3c, before the first model call, with its tests. Resolves #2 and #3.                                                                                                                                                                                                                                                                                                                       | Rule 5 applies from the first AI call, which is in M3, not M6.                                                                         | Amended by D-148, D-149 |
| D-108 | 2026-09-27 | When an amount is in Algerian dinars and the text contains «مليون», «مليار» or «سنتيم», the platform asks whether it means dinars or centimes before saving a number. Resolves #20.                                                                                                                                                                                                                                                                                                                       | Everyday Algerian usage counts in centimes; a silent guess could be off by 100×.                                                       | Active                  |
| D-109 | 2026-09-27 | Until paid plans exist (M7), every user gets the free plan's project limit (one project), read from `apps/web/src/config/plans.ts`.                                                                                                                                                                                                                                                                                                                                                                       | Entitlements stay table-driven; no plan name appears in the logic.                                                                     | Amended by D-174        |
| D-110 | 2026-09-27 | The full-report gate needs real values for F3, F4 and F5. F1 may be «لا أعرف» when at least one competitor price in D4 is known, because the engine then derives a price range (SPEC F1). Completes SPEC §3 “complete” under D-104.                                                                                                                                                                                                                                                                       | The engine's core formulas cannot run on unknown costs; a price range from real competitor prices is a stated SPEC fallback.           | Active                  |
| D-111 | 2026-09-27 | A project's currency and the report currency (F8) are always chosen by the founder; nothing is preselected from the country. Differs from SPEC F8 (“default = A1 currency”).                                                                                                                                                                                                                                                                                                                              | CLAUDE.md §3: never infer currency; with a global audience (D-066) a country does not decide the currency a founder prices in.         | Active                  |
| D-112 | 2026-09-27 | Rule scope: R1 on B3 and C2; R2 on D3 (competitor names) and B4 (“no solution” variant); R5 on D5 and H1; R7 on the long answers of B2, B4, B6, B8, D5 and E1; R8 on B2; R3 on number fields; R4 wherever «لا أعرف» is allowed; R6 on four named pairs (B5/C6, F6/E7, A4/G4, A7/H5). Phrase rules fire only on short answers (8 words or fewer), and one rejection reason is shown at a time. SPEC's combined types are named field kinds in `packages/question-bank/src/types.ts`. Resolves #37 and #38. | A detailed answer that uses a word like “everyone” in passing must not be rejected; one clear reason is easier to act on than several. | Active                  |
| D-113 | 2026-09-27 | Validation tasks and completeness are computed from the answers, not stored (rule 3). A `validation_tasks` table arrives with the 30-day plan (M5), when task status must be tracked. Amounts in different currencies are never added or compared until a conversion rule exists (#21).                                                                                                                                                                                                                   | One source of truth; no silent currency mixing.                                                                                        | Active                  |
| D-114 | 2026-09-27 | Provenance of diagnostic answers: a typed answer is `user`, confidence `medium`, not validated; a range picked after an unreadable number (R3) is `assumption`, `medium`; «لا أعرف» is `assumption`, `low` (D-104). `high` is kept for answers backed by evidence, such as a completed validation task (M5).                                                                                                                                                                                              | A founder's own estimate is not yet evidence; confidence rises when something confirms it.                                             | Active                  |
| D-115 | 2026-09-27 | Each step is saved on the server when the founder moves on (Next, a range, or «لا أعرف»); there is no background saving of a half-typed answer. A rejected answer stays in the form for editing.                                                                                                                                                                                                                                                                                                          | One save per step keeps the rules in charge of what is stored and makes resuming exact.                                                | Active                  |
| D-116 | 2026-09-27 | Follow-up answers are deleted as soon as their trigger no longer holds (for example G4.1 after G4 drops to one owner).                                                                                                                                                                                                                                                                                                                                                                                    | One source of truth: no stale answer can keep a warning alive.                                                                         | Amended by D-129        |
| D-117 | 2026-09-27 | Diagnostic URLs are `/projects/{id}/q/{step}`, with follow-ups written `F6-1`. Questions outside the quick mode stay reachable from the overview; from there, Next and Previous follow the full order.                                                                                                                                                                                                                                                                                                    | The proxy treats any path with a dot as a file and would skip the session refresh.                                                     | Active                  |
| D-118 | 2026-09-27 | `/[locale]/design/diagnostic` shows the diagnostic components with sample answers, like `/design`: never on production, snapshotted in CI, checked by axe. The signed-in flows are tested end to end in CI against local Supabase (e2e-auth).                                                                                                                                                                                                                                                             | The screens can be reviewed without a database or an account.                                                                          | Active                  |

## M3c (owner decisions, 2026-09-27)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                      | Reason                                                                                      | Status           |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------- |
| D-119 | 2026-09-27 | The dialect confirmation («فهمت أن… صحيح؟») appears only when a text answer is in an Arabic dialect or mixed with French and its Modern Standard Arabic version differs from what was typed. Answers already in MSA or English are saved as typed. The typed text always stays in `raw_text`. | Owner decision. One extra step only where it helps the founder be understood.               | Amended by D-149 |
| D-120 | 2026-09-27 | Starting AI limits: 40 AI calls per user per day and a global AI spend cap of 5 USD per day, both in `settings` and admin-adjustable; days are counted in UTC. When a limit is reached, the diagnostic continues with the fixed checks only until the next day. Resolves #58.                 | Owner decision, conservative until real costs are measured on the first users.              | Active           |
| D-121 | 2026-09-27 | English answers are never rewritten. They get the AI classification for R1, R2, R5 and R8 and the idea check (D-072), like Arabic ones.                                                                                                                                                       | Owner decision. Rewriting helps with dialects; English needs the checks, not a new wording. | Active           |

## M3c (build decisions, 2026-09-28)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Reason                                                                                                                                      | Status                  |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| D-122 | 2026-09-28 | The fast model is read from `settings` (`ai.model.fast`) and priced from `ai.prices`, a map keyed by model ID in which each price records its source URL and check date. Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) was checked on the official models page on 2026-09-28: active, retirement not before 2026-10-15 and announced at least 60 days ahead. When a deprecation is announced, the owner or admin adds the successor's price to `ai.prices`, then sets `ai.model.fast` to it; if no model or price is found, AI switches itself off. | The model may be retired soon after launch. A settings change, not a release, keeps the diagnostic working.                                 | Active                  |
| D-123 | 2026-09-28 | `AI_PROVIDER` is `anthropic` (default), `fake` or `off`. `fake` is a deterministic stand-in with no network call and no cost (`packages/ai/src/fake.ts`), used by the e2e-auth CI job; it never runs when `VERCEL_ENV` is `production`. `off`, or a missing `ANTHROPIC_API_KEY`, keeps the fixed checks only.                                                                                                                                                                                                                                        | End-to-end tests of the confirmation flow without a key or a bill, and an instant switch to turn AI off.                                    | Amended by D-143        |
| D-124 | 2026-09-28 | A model call is made only after `reserve_ai_call()` succeeds, and is always recorded with `record_tool_run()` (tokens, cache tokens, cost from the settings price), even when its output is unusable. A call that fails still counts against the user's day. Outputs are reused per project by `input_hash` (tool, prompt version, model and de-identified input), so a repeat costs and counts nothing; this includes the B1 idea check behind every later answer. Any failure falls back to the fixed checks.                                      | The spend cap stays conservative, nothing is paid twice, and the founder is never blocked by the model.                                     | Amended by D-146, D-151 |
| D-125 | 2026-09-28 | `.gitleaksignore` lists one fingerprint: commit ed21cd1 on the m3c branch, where a pgTAP test compared `key = 'ai.price.<model id>'` and gitleaks' generic-api-key rule read the model ID as a key. The line was replaced in the next commit; the ignore is by fingerprint, so the same text anywhere else is still reported.                                                                                                                                                                                                                        | A false positive in branch history; rewriting published history needs a force push, and a narrow ignore keeps the full-history scan strict. | Active                  |

## Audit fixes, PR A (2026-09-28)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Reason                                                                                                                                                                 | Status |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D-126 | 2026-09-28 | Server logs go through `apps/web/src/lib/log.ts` only: one JSON line per event (`area.what_happened`), filtered by `LOG_LEVEL` (default `info`), tagged with the `x-vercel-id` request id. A line carries only allowlisted fields (stage, code, status, reason, digest, errorName, route template, projectId, questionId, count, requestId), each a number or a short token; any other field is dropped and any other value becomes `[redacted]`. Error messages, emails, answers and prompts are never logged. `instrumentation.ts` logs every uncaught server error with its digest. ESLint `no-console` covers `apps/web/src` and `packages/ai/src`.                                                                                                                                                                                                                                                                                                                                         | Vercel keeps logs outside the EU (OPEN-QUESTIONS #34), so personal data must not be able to reach them by accident; the digest on an error page leads to its log line. | Active |
| D-127 | 2026-09-28 | Server Action convention (header of `apps/web/src/lib/diagnostic/actions.ts`): an action returns a typed result for every outcome a person can meet, failures included, and logs the failure; it throws only for input no page of ours sends, which `instrumentation.ts` logs with its digest (a form calling through `callAction` shows it as its failure message; any other caller gets the error page). A catch that may cover `redirect()` or `notFound()` calls `unstable_rethrow` first. Forms call actions through `useActionState` and `callAction` (`lib/call-action.ts`, which turns a dropped connection into the failure result), with a disabled button, a working label and a `role="alert"` error; delete dialogs stay open on error.                                                                                                                                                                                                                                            | A failed save or setting must not replace the screen with the error page and lose what the founder entered.                                                            | Active |
| D-128 | 2026-09-28 | Error pages use the existing tokens and components: `(app)/error.tsx` inside the signed-in shell (retry, My projects), `[locale]/error.tsx` with the public header (retry, home), and `global-error.tsx` with its own `<html lang="ar" dir="rtl">` and static Arabic-then-English text copied from `messages/*.json` (`errors`) and checked by a test. Each shows the digest as a reference number and moves focus to its heading. `/[locale]/failure-check` always fails outside production, for the e2e test, and is a 404 on production.                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Owner sign-off on the error pages (existing design language only). global-error cannot use next-intl and must not ship every catalogue to every visitor.               | Active |
| D-129 | 2026-09-28 | A failed answer save returns `gone` (the project was deleted: the editor links to My projects), `stale` (the follow-up no longer applies: the editor links to the overview) or `failed` (anything else: the draft stays for a retry). For `gone` and `stale` the editor does not refresh, so the explanation stays on screen until the founder follows its link. Deleting inactive follow-ups (D-116) is best effort and logged, and loading ignores a follow-up whose trigger no longer holds. When the model's MSA reading does not fit the question, the confirmed answer is saved as typed and logged. Finishing sign-in never fails: on an error the account has no profile yet, so the onboarding gate asks again. The closed-market check (D-068) runs inside `completeOnboarding()`, so the signup cookie path obeys `MARKET_DZ_ENABLED` too.                                                                                                                                           | The one-time sign-in code is already used when onboarding runs; a retry can never fix a stale answer; the kill switch must hold whichever way the answers arrive.      | Active |
| D-130 | 2026-09-28 | Every response sends `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` and `Strict-Transport-Security: max-age=63072000` (the value Vercel already sends on startupbrandname.com, checked 2026-09-28 and 2026-10-03). `includeSubDomains` and `preload` are left to the owner; `payment=` is revisited with PayPal in M7. Competitor websites accept only `http` and `https` URLs to a domain name (`z.url()` with zod's http protocol check and a host check that also accepts Arabic top-level domains in punycode, such as .الأردن, which `z.httpUrl()` refuses), never another scheme, an IP address or a single name such as localhost.                                                                                                                                                                    | Clickjacking protection for the delete dialogs without a nonce, so static pages stay static; reports will render these URLs (M5).                                      | Active |
| D-131 | 2026-09-28 | Navigation feedback. Sign-in comes back to the page that asked for it (`login?next=`, from the `x-sbn-path` header that the proxy overwrites on every request, checked by `safeNextPath` at every hop, kept after a failed Google sign-in; the projects list adds nothing to the address). Sign-in codes typed with Arabic-Indic or Persian digits, spaces or dashes are read as Western digits. `ButtonLink`, `TextLink`, the language switch, the header links, the project titles and the related-question links show a pending state with `useLinkStatus` (`aria-busy` and a thin teal line after 150 ms, no layout change); there are no `loading.tsx` skeletons. While an answer is unsaved, a link to another page of the site opens a "leave without saving?" dialog, and closing or reloading the tab gets the browser prompt; nothing is kept in browser storage. Staying returns focus to the clicked link, or to the answer when that link sat in the menu panel, which has closed. | Owner sign-offs (feedback on links only; the guard without browser storage). A founder whose session expired mid-diagnostic resumes where they were.                   | Active |

## Audit fixes, PR E (2026-09-28)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Reason                                                                                                                                                                                                                                                                                                                                     | Status                  |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| D-132 | 2026-09-28 | `docs/runbooks/operations.md` is the release procedure. It follows the owner's release order of 2026-09-28: production migrates only from `main`, after the owner approves the `db-production` run; a migration only adds; the app works on the previous schema with the feature off; drops and renames come in a later pull request. A migration is never pushed to staging from a branch. A migration that fails on a hosted database is fixed forward: its data or state is corrected with the owner's approval and the run repeated; changing the migration history (a replacement file, `supabase migration repair`) needs the owner's decision first. | Vercel publishes `main` to production at once, so new code must survive the old schema. Staging's history must match `main`, and a merged file may already be applied somewhere.                                                                                                                                                           | Active                  |
| D-133 | 2026-09-28 | The kill switches held in environment variables (`AI_PROVIDER`, `MARKET_DZ_ENABLED`, `AUTH_GOOGLE_ENABLED`, `SITE_INDEXABLE`) take effect with the next deployment. An Instant Rollback serves the restored deployment with the variables it was built with, so a switch set after that deployment is set again by redeploying it and promoting the result. A settings change made by hand that outlives the incident is repeated in a migration and recorded here. The instant AI stop (`ai.limit.global_daily_usd` set to `0`) and the correction of D-123 are recorded in D-143.                                                                         | Vercel applies variables only to new deployments, and a rollback serves an old build. The migrations must stay the record of every settings value.                                                                                                                                                                                         | Active                  |
| D-134 | 2026-09-28 | `pnpm test:e2e` runs only the Playwright `site` project, as the `e2e-smoke` job does. `pnpm test:e2e:auth` runs the `auth` project with the `e2e-auth` job's settings, passed through Playwright's web server, and never reuses a running server. `.env.example` sets `AI_PROVIDER=fake`. Root `pnpm dev` and `pnpm verify` (the `checks` and `db` jobs, in order, with `pnpm db:reset` before the database steps as the `db` job's fresh database) are added; the pre-push hook stays at typecheck and tests.                                                                                                                                              | The old command rewrote the committed share images and ran the sign-in tests without their settings, and a copied example file would call the paid API as soon as a key was added locally. Without the reset, a migration never applied locally would be neither linted nor tested. `verify` is slow and needs Docker, so it stays opt-in. | Amended by D-174, D-192 |
| D-135 | 2026-09-28 | Annotated milestone tags on `main` are the anchors for comparing and reverting: `m2` 7bdc10c, `m2b` 44acb55, `m3a` 933ed3f, `m3b` 77288b0, `m3c` 7c763e9, created by the lead, then one per finished milestone. Going back further than the previous production deployment is a revert pull request until the Vercel team moves to Pro (D-021), which allows an Instant Rollback to any earlier deployment. No CHANGELOG while the README keeps its milestone sections and this log records what changed.                                                                                                                                                   | A changelog would repeat the README and this log; tags give a revert a fixed commit. On Hobby, Instant Rollback reaches only the deployment immediately before the current one.                                                                                                                                                            | Active                  |
| D-136 | 2026-09-28 | Amends D-048: Claude Code and VS Code sessions start only from the WSL clone `~/code/startupbrandname` (VS Code through Remote WSL, recommended in `.vscode/extensions.json`). The retired Windows copy `C:\dev\vivarise-bms` still sits at the M2 merge with a push-capable remote and an old `CLAUDE.md`; archiving it, or disabling its push URL and replacing its `CLAUDE.md` with a pointer, is left to the owner.                                                                                                                                                                                                                                     | An audit session started in the Windows copy and loaded an out-of-date `CLAUDE.md`.                                                                                                                                                                                                                                                        | Open                    |
| D-137 | 2026-09-28 | `docs/privacy/processing-register.md` is the record of processing (GDPR Art. 30); its legal bases and transfer mechanisms are marked for legal review. `docs/runbooks/breach-response.md` is the runbook SPEC §11 requires. Access and portability requests are answered by hand with the SQL in `docs/runbooks/data-requests.md` until M9's self-service export, within one month and only to the account's email address. Breach records and request logs are kept privately, never in this repository. A migration that adds user data updates the export and the register.                                                                              | The repository is public. The facts were spread over D-061, D-065, D-082, D-092 and D-098, and no procedure existed for a request or a breach.                                                                                                                                                                                             | Active                  |
| D-138 | 2026-09-28 | `docs/security/m9-checklist.md` is the checklist of M9's definition of done ("Checklist signed off"). Each milestone appends what it defers, with its source; an item leaves the list only when it is done or a decision drops it. Monitoring and alerting are on it (OBS-3); `CLAUDE.md` §9 is unchanged.                                                                                                                                                                                                                                                                                                                                                  | The deferred security items were scattered over decisions, open questions and the audit.                                                                                                                                                                                                                                                   | Active                  |
| D-139 | 2026-09-28 | With the owner's approval, `CLAUDE.md` rule 5 names `packages/ai/src/deidentify.ts` (D-107) instead of `lib/ai/deidentify.ts`, and `docs/SPEC.md` gains one line pointing to `docs/SPEC-CHANGES.md`, which maps each SPEC section a decision changed. The migrations and `database.types.ts`, not SPEC §8, are the schema's source of truth. Nothing else in either file changes.                                                                                                                                                                                                                                                                           | Both files are owner-authored. SPEC §8 still shows the `users` table that D-086 removed, and rule 5 named a path that does not exist.                                                                                                                                                                                                      | Active                  |

## Audit fixes, PR F (2026-09-28)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Reason                                                                                                                                                                                                                                                                                                                                                                                                        | Status           |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| D-140 | 2026-09-28 | The repository is public by the owner's choice. `main` accepts changes only through pull requests whose six required checks pass; the job names in `ci.yml` are the check names, so a job is renamed only together with the ruleset. The `db-production` environment requires the owner's approval and deploys only from `main`, so production is migrated only from `main`, after the owner approves the run on GitHub; the typed confirmation `migrate production` stays as a second factor. A new push cancels an older CI run on a pull request, never on `main`. Supersedes the premise of D-047 (a private repository cannot have reviewers) and restores the reviewer gate of D-012 and D-046.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Checked live on 2026-09-28: the reviewer and the branch policy exist, while D-047 and the workflow comments still said reviewers were impossible. A cancelled run on `main` would leave a merged commit without a complete result.                                                                                                                                                                            | Active           |
| D-141 | 2026-09-28 | The db job runs `scripts/check-migrations.mjs` on pull requests against the base branch, and on `main` against the commit before the merge. A merged migration is never edited, renamed or deleted. A new migration's version is a real UTC time at most a day ahead and sorts after the newest one on the base. That order holds only when every pull request is tested against the current `main`, which needs strict status checks ("require branches to be up to date") on ruleset 24104610, a GitHub setting for the lead; until then, a migration merged out of order fails the run on `main`, next to the staging push that refuses it. A new migration that drops a table, view, function, type, schema or column, renames something or moves it to another schema, changes a column type, drops a type attribute or truncates a table needs a `-- contract: <reason>` line and belongs in a later pull request, once no deployed code uses the old shape. Statements inside function bodies, strings and comments are not checked. The body of a `DO` block, or of a function or procedure that the migration creates and then calls, is checked with its strings, because it runs with the migration; code the migration runs only indirectly (a trigger, a column default) is not followed. After each push, the DB deploy workflow lists the applied migrations (read-only). Refines the expand/contract rule of D-012. | `supabase db push` applies only versions the database has not recorded, so an edited merged migration passes CI but never reaches staging or production. 20260926140000 dropped a function and two columns in the same commit as the app change. The app must keep working on the previous schema until production is migrated. A mistyped future version would force every later migration to sort after it. | Active           |
| D-142 | 2026-09-28 | Dependabot opens grouped version updates every Monday for npm and GitHub Actions, for releases at least 3 days old; the cooldown does not apply to security updates. `minimumReleaseAge: 4320` in `pnpm-workspace.yaml` stops pnpm from resolving releases younger than 3 days, security fixes included, so an urgent fix resolves only once it is listed in `minimumReleaseAgeExclude` as `name@version` (until it is old enough). pnpm 10.34.5 does not check versions already in the lockfile (tested). pnpm 11.3 and later check them even with `--frozen-lockfile`, unless `trustLockfile` is on (off by default; pnpm's settings documentation, tested with 12.6.0). `scripts/check-playwright-version.mjs` fails the checks job when a Playwright image in the workflows differs from `@playwright/test`. Major updates of `@types/node` are ignored (Node 24, D-023). The tests of both scripts run as a step of the checks job.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Every version is pinned exactly (save-exact, actions by SHA, D-028), so nothing moved unless someone acted. The delay lets the registry pull most compromised releases first. A Playwright bump alone would otherwise pass with browsers from another release (D-055).                                                                                                                                        | Active           |
| D-143 | 2026-09-28 | Correction to D-123: `AI_PROVIDER` is not an instant switch. It is a Vercel environment variable, so a change takes effect only after a redeploy. To stop AI at once, set `ai.limit.global_daily_usd` to `0` in `public.settings`: `reserve_ai_call()` then refuses every new call within seconds, without a deploy (tested in `ai_usage.test.sql`), and the diagnostic keeps to the fixed checks (D-120). Calls already reserved finish.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | In an incident the owner needs the switch that works without a build; D-123's reason promised more than the variable does.                                                                                                                                                                                                                                                                                    | Amended by D-146 |
| D-144 | 2026-09-28 | Two pgTAP guards. `function_guard.test.sql` fails when a SECURITY DEFINER function in `public` or `private` does not set its `search_path`, or when `anon` can run one in `public`; extension functions are skipped. `erasure_guard.test.sql` fails when a foreign key into a table that deleting an account or a project empties (`auth.users`, `public.projects` and every table that cascades from them, at any depth) neither cascades nor sets a nullable column to null, or when a `user_id` or `project_id` column in `public` or `private` has no foreign key into such a table, unless the test's allowlist gives the reason (for example a payment record that keeps its owner's ID for tax law, OPEN-QUESTIONS #31). `ON DELETE SET NULL` passes without an allowlist entry: the row stays but no longer points at the account or the project, so such a table must hold nothing else that identifies the founder. The guard also checks that deleting a project or an account empties `tool_runs` and `usage_counters`. Cross-account tests name their target rows by ID.                                                                                                                                                                                                                                                                                                                                               | Only row level security was guarded. M7 adds voucher, admin and payment functions and tables, and a forgotten `search_path`, grant or cascade would pass CI unnoticed (CLAUDE.md rule 6, SPEC §11). A table that points at `tool_runs` blocks a project deletion just as one that points at the project does.                                                                                                 | Active           |
| D-145 | 2026-09-28 | `SECURITY.md`, in English and Arabic, names GitHub private vulnerability reporting as the only channel until a public contact email exists (OPEN-QUESTIONS #78, #81); `/.well-known/security.txt` follows in M9 with that email. The stated aim is an acknowledgement within 7 days. The policy has no legal safe-harbour clause: that wording waits for the legal review (CLAUDE.md §10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | A public repository needs a private route for reports (OpenSSF Security-Policy). Seven days is realistic for one maintainer, and a legal promise should not be drafted before the legal review.                                                                                                                                                                                                               | Active           |

## Audit fixes, PR B (2026-09-28)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Reason                                                                                                                                                                                                                                             | Status           |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| D-146 | 2026-09-28 | AI runs are recorded against one-time reservations (owner decision; keeps D-077, no secret key). `reserve_ai_run()` returns a reservation and a reason (`ok`, `user_limit`, `global_cap`, `disabled`). `record_ai_run()` needs an unused reservation of the caller from the last 5 minutes, computes the cost from `ai.prices`, refuses an unpriced model, a tool other than `review_text` and an output over 16 KB, and clamps tokens (output to 1500, input with cache tokens to `ai.limit.tokens_in_per_call` = 8000). Each reservation holds the most its call can cost (every input token at the dearest input rate, plus 1500 output tokens) in `held_usd` until the run is recorded, so a call cut off by the time budget, or whose record failed, still counts towards the cap at that most; a fast model without a full price answers `disabled`. Each run adds to `private.ai_spend_daily` (day, model; no user or project key), whose `cost_usd + held_usd` the global cap reads and no deletion lowers; it starts from the runs recorded before, leaving out a run with an empty model and counting no run above 1 USD, so rows forged through the old hole cannot stop the migration. The old `reserve_ai_call()` and `record_tool_run()` stay but signed-in users may no longer run them; a contract migration drops them later. Amends D-124 and D-143 (the instant stop now makes `reserve_ai_run()` answer `disabled`). | Any signed-in user could record a cost of their choosing and close AI for everyone until midnight UTC, deletions lowered the spend the cap and the fair-use measurements read, and the API can bill a call the app never recorded (SEC-1, COST-1). | Active           |
| D-147 | 2026-09-28 | A cross-border consent counts only for a text version listed in `consent.crossborder.accepted_versions` (owner decision: consents to the text that named only the mentor no longer count). `crossborder_consent_state()` answers `current`, `outdated` or `none`; `has_crossborder_consent()` means `current`; `set_crossborder_consent()` records a renewal when the version differs. The consent text names the answer review and the later mentor, says that only the forms the platform recognises are removed first (the account page and the privacy draft list them), and says typed names and numbers that could be amounts are sent as written; `CROSSBORDER_VERSION` is `2026-10-draft-2`, whose wording was corrected before it reached any environment, and `legal.test.ts` pins a hash of the wording to it and checks the migrations list it. The account page shows the text, the state and "Renew my consent"; a typed-answer step shows a short note linking to it. The AI review runs only on `current` from `crossborder_consent_state()`, never on a fallback; until production has the migration, the account page alone compares the latest consent event with `CROSSBORDER_VERSION` itself.                                                                                                                                                                                                                       | GDPR Art. 7 asks for consent to the processing actually done; typed answers had gone to Anthropic under a text that named only the mentor, and the text must promise no more than the code does (PRIV-1, PRIV-2, PRIV-4).                          | Amended by D-191 |
| D-148 | 2026-09-28 | De-identification scope (owner decision): the account's email and the names in the sign-in profile (`full_name`, `name`, `given_name`, `family_name`, each whole, never split into words); any email address (bounded, CodeQL alert 1); phone numbers that start with +, 00 or 0, unless they continue a number written in groups of thousands ("15 000 000"); numbers of 11 to 15 digits without a prefix only after a whole contact word (with its Arabic endings, so "Telecom" or "اتصالات" do not count); `tel:` links and addresses with a path (wa.me, t.me, profiles); IBANs in capitals with at least 10 digits; 10 to 25 digits after an ID word. A number followed by a currency is never replaced, and the negative tests on amounts (grouped ones included), years, counts and market words are mandatory. The A4 sub-label reads "Role or title (no name needed)". Prompts take only the `Deidentified` type, `AiContext.identity` requires the names, and only `packages/ai` may declare the SDK (tested). `REVIEW_PROMPT_VERSION` is `review-text-2`, so each answer is reviewed once more.                                                                                                                                                                                                                                                                                                                               | Rule 5 says strip the name, and the consent promised it, but no name was ever passed and common identifiers went through; a false positive hid an amount, or part of it, from the review (PRIV-2, PRIV-7, TEST-M2).                                | Active           |
| D-149 | 2026-09-28 | Placeholders are numbered (`[phone1]`), and the review comes back to the app in the founder's own words (`restoreReview`), so no placeholder reaches the confirmation text or a saved answer. A rewrite that lost, changed or invented a placeholder is not used: the answer is saved as typed, with no confirmation step. `tool_runs` keeps the de-identified output, with the MSA wording and the confirmation only when the answer was really rewritten.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | A dialect answer with a phone number was saved as "[phone]" after the founder confirmed it, and every earlier wording stayed in the stored outputs (ARCH-M1, PRIV-5).                                                                              | Active           |
| D-150 | 2026-09-28 | One save may spend 8 seconds on AI review in total (owner decision): one `AbortSignal.timeout(8000)` covers the B1 check and the answer review, each SDK request has an 8-second timeout and at most 1 retry, and the signal also cuts any `retry-after` wait. No reservation is made once the budget is gone. When it runs out, the answer gets the fixed checks only. The step page sets `maxDuration = 30`. With a current consent and AI on, the button reads "Checking your answer…" while a typed answer is sent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | A slow API held "Saving…" for a minute or more, with two reviews back to back and no deadline (PERF-1, D-124).                                                                                                                                     | Active           |
| D-151 | 2026-09-28 | An unusable stored output is the result for its input hash until the input, the prompt version or the model changes: no new call. A call that throws or times out is not tried again for the same project and input for 10 minutes; this memory is per server instance and keeps at most 1000 entries. A failed lookup of stored outputs skips the model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | One bad B1 output was paid for again on every later typed answer, and an outage made every save wait out the budget (PERF-2, OBS-2).                                                                                                               | Active           |
| D-152 | 2026-09-28 | Every AI skip is logged as `ai.skipped` with its reason (debug: off, no or outdated consent, no or unclear idea; info: limits, cap, disabled, no settings, unusable output, recent failure, budget spent; warn: timeout, and `previous_schema` while the database does not count consents by version) and every database or model error as `ai.error` with its stage (consent, settings, cache, reserve, model, record) and code, through `lib/log.ts`. Founders are not shown why (owner decision: log only until M6). `/api/health` says `ai: on` or `off` from the provider settings, never why, and AI off does not make it degraded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | When AI turned itself off nothing said why, and the errors were dropped (OBS-2).                                                                                                                                                                   | Amended by D-191 |
| D-153 | 2026-09-28 | Page-view statistics replace every UUID path segment with `:id`, in the browser before sending, without a lookbehind pattern (older Safari versions reject a script that has one).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Each project's ID reached Vercel with its signed-in pages, and one project maps to one founder (PRIV-14).                                                                                                                                          | Active           |
| D-154 | 2026-09-28 | The privacy draft lists projects and answers with the text as typed, the AI review results and daily counters, the IP address and browser type kept by sign-in, and hosting logs; names the review and the forms removed before it; says projects are kept until deleted (until M7), that backups and sign-in records can outlive a deletion, and that the AI cost totals are kept with no link to an account. `PRIVACY_UPDATED` is 2026-10-04. `TERMS_VERSION` becomes `2026-10-draft-2` because the signup box records that the user has read this policy; a changed notice asks nobody to accept it again. The auth audit log (PRIV-15) is kept out of this pull request by the lead's scope for it (no docs but this section, no external dashboards) and is left to the lead: in the Supabase dashboard of staging and of production, check whether Auth audit logs are stored in the database and turn that storage off (preferred, owner decision 8), then record it in `docs/runbooks/auth-setup.md`; if it cannot be turned off, a later migration adds a pg_cron purge after a settings period and deletes the user's entries in `delete_my_account()`, with a pgTAP test.                                                                                                                                                                                                                                                     | The draft named answers "in later milestones" and Anthropic only for the mentor, promised the account page shows "your data", and named no IP data (PRIV-1, PRIV-15).                                                                              | Open             |
| D-155 | 2026-09-28 | Release order for these migrations (D-132): production applies `20261004053500` and `20261004053600` from `main` after the owner approves. An app on the previous schema keeps AI off (`crossborder_consent_state()` is missing, logged as `ai.skipped` with reason `previous_schema`), and so does a database where only the first migration ran; the account page there compares the latest consent event with `CROSSBORDER_VERSION`, so an old consent shows as outdated, and its renewal is recorded once the second migration has run. An app from before this pull request keeps to the fixed checks on the new schema, since `reserve_ai_call()` is closed. A later contract migration drops `reserve_ai_call()` and the old `record_tool_run()`, and the account page's fallback goes with it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | The app and the database deploy separately, each must keep working on the other's previous version, and `supabase db push` commits each migration on its own.                                                                                      | Amended by D-191 |

## Audit fixes, PR C (2026-10-04)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Reason                                                                                                                                                                                                                                                                                                                                                                  | Status |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D-156 | 2026-10-04 | Typed numbers are read by `readNumber` in the question bank, which never guesses. A second number, a mark just before the digits (".5"), a scale word before them («مليون و500»), a dash that is not a minus joined to the digits ("- 5", "–5"), or a lone m or b after them ("1.5M", "20 m": a million or metres) is `ambiguous`, and R3 asks again. Read without asking: Western, Arabic-Indic and Persian digits; thousands grouped by spaces (also U+00A0 and U+202F), by the Arabic ٬, or by "." or "," in two groups or more; the Arabic decimal ٫; a decimal "." of any length; a decimal "," of one or two digits; both marks, the last one being the decimal point; "0.500" as a half; a leading minus. One "." or "," followed by exactly three digits ("1.500", and "1,500", read as 1500 until now) is asked with both readings as two buttons, the pattern of the dinars or centimes question (D-108); the picked reading, like every saved number shown again, is written back without separators by `numberText` in a form read back as itself, so a fraction of three digits gets a trailing zero ("12.125" becomes "12.1250"). A comma before three digits that cannot group thousands ("1500,000"), or before four digits or more, is `ambiguous`. Scale words are applied on the digits, so 1.1k is exactly 1100. Limits in messages are written without grouping. | "1 500" was read as 1, "1.500.000" as 1.5 and "12,5" as 12, silently, and these amounts become engine inputs (UX-2). In French and Algerian usage "1,500" is 1.5; one click to confirm costs less than a wrong amount. A grouped limit such as "1,000" could itself be read two ways. Written back as "12.125", a picked decimal was asked about again and never saved. | Active |
| D-157 | 2026-10-04 | A range picked after R3 stores its middle rounded half up for a whole-number question ("1–2" stores 2, C8's "11–50" stores 31), its exact middle otherwise, and its floor when open-ended; its provenance stays an assumption (D-114). A bank test checks every range of every question against its schema. `saveAnswer` validates the value on its own, not the union with «لا أعرف», so each issue keeps its own code; a fraction on a whole-number question says to enter a whole number.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | The stored 1.5 failed the question's own whole-number check, so the recovery R3 offers failed on every retry; inside the union zod reported every issue as `invalid_union`, which read as "complete the required fields" (UX-1).                                                                                                                                        | Active |
| D-158 | 2026-10-04 | An answer that does not fit its question comes back as `{ path, message }` errors (`items.1.amount`; '' for the whole answer), with messages that state the limit: "from {min} to {max}" (bounds read from the schema by `numberLimits`), "above {min}" for a share of 0%, the most characters, the most items (`maxItemsFor`, which the schema reads too) and "a whole number". The browser's unreadable boxes use the same paths. The editor shows each message under its box with `aria-invalid` and `aria-describedby`, and moves focus to the first box marked wrong. Marks name boxes by row, so adding or removing a row clears them until the next "Next", and the readings question goes once its box changes. An answer made of several boxes also lists the distinct messages below it, including those about the answer as a whole; an answer of one control shows its message under it only. A list hides "Add" at its limit and states the limit. The `SaveResult` reasons of D-129 and the confirmation of D-119 are unchanged.                                                                                                                                                                                                                                                                                                                                        | Errors in lists did not say which row or box was wrong, server errors never set `aria-invalid`, and the editor offered rows the server refused (UX-3, ARCH-M2; WCAG 2.2 SC 3.3.1 and 3.3.3). Marks left after a row went pointed at the next row, and a pick could replace another row's amount.                                                                        | Active |
| D-159 | 2026-10-04 | The feedback below an answer is announced by taking focus only: the area is no live region, it is a group named by its first message and described by the rest (the list of errors, the reading to confirm, further findings and notes), and `RuleAlert` and `FindingList` take `live={false}` inside it. On the overview and in the design gallery they stay polite status messages. A list announces a removed row through its own polite status. The note about a saved «لا أعرف» is hidden while "Next" has something else to say.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Focus moved into a live region whose messages were live regions too, so screen readers could say a message several times (UX-15). Named by its first line only, the group was read without the errors or the reading it was about.                                                                                                                                      | Active |
| D-160 | 2026-10-04 | The warnings about a saved answer are the same right after saving and on every later visit, follow-ups included: after G4.1 = no, G4_no_agreement stays on G4.1 until the answer changes (`stepNotes`). `resolveStep`, `sequenceModeFor`, `findFollowUp` (replacing `getFollowUp`), `MODES` and `modeSchema` in the question bank are the one implementation for the step page, `saveAnswer`, `project.ts` and `steps.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The page and the action computed these separately and disagreed: the warning shown after saving G4.1 was gone on the next visit (ARCH-6). A warning is defined as staying visible until resolved (review.ts), and rule 3 asks for one source of truth.                                                                                                                  | Active |
| D-161 | 2026-10-04 | Each step page has its own title: the position in the version followed, counting core questions only (`positionInMode`), the axis and "Diagnostic" ("السؤال 7 من 20 · الفكرة والمشكلة · التشخيص"), or "Follow-up question", the axis and "Diagnostic"; never the project title. The question's h1 takes focus after a move inside the app only (a mount outside hydration), never on a full page load. A second line gives the overall position "in the quick version" or "in the full version", and the axis line says "in this part"; their digits sit in `<bdi class="num">`. Founder-typed project titles sit in `dir="auto"` spans in the projects list, the overview heading and the step page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Every step had the same title and focus fell to `<body>`, so moving on was silent for screen-reader users (UX-5); the project promised 20 questions while the page counted within the axis (UX-14); "C++ Academy!" drew its "!" on the wrong side under /ar (UX-12). The project title is the founder's text and would travel into browser history and tab lists.       | Active |
| D-162 | 2026-10-04 | In list answers, "Add" moves focus into the new row's first box; removing a row moves it to the title of the row before, or to "Add" when the first row went, and says "Item removed" politely. The sign-in email step shows its `StepHeading` ("Your email"), as signup does, and it takes focus only when the founder comes back from the code step.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | A button that disappears took the focus with it, leaving keyboard and screen-reader users on `<body>` (UX-8).                                                                                                                                                                                                                                                           | Active |
| D-163 | 2026-10-04 | The C2 payer split (`profilePartsFor`), the R2 variant of B4 (`ruleFinding`) and the idea check (B1's `ideaCheck` flag, `ideaQuestion()`) live in the question bank, and the editor, the AI findings and the AI service use them; the review input and its hash do not change. `reviewAmountText` and its `currency_ambiguous` message are removed: every amount has its currency chosen in a list and never read from the typed text, and the centimes question reads `readCurrency` itself (D-108). `isHttpsDeployment()` (`apps/web/src/env/deployment.ts`) reads only `VERCEL` and decides the Secure flag of every cookie; `create_project()`'s limit error is `PROJECT_LIMIT_SQLSTATE`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | The app re-implemented rules the bank already held, and `reviewAmountText` ran only in tests (ARCH-7, ARCH-12); one place per rule keeps the editor and the checks from disagreeing. Reading only `VERCEL` keeps the proxy from parsing the whole server environment for each refreshed session.                                                                        | Active |

## Audit fixes, PR D (2026-10-04)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Reason                                                                                                                                                                                                                                                                                                                          | Status |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D-164 | 2026-10-04 | The web app's unit tests measure v8 coverage of `src/lib`, `src/config` and `src/seo`, without the server Supabase client factory, the generated database types and the Server Action files (`actions.ts`, driven by the end-to-end tests); the proxy's session refresh is measured. The gate is the measured coverage rounded down: 89% of lines, 88% of statements, 85% of functions and 81% of branches when it was added, raised with this pull request's tests to 90, 90, 87 and 83. It is raised as tests are added and never lowered to let a change pass. `errorCodeOf` moved from the `'use server'` file to `lib/auth/errors.ts`. Table tests cover `provenanceOf`, `parseAnswers` (an invalid value, an unknown ID, an inactive follow-up), the step URL of every question and follow-up and back, `errorCodeOf` and the currency list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | The packages require 95% of lines while the web app measured nothing, and the helpers that write provenance (rule 2), decide which stored answers count and choose the sign-in messages had no tests (CICD-7). A `'use server'` file may export only Server Actions.                                                            | Active |
| D-165 | 2026-10-04 | The stored-answer contract: `packages/question-bank/src/contract.test.ts` writes, for every question and follow-up, the field kind, whether «لا أعرف» is accepted and the stored shape (parts, option values, leaf types) to `__contract__/answers.json`; labels, help texts and limits are not in it. The snapshot changes only together with a migration of `answers.normalized_value` or a read-time mapping in the question bank, a test with an answer in the old shape and a decision (`CONTRIBUTING.md`). The value schemas and the test samples are records keyed by field kind, each entry typed against `FieldOf<K>` and `ValueByKind[K]`, and `valueSchema` and `sampleValue` dispatch on the field's kind; the contract snapshot and the draft tests passed unedited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | A saved answer that no longer fits its question is read as missing, so renaming an option value or changing a field kind would silently drop founders' answers (QB-C1). The M4 engine will read answers through `valueOf`, whose types nothing checked (ARCH-4).                                                                | Active |
| D-166 | 2026-10-04 | End-to-end tests prove an absence with a barrier, never a fixed wait: after the deleted address asks for a code, the account test requests one for a fresh control address and waits for it in Mailpit, which receives the local stack's mail in order, then checks that the deleted address got nothing. In CI a test that passes only on its retry fails the run (`failOnFlakyTests`); the one retry stays for its trace. The minute-long waits cite the per-address limit of D-084.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | A 3-second wait passed whenever the mail was merely late, and retries hid flaky tests (CICD-8).                                                                                                                                                                                                                                 | Active |
| D-167 | 2026-10-04 | Fewer round trips on a save. A save with no warning redirects to the next step, or to the overview after the last one, after `revalidatePath`, so Next.js renders that page in the action's response; a save with warnings still returns them with "Continue", and the confirm, invalid, rejected, `gone`, `stale` and `failed` results of D-129, D-149 and D-158 are unchanged. The redirect passes the action's catch through `unstable_rethrow`. `loadProject` reads the project and its answers at once under RLS (the answers of another account's project come back empty, and the project then reads as missing) and is wrapped in React's `cache`, so a page and its metadata share one load. The AI review checks B1 in memory before any query, reads the consent and the settings together (the consent is still judged and reported first), keeps the model and price read for 60 seconds per server instance (`SETTINGS_TTL_MS`) and looks up the stored reviews of the idea and of the answer in one query. Reservations, the ledger, the consent version, the 8-second budget and the logs of D-146 to D-152 are unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Each answer rendered the current step, which was thrown away, and then the next one, and the save made independent database round trips one after another (PERF-3, PERF-4). A timeout signal on every Supabase call ends fetch deduplication, so the shared load needs `cache`.                                                 | Active |
| D-168 | 2026-10-04 | Every Supabase request has a deadline (`lib/supabase/timed-fetch.ts`, the caller's signal joined with a timeout through `AbortSignal.any`): 8 seconds from pages, Server Actions and route handlers, which leaves a typed answer's save, with its 8-second AI budget, inside the step page's 30 seconds; 3 seconds per request from the proxy. The proxy's session refresh as a whole has 4 seconds: past that, the page renders signed out (the session cookies are taken off that request only, never off the browser, which tries again on the next page), a refresh that completes later is ignored, and `proxy.refresh_timeout` is logged as a warning (`stage` `page` or `action`). A Server Action (any POST: pages answer only GET) keeps its session cookies past the deadline and checks the session itself with its own 8-second requests, so a save that Supabase answers late still goes through instead of sending the founder to sign in with the typed answer lost. When Supabase does not answer the action either, `requireAccount` reads the failed check as signed out and sends the founder to sign in, as it already did for any failed check. Accepted: when Supabase rotated the refresh token during an abandoned refresh, the browser's old token may later be refused and the visitor signed out. A request that times out fails like any other, through the results of D-129.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | No Supabase call had a timeout, and the proxy runs before every page a signed-in visitor opens, public pages included, while auth-js retries a failed refresh for up to 30 seconds (REL-4). A page that renders signed out is better than one that never answers; a save that runs signed out loses the founder's typed answer. | Active |
| D-169 | 2026-10-05 | Smaller client payloads. The signup and onboarding forms check their answers in the browser with `checkOnboarding` (`lib/auth/onboarding-check.ts`), the same rules and result without zod; `parseOnboarding` keeps the zod schema for the server (rule 7) and is `server-only`, and a table test checks that both agree on every form, every country offered included. The root `NextIntlClientProvider` sends only `common`, `language`, `theme`, `nav`, `meta`, `footer` and `errors` (the last three because `[locale]/error.tsx` renders the public header, the footer and the error view as client components, where no nested provider reaches): 1,496 B of the 18,692 B Arabic catalogue. `ClientMessages` adds the rest where it is read: the signed-in layout (`account`, `aboutYou`, `auth.errors`, `projects`, `diagnostic`), sign-in (`auth`), signup (`auth`, `aboutYou`), onboarding (`onboarding`, `aboutYou`, `auth.errors`), the not-available page (`aboutYou`) and the diagnostic gallery (`diagnostic`). `client-messages.test.ts` checks each component where a page, layout or boundary renders it: inside a `ClientMessages` it gets the root namespaces and that wrapper's (a nested provider replaces the one above), outside any it gets what the layout above gives its `{children}` (the header and footer of the signed-in layout get the root ones only). It follows the imports to the client components and fails on a namespace one reads and is not given there. Only route files may render `ClientMessages`, so every position is checked. `Tooltip` brings its own provider (300 ms, as before; neighbouring tooltips no longer share the skip delay). A step sends the country list only to `country_city` and the currency list only to `money`, `money_range`, `currency`, `cost_items`, `competitor_prices` and `staff_plan` (`editorLists`, whose test reads the editor's cases). First-load JavaScript, gzipped: home 194,202 B to 175,028 B, signup 298,160 B to 192,178 B, onboarding 296,020 B to 190,298 B, a step 329,276 B to 316,149 B. | Signup and onboarding shipped zod and its locale packs (91 KB gzipped) to check four fields (PERF-15); every page carried the whole catalogue and the tooltip code (PERF-8); every step carried both lists, about 20 KB in Arabic (PERF-7). A missing namespace shows message keys with no type or build error.                 | Active |
| D-170 | 2026-10-05 | Owner sign-off (PERF-6): Tajawal loads weights 400 and 700 only; weight 500 and its two preloaded files are gone, and Cairo is unchanged. Only the internal design gallery's small-text sample used Tajawal 500 (the gallery answers 404 in production); it is now regular weight. Separately, the owner had the signup step counter restyled: bold (700) and teal at the same size (`text-small font-bold text-teal-ink`), since it shows progress, which is teal's functional role. It sits in the step heading, so it is set in Cairo: before, its weight 500 drew as Cairo 600, the nearest weight Cairo loads; it was not a use of Tajawal 500. `teal-ink` (#0b6e8a on light, the brand #1fa3c7 on black) already passes 4.5:1 on paper and surface in both themes (`contrast.test.ts`), so no token was added, and gold is unchanged. Each page preloads 6 font files, 102,528 B (105,897 B over the network in Lighthouse). Only the eight `gallery-*` screenshots of `design.spec.ts` change (no signup screenshot has a baseline); the snapshot workflow regenerates them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Two font files preloaded on every page for one sample on a page users never see. The brand teal as small text on a light background is only about 2.9:1.                                                                                                                                                                        | Active |
| D-171 | 2026-10-05 | The performance budget D-054 promised (PERF-5). (1) `scripts/check-bundle-budget.mjs`, a step of the `checks` job after the build, gzips (level 9) the chunks each route loads first, read from the build manifests (the shared `rootMainFiles`, then the client reference manifest's chunks for the route's layouts, page and boundaries; polyfills and dynamic imports are not counted), and fails over: home 192,500 B, signup 211,400 B, onboarding 209,300 B, a diagnostic step 347,800 B. (2) `lighthouse.mjs` fails a public page whose layout shift reaches 0.1, or that loads more than 213,000 B of script or 116,500 B of fonts over the network (measured: 193,669 B of script on /pricing, 182,702 B elsewhere, and 105,897 B of fonts; layout shift 0; SEO and accessibility 100). Timing scores stay reported only. (3) The end-to-end layout-shift test holds the font files back for a second, checks that they arrived after the first paint and that the shifts add up to less than 0.1, on /ar and /en (0.004 measured locally) and on a diagnostic step in the sign-in project. Every budget is the size measured on 2026-10-05 plus about 10%; it is raised only with a reason here and lowered when a route shrinks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | No budget was enforced, Lighthouse never sees signup, onboarding or the diagnostic, and the old test measured after the fonts had loaded, so a shift on swap could not fail it.                                                                                                                                                 | Active |

## Audit fixes, docs sync (2026-10-05)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Reason                                                                                                                                                                                                                                                                                                                     | Status           |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| D-172 | 2026-10-05 | Every decision table has a Status column. `Active`: in force as written. `Amended by D-xxx`: in force, except for what the later decision changes; read both. `Superseded by D-xxx`: no longer in force; the later decision replaces it. `Done`: a one-time step that was carried out, kept as history. `Open`: decided, but waiting for a step by the owner or the lead that no later entry records as taken, such as a plan upgrade, a review or a dashboard setting; the rest of the row is in force. The column was filled on 2026-10-05 from the later decisions that name a row and from the code on `main`; a row that only names the milestone in which something will be built is `Active`, and so is one that leaves a question to the owner in OPEN-QUESTIONS. A merged row's ID, date, decision and reason never change; its Status changes in the pull request whose decision amends or supersedes it.                                               | Several rows read as current but were not, among them D-001, D-018, D-026, D-059, D-078, D-084 and D-109 (DX-5). An architecture decision record carries a status and points to what replaced it.                                                                                                                          | Active           |
| D-173 | 2026-10-05 | The log opens with "How to read this log" and a topic index of twelve topics: product, plans and vouchers; auth and accounts; markets, countries and languages; diagnostic and question bank; AI and cost; privacy, consent and security; legal; design and accessibility; public site and SEO; performance; CI and repository; release and operations. Every decision is listed under at least one, and a new one joins its topics in the pull request that adds it. From M4 on, a new decision is a `### D-NNN (YYYY-MM-DD): title` heading followed by a list of Decision, Reason and Status; the tables up to D-175 stay as they are. `CONTRIBUTING.md` says the same.                                                                                                                                                                                                                                                                                        | The ten topics the audit proposed left the public site, the plans and the security headers without a home. 171 rows sorted only by date had to be read in full to find every decision on consent or on CI, and Prettier re-pads a whole table whenever one row grows (57f8ad7), which hides the change in the diff (DX-5). | Amended by D-178 |
| D-174 | 2026-10-05 | Corrections where a row and the code on `main` disagree and no later decision said so; the code wins. D-084: the page that tells a visitor from a closed country why is `/not-available` (`notAvailablePath` in `apps/web/src/lib/auth/session.ts`), not `/not-eligible`. D-109: `create_project()` enforces the project limit from the settings row `entitlement.free.projects` (`1`); `plans.test.ts` checks that the migration's value equals `PLANS.free.entitlements.projects` in `apps/web/src/config/plans.ts`, which the projects page reads to show the limit. D-134: `pnpm verify` runs the main steps of the `checks` and `db` jobs, not all of them; it leaves out `node scripts/check-playwright-version.mjs`, the CI scripts' tests (`pnpm exec vitest run --dir scripts`), `node scripts/check-bundle-budget.mjs` and `node scripts/check-migrations.mjs`, which later pull requests added to those jobs but not to the root `package.json` (#92). | The audit found D-084 and D-109 describing code that had changed (DX-5), and the review of this pull request found D-134; a merged row is never reworded, so a new entry corrects it.                                                                                                                                      | Active           |
| D-175 | 2026-10-05 | Personal data in the AI tables of D-146. `private.ai_reservations` holds the account's ID and the time, model and held cost of each AI call, so the data-request runbook exports it with its own query (the table exists only from migration `20261004053500`), the processing register lists it under usage limits, and it is erased with the account (it cascades from `auth.users`). `private.ai_spend_daily` has no user or project key: it is not personal data, is neither exported nor erased, and the register says so. The export of AI reviews also gives each run's prompt version, tokens and cost.                                                                                                                                                                                                                                                                                                                                                   | D-137 asks a pull request that adds user data to update the export and the register, and pull request B added both tables without doing so. The ledger keeps no key so that deletions cannot lower the spend the cap reads; it then identifies no one (#31).                                                               | Active           |
| D-176 | 2026-10-05 | Strict status checks ("require branches to be up to date") are on for ruleset 24104610, read from the GitHub API on 2026-10-05, together with the six required checks and the CodeQL code scanning rule. The condition D-141 waited for holds, so D-141 is Active.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | D-172 keeps a row Open until an entry records the lead's step; this is that entry.                                                                                                                                                                                                                                         | Done             |

## Operations (2026-10-05)

| ID    | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Status |
| ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D-177 | 2026-10-05 | The DB deploy workflow retries `supabase db push` up to 3 attempts, 30 seconds apart, only when the output shows a failure to connect (`SQLSTATE 28P01` or `failed to connect`) and the CLI never printed its push prompt or `Applying migration` (it writes nothing to the database before the prompt). Any other failure stops at once. The step keeps `id: push`, so the migration list after it still runs. The typed production confirmation and the required reviewer (D-140) are unchanged. | The production run of 2026-09-26 and one M0 run failed with 28P01 from the Supavisor pooler at "Connecting to remote database..."; a plain re-run with the same secret succeeded, but each production re-run needs the owner's approval again. A wrong password prints the same error, so it now fails after 3 attempts (about a minute) instead of 1; Supabase bans an IP for 30 minutes after 2 wrong passwords in a row, which only affects the runner's throwaway IP. The messages were checked in the CLI 2.117.0 source and are present in the 2.119.0 binary. First proposed in pull request #2 as D-088, an ID later used for another decision. | Active |

## M4 plan (owner approval, 2026-10-05)

### D-178 (2026-10-05): The M4 plan and its order

- **Decision:** The engine (T7, T8, T9, T10 and the tax engine) is built in `packages/engine` as pure
  functions over typed inputs read from the answers with `valueOf`, in seven pull requests:
  (0) housekeeping (D-191, D-192) and these decisions; (1) money, provenance, the engine's parameters
  and its quality gates (branches 95%, functions 100%, property tests); (2) the three follow-ups of
  D-183 and F4's hint, in the question bank and the app; (3) the adapter from answers to engine
  inputs and the operating lines of the projection: the sales curve, revenue, COGS, operating costs
  and operating profit before tax (T9 without tax and cash); (4) T8 and T7 with their alerts, which
  read that projection (D-182, D-189); (5) tax, cash flow, funding need and payback (the rest of
  T9); (6) T10, the run function, the three golden projects (a Jordanian service, a Jordanian home
  e-commerce shop, an Algerian auto-entrepreneur) with hand-checked headline numbers, and a review
  page for the owner. Pull requests 0, 1 and 2 touch different files and can be built at the same
  time; the others follow in order, each on the one before. Founders see no engine figure before
  M5. Each pull request merges after an independent review and the six checks. The topic index
  gains "Calculation engine" (amends D-173).
- **Reason:** Owner approval of the M4 plan on 2026-10-05, including merging each pull request after
  review and green checks. The approved plan had six pull requests, with T7 and T8 before T9. But
  BE_month and T7's floor read the projection (D-182, D-189), so T9 is split in two: an ordering
  change, not a change of any formula. CLAUDE.md §8.1 and the M4 definition of done (CLAUDE.md §9).
- **Status:** Active

### D-179 (2026-10-05): Money precision and rounding

- **Decision:** Inside the engine, money is an integer number of the currency's minor unit (the ISO
  4217 exponent: 3 for JOD, 2 for DZD and USD), held as a `bigint`. An answer's amount, stored in
  major units, is converted once at the engine's boundary and rounded half away from zero to the
  minor unit if it has more decimals. Rates and multipliers are exact decimals, never binary
  floating point. An amount times a rate is rounded half away from zero to the minor unit on each
  monthly line; quarterly, yearly and three-year totals are sums of the rounded lines, so every
  table adds up. Ratios such as CM% stay unrounded inside the engine and are rounded only for
  display. Amounts leave the engine as minor units in safe integers.
- **Reason:** #54. JOD has three decimals, and a projection multiplies amounts by growth, seasonal
  and tax rates many times; floating point would make totals that do not add up and results that
  differ in the last digit.
- **Status:** Active

### D-180 (2026-10-05): One calculation currency per project

- **Decision:** The engine calculates in the project's currency (`projects.currency`, chosen by the
  founder, D-111). An amount in another currency stops the calculation with a message that names the
  question and the item; nothing is converted (D-113). An Algerian project with amounts in DZD
  therefore calculates in DZD. A report in another currency than the amounts (for example USD for a
  DZD project) is a display conversion with a dated rate, decided with #16 and #21.
- **Reason:** #22. SPEC §7 asks for Algerian calculations in DZD and F8 lets the founder choose the
  report currency; converting needs a dated rate source that does not exist yet.
- **Status:** Active

### D-181 (2026-10-05): Provenance of computed figures

- **Decision:** Every engine figure carries the provenance of CLAUDE.md rule 2. Its source is `user`
  when all its inputs are the founder's real answers, `assumption` when any input is an «لا أعرف»
  answer, a picked range (D-157), the engine's own estimate (D-183) or an engine default (D-184,
  D-187, D-189), and `external` when an input is a country-pack or tax value. Its confidence is the
  lowest of its inputs, and it is validated only when every input is. Each figure lists the answer
  IDs, defaults and rules it used, so the report can say where a number comes from.
- **Reason:** CLAUDE.md rule 2, and the report's rule that a low-confidence pivotal number is
  highlighted (SPEC §6).
- **Status:** Active

### D-182 (2026-10-05): Fixed costs and break-even

- **Decision:** T8's fixed cost FC is a month's full fixed cost: F4, plus the payroll of the E8
  staff who have started, plus the F4.1 marketing budget. BE_units = ceil(FC / CM) uses month 12's
  fixed cost, the steady state. BE_month is the first projection month whose operating profit
  before tax is zero or more, so T8 and T9 agree. F4's hint asks the founder to leave out the
  salaries of the staff listed in E8, so payroll is counted once.
- **Reason:** #43. SPEC's FC = ΣF4 for break-even and F4 + payroll + marketing for T9's operating
  costs gave two break-evens for one project.
- **Status:** Active

### D-183 (2026-10-05): Three follow-ups for the engine, and no AI estimates

- **Decision:** Three follow-ups, each accepting «لا أعرف»: F4.1 after F4, the monthly marketing
  budget (an amount in the project currency); F2.1 when F2 is "subscription", how many of every 100
  subscribers cancel each month; F6.1 after F6, the yearly growth of sales the founder expects
  after year 1 (a percentage). «لا أعرف» to F4.1 counts marketing as 0 with a visible note; to F2.1
  leaves out LTV and LTV/CAC; to F6.1 uses the engine's estimate: half the founder's own growth from
  month 6 to month 12, made yearly, between 0% and 25% a year (the upper bound is a setting) and
  never above E7's capacity, with year 3 growing by half of year 2's rate. For a subscription, ARPU
  is F1 and CAC is the marketing budget divided by the month's new customers. The follow-ups do not
  change the 64 core questions or completeness (D-105), and they add to the stored-answer contract
  without changing any stored answer (D-165).
- **Reason:** Owner decisions, 2026-10-05, resolving #44 and the years 2 and 3 part of #45. The owner
  first asked for an AI estimate of the growth; CLAUDE.md rule 1 forbids a model to produce a number
  that appears in a report, and the owner then chose to ask the founder first, with an estimate
  computed by code as the fallback.
- **Status:** Amended by D-197

### D-184 (2026-10-05): The sales curve and seasonality

- **Decision:** Units for months 1 to 12 pass through F6's three points. Between two points the
  monthly growth rate is constant when both are above zero, and the change is linear when one of
  them is zero. With D7 seasonal, peak months get a factor of 1.5 (a setting) and the other months
  a factor that keeps the year's total unchanged; F6's points are taken as already seasonal and are
  divided by their month's factor before the curve is drawn. Month 1 is the calendar month after
  the run's reference date, which the caller passes in (the engine reads no clock), so peak months
  fall on the right calendar months. Years 2 and 3 grow from month 12's level by D-183's yearly rate,
  compounded monthly, with the same seasonal factors. Units never exceed E7 in a month; a capped
  month is flagged.
- **Reason:** #45 and #46. SPEC gives three points and peak months but no curve or factor.
- **Status:** Active

### D-185 (2026-10-05): Inflation

- **Decision:** From year 2, COGS and fixed costs (F4, payroll and marketing) rise each year by the
  country's yearly inflation, an external country-pack value with its source and date (M5). Selling
  prices do not rise, which keeps the projection conservative. Until a verified value exists for the
  country, no inflation is applied and the projection says so.
- **Reason:** #47. SPEC escalates COGS only; fixed costs rise with prices too, and an unverified rate
  may not be used (CLAUDE.md rules 8 and 9).
- **Status:** Active

### D-186 (2026-10-05): The tax engine

- **Decision:** A tax rule (SPEC §8 `tax_rules`, extended) has a regime, a basis (turnover, profit or
  a fixed amount), brackets (up to an amount, at a rate) for progressive taxes, a minimum, the
  regime's turnover ceiling, the month of the following year when it is paid, its currency, the date
  it takes effect, its source URL and the date it was last verified. Social contributions (for
  example CASNOS in Algeria and social security in Jordan) are rules of the same shape. The engine
  picks the regime from the country, G1 and the year's turnover; G1 "not sure yet" uses the
  sole-proprietor regime and says so (T17 compares legal forms in M5). Turnover above a simplified
  regime's ceiling raises SPEC's alert, and a regime without a rule is reported as not calculated.
  Tax accrues in the year's profit and is paid in cash in the rule's month of the following year.
  Sales tax and VAT are not calculated in the MVP: turnover above a registration threshold raises an
  alert. The engine holds no rate: rules come from `tax_rules`, filled from official sources with
  dates in M5 (CLAUDE.md rule 8). Tests and the golden files use fixture rules marked unverified,
  including the Algerian auto-entrepreneur values of SPEC §7; the golden files are checked again
  when the verified rules arrive.
- **Reason:** #48 and #5. SPEC's flat-rate `taxDue` cannot express brackets, minimum contributions or
  when the tax is paid, and Algeria's rules are only verified in M5.
- **Status:** Active

### D-187 (2026-10-05): When the cash comes in

- **Decision:** F7 sets when a sale's cash arrives: cash in the month of the sale; credit the month
  after; instalments in three equal monthly parts from the month of the sale; a deposit half in the
  month of the sale and half the month after. These are engine defaults (settings), shown as
  assumptions. Set-up costs (F5) are paid in month 0, before month 1.
- **Reason:** #49. SPEC names F7's options but not their delays.
- **Status:** Active

### D-188 (2026-10-05): Payback

- **Decision:** Payback is the number of months, counted from month 1, until cumulative cash after
  tax, set-up costs included, is back at zero or above. When that does not happen within the 36
  months of the projection, the engine reports "not within 3 years" instead of a number.
- **Reason:** #50. SPEC's S / average monthly net profit after BE_month leaves out the losses before
  break-even, so it shows payback sooner than the cash allows.
- **Status:** Active

### D-189 (2026-10-05): T7's floor and T10's delay

- **Decision:** T7's floor is VC plus the average monthly fixed cost of months 1 to 12, divided by the
  average monthly units of months 1 to 12 of the base projection. T10's launch delay shifts sales by
  three months, while fixed costs, payroll and marketing start as planned and set-up costs stay in
  month 0. SPEC §4's T10 multipliers are engine defaults (settings), shown as assumptions.
- **Reason:** #51 and #52.
- **Status:** Active

### D-190 (2026-10-05): Comparing answers of different kinds

- **Decision:** F5 is compared with A5 only in the same currency: above A5's maximum it raises the H3
  alert, and between A5's minimum and maximum it gives a softer note. A7 and H5 compare BE_month
  with the upper bound of the chosen bucket (A7: 3, 6 or 12 months, and no limit for "more than 12";
  H5: 6 to 36 months, and no limit for "more than 36"), so an alert means the limit is surely
  exceeded.
- **Reason:** #41.
- **Status:** Active

### D-191 (2026-10-05): Contract migration for the old AI functions

- **Decision:** Production applied `20261004053500` and `20261004053600` on 2026-10-05 (DB deploy run
  37307284095, checked by the lead), and the served production deployment is built from `main`
  after pull request B. A contract migration drops `reserve_ai_call()`, the old `record_tool_run()`
  and `has_crossborder_consent()`, and the app drops its previous-schema paths: the account page's
  own consent comparison in `accountConsentState` and the `previous_schema` skip. An Instant
  Rollback to a deployment from before pull request B would then run with AI off, since its calls
  fail closed.
- **Reason:** #89 (amends D-155): the old functions are the expand half of D-146 and D-147.
- **Status:** Active

### D-192 (2026-10-05): `pnpm verify` matches the CI steps

- **Decision:** `pnpm verify` runs every step of the `checks` and `db` jobs that needs no Docker,
  including the four that D-174 found missing: `check-playwright-version`, the script tests, the
  bundle budget and `check-migrations`.
- **Reason:** #92 (amends D-134): a contributor who runs `verify` should not meet a failure that only
  CI shows.
- **Status:** Active

### D-193 (2026-10-10): Rates are exact fractions

- **Decision:** A rate (growth, a seasonal factor, a tax rate, a multiplier, CM%) is a `Rate` in
  `packages/engine/src/rate.ts`: a fraction of two `bigint`s in lowest terms with a positive
  denominator, so equal values are structurally equal. It is read from a decimal string or from a
  stored number's shortest decimal form (`parseRate`, `rateFromNumber`: 0.1 is 1/10, not the nearest
  binary fraction). Adding, subtracting, multiplying, dividing and raising to an integer power are
  exact. A rate is rounded only for display (`rateToDecimalString`, half away from zero) and when it
  multiplies an amount (D-179). Text over 400 characters, exponents beyond 400, powers beyond
  10000 and any power whose result would pass 20000 digits (`MAX_POWER_DIGITS`, counted from the
  larger of the base's numerator and denominator times the exponent) are refused, so the cost of an
  input is bounded by its size and not only by its exponent.
- **Reason:** D-179 asks for exact rates. A fraction needs no choice of scale, and later pull
  requests divide (the seasonal factor that keeps a year's total unchanged, D-184; ARPU over churn,
  D-183) where a scaled integer would have to round. The cost is that denominators grow when rates
  compound, to about 150 digits over 36 months, which is negligible.
- **Status:** Active

### D-194 (2026-10-10): Currency exponents and the reading of a stored amount

- **Decision:** `packages/engine/src/currency.ts` holds an explicit ISO 4217 exponent for each of
  the 162 codes of `Intl.supportedValuesOf('currency')`, the list that `currencyOptions` in the app
  and `isCurrencyCode` in the question bank offer. The engine cannot import from `apps/` (D-005), so
  the codes are copied, and a test fails when the runtime offers a code the table lacks; pull request
  3 adds a test that imports both packages. The table follows ISO 4217, not ICU: 17 codes differ
  (IQD has 3 where ICU says 0; AFN, ALL, COP, HUF, IDR, IRR, KPW, LAK, LBP, MGA, MMK, PKR, SLL, SOS,
  SYP and YER have 2 where ICU says 0), listed in `ISO_AND_ICU_DIFFER` and checked by a test against
  `Intl.NumberFormat`. XDR and XSU have no ISO exponent and take 2. An unknown code raises
  `unknown_currency`; nothing defaults. A stored major-unit number is converted through its shortest
  decimal text, once, rounding half away from zero when it has more decimals than the currency, so
  0.1 + 0.2 is 0.3 and 1.005 is 1.01 in a two-decimal currency. NaN and the infinities are refused.
  `moneyToSafeMinor` raises `unsafe_integer` beyond `Number.MAX_SAFE_INTEGER` in either direction.
- **Reason:** D-179 and CLAUDE.md §3 (a currency is never inferred). ICU follows everyday cash
  practice, which would drop the fils of an Iraqi dinar price; ISO is the standard the payment and
  tax records use. Reading the typed decimal, not the binary neighbour, gives the amount the founder
  meant.
- **Status:** Active

### D-195 (2026-10-10): Figures and engine parameters

- **Decision:** A `Figure<T>` is a value with `source`, `confidence`, `validated` and `inputs` (a
  list of references of kind `answer`, `default`, `rule` or `country_pack_item`, without repeats).
  Combining figures takes the weakest source, ranked assumption over external over user (D-181),
  the lowest confidence, validated only when every input is, and the union of the inputs; combining
  none raises `empty_input`. A stored answer maps with `figureFromAnswer`: a real answer keeps its
  stored provenance, a picked range is an assumption (D-157), «لا أعرف» is an unvalidated
  low-confidence assumption with no value (D-104). `EngineParams` holds every default of D-183,
  D-184, D-185, D-187, D-188 and D-189 as a figure with source `assumption`, confidence `medium`,
  not validated, and a stable key in `PARAM_KEYS`. A payment timing is a list of parts (months
  after the sale, exact share) whose shares add up to 1. Inflation is `null` by default (D-185).
  `createEngineParams` replaces whole figures, so an override carries its own provenance, and
  raises `invalid_param` naming the key when a value is out of range, when a rate was not built
  with `makeRate` (not in lowest terms, or a non-positive denominator), or when an override key is
  not a known parameter (a misspelt key is an error, not a silent default). `DEFAULT_ENGINE_PARAMS`,
  `ZERO_RATE` and `ONE_RATE` are frozen.
- **Reason:** D-181. Medium confidence follows D-114: a documented default is a considered estimate,
  not evidence, and low would highlight every number in every report. The report lists the defaults
  from `listEngineParams`.
- **Status:** Active

### D-196 (2026-10-10): The projection calendar and the engine's quality gates

- **Decision:** `buildProjectionCalendar(referenceDate, horizonMonths)` takes the reference date as
  a `YYYY-MM-DD` string (no clock, no time zone, D-005). Month 1 is the calendar month after it,
  months 1 to 12 are monthly columns and each later year is four quarterly ones, so the 36-month
  default gives 20 columns. The horizon is a multiple of 12 from 12 to 120. Month 0, where set-up
  costs fall (D-187), is not in the calendar. `sumByPeriod` sums rounded monthly lines into the
  columns. The engine's `vitest.config.ts` fails below 95% of statements, lines and branches and
  below 100% of functions. Property tests (fast-check 4.10.2, a dev dependency) check that rounding
  is symmetric around zero, that rounded monthly lines add up to the total at every level, that
  major to minor to major is exact, and that rate arithmetic is exact. Every export is named and
  documented with its units, currency handling and rounding. `ENGINE_VERSION` stays at 0.1.0 until
  pull request 6.
- **Reason:** CICD-14 and DX-14. CLAUDE.md §5 gates only lines, and a branch or a function no test
  reaches is how a wrong formula ships. D-178 and D-184 for the calendar.
- **Status:** Active

### D-197 (2026-10-10): The growth follow-up is F6.2

- **Decision:** The follow-up for the yearly growth of sales after year 1 (D-183) is F6.2, not F6.1.
  F6.1, the justification for a more than tenfold growth, already exists, so after F6 the order is
  F6.1 then F6.2. F6.2 is a number from 0 to 1000, decimals allowed; a decline is not modelled, so its
  hint says to enter 0 for no growth. F4.1 (the monthly marketing budget, an amount with its currency)
  and F2.1 (how many of every 100 subscribers cancel each month, a number from 0 to 100, decimals
  allowed, only when F2 is "subscription") keep their names. Each of the three appears only when its
  parent has a real answer (not «لا أعرف»), and is removed when that stops being true (D-116). F4's
  help now asks to leave out the salaries of the staff listed in E8 (D-182). The texts are drafts for
  the owner's review (#86).
- **Reason:** D-183 named the growth question F6.1 by mistake; that ID is taken, and reusing it would
  have changed what a stored F6.1 answer means (D-165).
- **Status:** Active

### D-198 (2026-10-10): The three follow-ups are asked in the full diagnostic only

- **Decision:** F2.1, F4.1 and F6.2 are asked only in the full diagnostic, never in the quick one,
  which keeps its 20 questions. `FollowUp` gains an optional `modes` (every mode when absent), and
  `diagnosticSequence` respects it. A follow-up is still reachable by its URL and saves in a quick
  project; moving on from it then follows the full order (D-117). When an answer is missing, the
  engine uses its fallbacks with a visible note (D-183). The owner can reverse this by removing
  `modes` from the three.
- **Reason:** The quick diagnostic is promised as 20 questions (UX-14); marketing, churn and growth
  are numbers a founder in a hurry may not have.
- **Status:** Active

### D-199 (2026-10-10): «لا أعرف» on a follow-up, and typed access to follow-up answers

- **Decision:** `FollowUp` gains an optional `allowUnknown` (false when absent), which `resolveStep`
  and the stored-answer reader use in place of the fixed false; only F2.1, F4.1 and F6.2 set it, so
  every older follow-up is unchanged. An unknown answer is stored like any other (assumption, low
  confidence, not validated, D-104) and creates a validation task: `validationTasks` now lists the
  follow-up, so a task's `questionId` is a step ID. The stored-answer contract (D-165) gains the three
  follow-ups; no stored answer changes. For the engine, `followUpValueOf` reads a follow-up's real
  answer typed by its field (and throws on a wrong kind, like `valueOf`), and `answerState` tells a
  real answer, «لا أعرف» and no answer apart. Completeness is unchanged: follow-ups never count (D-105).
- **Reason:** D-183 asks for «لا أعرف» on these three; the engine must tell "the founder does not know"
  from "not asked", since the first uses a fallback with a note and the second a missing input.
- **Status:** Active

### D-200 (2026-10-11): The adapter from stored answers to the engine input

- **Decision:** `engineInputFrom(answers, provenance, project)` in `packages/engine/src/input.ts` is
  pure. `answers` is the question bank's `Answers`; `provenance` is the stored source, confidence
  and validated of each step ID, which the adapter passes on and never works out again; `project`
  is `{country, currency, mode, referenceDate}`. It returns `ok` with an `EngineInput`, or
  `not_calculable` with every reason it found, in the order the adapter reads the answers (D4, F1,
  F3, F4, F4.1, E8, F6, F6.2, D7, E7, F5), each a question ID (null for a project setting), a code
  and the row at fault: `invalid_project` (a currency the engine does not know, or a reference date
  that is no date), `missing_answer` and `unknown_answer` (F1, F3, F4 and F6 must be real answers:
  D-110 names F3 and F4, and F6 is the sales forecast the projection is made of), `currency_mismatch`
  (an amount outside the project currency, D-180, with the currency found), `invalid_value` (NaN,
  infinite or negative, or an E7 that is not a whole number) and `no_price` (D-201). F5 is not
  required here although D-110 names it for the full-report gate: the projection does not use it,
  so an unknown or missing F5 gives `setupCosts` null and a note `setup_costs_unset`, and pull
  request 5 (payback and funding need, D-187 and D-188) decides there what that means for the runs
  that need it. The currency rule covers every amount the adapter reads, including D4, F4.1, E8 and
  F5, not only those the projection uses: nothing is converted, one rule is easier to explain to a
  founder than several, and a competitor price in another currency therefore also stops a run that
  would not have used D4 (the owner may relax this for D4 once T7 exists). F3, F4 and F5 are sums of
  their items in minor units; F6 and F6.2 are exact rates. A step with no stored provenance counts
  as an unvalidated low-confidence assumption, a picked range as an assumption (D-157) and «لا
  أعرف» as D-104 says, all through `figureFromAnswer`. An unknown or missing F4.1 is zero marketing,
  F6.2 is the engine's estimate (D-205), E7 is no cap, E8 is no staff and D7 is no season, whichever
  of the two it is: each is an unvalidated low-confidence assumption listed as that answer ID in the
  figures that use it, with a note `{code, questionId, state: 'missing' | 'unknown'}` that the report
  can show. D4, F2, F5 and F7 are carried for later pull requests and are null when not answered.
- **Reason:** D-110, D-180, D-181 and D-183. Treating a missing optional answer like «لا أعرف» keeps
  one rule for provenance (what the engine did not get from the founder is an assumption, CLAUDE.md
  rule 2) and one visible note. A quick diagnostic never asks F4.1 or F6.2 (D-198), so its lines
  carry the assumption honestly rather than looking more certain than they are.
- **Status:** Active

### D-201 (2026-10-11): An unknown F1 takes the median of the known D4 prices

- **Decision:** When F1 is «لا أعرف», the price is the median of the D4 prices that are known and in
  the project currency; for an even count it is the mean of the two middle prices, rounded half away
  from zero to the minor unit. Competitors whose price is unknown are skipped. The price is an
  assumption of low confidence, not validated, with the inputs F1, D4 and the rule
  `F1.d4_median`, and a note `price_from_competitors`. Without a known D4 price the result is
  `no_price`. A D4 price in another currency stops the run (D-200) instead of being skipped, and is
  then reported as `currency_mismatch` alone, not also as `no_price`. An F1
  that was never answered is `missing_answer`: the fallback is for «لا أعرف», not for silence.
- **Reason:** D-110 and SPEC F1 ("unknown → range from D4"). T7 shows the whole band (pull request 4);
  the projection needs one price, and the middle of what competitors charge is the least arbitrary.
- **Status:** Active

### D-202 (2026-10-11): Units are whole numbers, and how the capacity cuts them

- **Decision:** A month's units are its level (an exact rate) times its seasonal factor, rounded half
  away from zero (D-179) to a whole number, then cut to E7 when there is one. A month counts as
  capped only when the rounded units were above the capacity: 30.3 units against a capacity of 30
  rounds to 30 and is not a cut. The founder's three points are met exactly: a point is divided by
  its month's factor before the curve is drawn and multiplied back after, so without a cap months 1,
  6 and 12 equal F6 whatever D7 says. Revenue and COGS are whole units times minor-unit amounts, so
  they need no rounding; only a rate (inflation, D-205) rounds, once per month on each line.
- **Reason:** D-179, D-184. Selling a fraction of a unit is not something a founder can plan;
  rounding at the last step, not at each step of the curve, keeps the error under half a unit.
- **Status:** Active

### D-203 (2026-10-11): A yearly rate applied month by month, with integer roots

- **Decision:** Between two positive levels the level changes by one constant monthly factor, the
  n-th root of their ratio (D-184): five steps from month 1 to 6, six from 6 to 12 and twelve for a
  year of growth, where the ratio is `1 + yearly rate`. `rateRoot` computes it with `bigint`
  arithmetic only: the integer n-th root (Newton's method) of the ratio times 10^(18 n), rounded
  down, so the factor is an exact rate with denominator 10^18 and lies below the true root by less
  than 10^-18. A step's level is the start times the factor to the power of the step, exact. The
  last step of each segment is set to the segment's end, not computed, so the three F6 points and
  every year end (month 24 is month 12 times `1 + g`) are exact. For growth (a root of at least 1)
  twelve monthly steps fall short of the yearly rate by less than 12 parts in 10^18, which a test
  checks. For F6 segments the factor can be below 1 and the relative error then grows as it shrinks,
  but for any realistic ratio a month stays off by far less than a thousandth of a unit, so a rounded
  unit can differ from the exact result only at an exact half. When one of the two levels is zero
  the level changes by the same amount each month. No floating point is used anywhere in the curve.
- **Reason:** D-179 (no binary floating point) and D-184 (a constant monthly rate). A monthly step
  of `g / 12` would not reach the yearly `g`, and a floating-point root could differ by platform.
  18 decimals cost microseconds and leave room for any unit count E7 allows (10^8).
- **Status:** Active

### D-204 (2026-10-11): The seasonal factors

- **Decision:** `seasonalFactors(peakMonths, peakFactor)` gives each peak month (calendar months 1
  to 12) the engine parameter `seasonality.peak_factor` (3/2) and every other month
  `(12 - peaks * peakFactor) / (12 - peaks)`, so the twelve factors always add up to exactly 12 and a
  seasonal year sells what a flat one does. With no peak month, or with all twelve, every factor is
  1. When `peaks * peakFactor` reaches 12 (eight peak months at 3/2) the other months would get a
     factor of zero or less, which is no seasonal pattern: every factor is 1, the kind is
     `too_many_peaks` and the projection adds the note `seasonality_ignored`. A month named twice counts
     once; a month outside 1 to 12 raises `invalid_param`. Month 1 of the projection is the calendar
     month after the reference date, so the same factors return in each year on the same calendar
     months.
- **Reason:** D-184 gives the peak factor and the "unchanged total" but not what to do when the
  peaks fill the year. Zero sales in a quarter of the year, on the strength of a tick-box, would be a
  worse mistake than ignoring the pattern.
- **Status:** Active

### D-205 (2026-10-11): The growth estimate, the years after 3, and the lines of the projection

- **Decision:** The estimate of D-183 works on the de-seasonalised levels of months 6 and 12. The
  six-month growth is `L12 / L6 - 1`; the engine keeps `growth.founder_share` (1/2) of it, makes it
  yearly by squaring `1 + kept growth` (two six-month periods), and holds the result between 0 and
  `growth.upper_bound_yearly` (25%). If `L6` is zero there is no ratio: a positive `L12` takes the
  bound and zero stays zero. Year 2 grows by the estimate and year 3 and later by the estimate
  times `growth.year3_share_of_year2` (1/2); an F6.2 the founder gave applies unchanged to every year
  after the first, because the share halves the engine's guess, not the founder's number. This
  clarifies D-183 and D-184 without changing either. `projectOperatingLines(input, params)` returns
  units, revenue, COGS, gross profit, fixed costs, payroll, marketing, operating costs and operating
  profit, each with its monthly values, its calendar columns (sums of the months) and its provenance
  (D-181). A line's provenance covers the whole series, so an unknown F6.2 lowers the confidence of
  every units, revenue, COGS and profit line, years 2 and 3 included. The same holds for E7 and D7:
  "no cap" and "no season" are assumptions made for a founder who gave no answer, so units and every
  line built on them are assumption and low confidence, and the notes `capacity_unlimited` and
  `seasonality_unset` say why; this is intended, not an oversight. Payroll counts a person from
  their start month. Inflation applies from year 2 only when the caller's `inflationRate` has a
  value: the year's factor `(1 + i)^(year - 1)` multiplies COGS (units times the variable cost, one
  rounding), fixed costs, payroll and marketing, each rounded half away from zero on its own monthly
  line; the price never rises, and with no rate the note `inflation_not_applied` says so (D-185).
- **Reason:** D-183, D-184, D-185 and D-182. Per-line provenance is what the report needs to
  highlight a pivotal low-confidence number (SPEC §6); splitting a series by year would give the
  reader three confidences for one row.
- **Status:** Active

### D-206 (2026-10-11): What the adapter reads for T8 and T7, and two new parameters

- **Decision:** `engineInputFrom` also reads F2.1 (`churn`, a monthly rate; read only when F2 is
  "subscription", so a stale answer after F2 changed is ignored), A5 (`capital`, a money range), A7
  (`runway`) and H5 (`breakEvenTarget`). A7 and H5 become a `MonthLimit`: `within` with the upper
  bound of the chosen option (A7: 3, 6 or 12; H5: 6, 12, 18, 24 or 36), `unbounded` for the top
  option ("more than 12 months", "more than 36 months") and `unset` for a missing or unknown
  answer. An unknown or missing F2.1, A5, A7 or H5 is left unset with a note
  (`churn_unset`, `capital_unset`, `runway_unset`, `break_even_target_unset`) and the figure or
  alert that needs it is not evaluated. An A5 in another currency than the project's does not stop
  the run: it is left unset with the note `capital_other_currency` (carrying the currency) and
  nothing is converted (D-113, D-190); it is the only money amount the adapter reads that way. A
  value the question bank cannot produce (an A7 or H5 option it does not offer, an F2.1 outside 0
  to 100%, a negative, non-finite or reversed A5 range) is not a gap: like every other unreadable
  answer it stops the run with `invalid_value`. Two parameters join `EngineParams`: `pricing.penetration_floor_factor` (1.1, SPEC §4) and
  `unit_economics.ltv_cac_minimum` (3, SPEC §4), so no threshold is a literal in a formula.
- **Reason:** D-183, D-190, D-200 and CLAUDE.md rule 8: a threshold is configuration. A foreign A5
  currency is a comparison that cannot be made, not a reason to refuse the whole analysis.
- **Status:** Active

### D-207 (2026-10-11): The T8 result, its blocked case and the break-even month

- **Decision:** `unitEconomics` returns `blocked` when CM = P - VC is zero or negative: it carries
  only CM and CM% (null for a zero price), and no break-even, fixed cost, LTV or CAC is computed
  (SPEC F3); the alert `cm_not_positive` blocks. Otherwise it returns `ok` with CM, CM%, FC (the
  full fixed cost of month 12 from the projection: F4, the payroll of the staff started by then and
  F4.1, D-182), `BE_units = ceil(FC / CM)` (whole units, exact), `BE_rev = FC / CM%` (one rounding,
  half away from zero, to the minor unit) and `BE_month`. `BE_month` is the first month, counted
  from 1, whose operating profit before tax in the projection of D-205 is zero or more, so that T8
  and T9 agree. When no month of the 36 reaches it the figure is `null` ("not reached"), never a
  guess or month 37. A subscription adds the figures of D-208. Limit: because it is the first
  month at zero or more, a project that falls back into loss later (a hire, a seasonal trough)
  still has a `BE_month`; the report must show the operating-profit line next to it.
- **Reason:** D-179, D-181, D-182. A null that the report words as "not reached within 36 months"
  is honest; extrapolating beyond the horizon would invent a number (CLAUDE.md rule 9).
- **Status:** Active

### D-208 (2026-10-11): LTV, CAC and the new customers of a subscription

- **Decision:** For F2 "subscription", ARPU is the price, LTV is CM / churn (equal to
  ARPU x CM% / churn), rounded once to the minor unit. The new customers of month 12 are
  `units(12) - units(11) x (1 - churn)`, an exact number that is not rounded to whole customers;
  CAC is the F4.1 marketing of month 12 divided by it, rounded once. LTV / CAC is an exact ratio
  taken from the unrounded values. A figure that cannot be defined is `null` and the result lists
  the reason in `gaps`: `churn_unset` (F2.1 unknown or missing: no churn, LTV, CAC or ratio),
  `churn_zero` (no LTV, nobody leaves), `no_new_customers` (the new customers are zero or less: no
  CAC), `no_marketing` (the budget is zero: CAC is zero and the ratio has no divisor). The LTV / CAC
  alert needs the ratio and so is silent in every gap.
- **Reason:** D-183 asked for this definition to be recorded. Month 12 is the steady-state month
  D-182 uses for the fixed cost, and the churn-adjusted difference is the customers who did not
  come from the existing base. Not rounding the count avoids a CAC that jumps with a unit.
- **Status:** Active

### D-209 (2026-10-11): The T7 price positions

- **Decision:** `pricing` returns the floor, the band, the penetration price, the market price and
  the premium. Floor = VC + (the sum of the fixed costs of months 1 to 12) / (the sum of the units
  of months 1 to 12), which equals VC plus the ratio of the two averages (D-189); the full fixed
  cost of D-182 is used and the quotient is rounded once, half away from zero. With no unit in year
  1 the floor is `null` (`no_units`). The band is the minimum, median and maximum of the known D4
  prices, in the project currency (a price in another currency is refused by the adapter, D-200;
  the function throws `currency_mismatch` if one reaches it). Penetration = the larger of
  floor x `pricing.penetration_floor_factor` and the minimum of D4, computed from the exact floor
  and rounded once, not from the rounded floor; market = the median of D4. With no known D4 price
  the band, penetration and market are `null` (`no_competitor_prices`) and the floor still works. The premium is the top of the band, offered only when the caller passes
  `premiumAllowed: true` (default false) to say the D5 answer passed rule R5; the engine does not
  run R5 and the premium lists R5 among its inputs.
- **Reason:** D-189 and SPEC §4. The question bank owns R5, so the engine takes its verdict as an
  input instead of duplicating the rule.
- **Status:** Active

### D-210 (2026-10-11): The alerts of T8 and T7

- **Decision:** `economicsAlerts` returns typed alerts (code, severity, the measured value, the
  limit, an optional lower limit and the provenance of the inputs), never text, in this order:
  `cm_not_positive` (block); `break_even_units_above_capacity` (warning, BE_units above E7);
  `break_even_month_above_target` (warning, against H5) and `break_even_month_above_runway`
  (warning, against A7); `setup_costs_above_capital` (warning, F5 above A5's maximum: the H3
  funding alert) and `setup_costs_within_capital_range` (note, F5 above A5's minimum and not above
  its maximum); `price_below_floor` (warning, F1 below the floor); `ltv_to_cac_below_minimum`
  (warning, the ratio below `unit_economics.ltv_cac_minimum`). A limit is checked only when it is
  surely exceeded (D-190): a break-even month above the bucket's upper bound raises it, and so does
  a break-even not reached in the 36 months when the bound is inside the horizon (the measured
  value is then `months_after` 36); a top bucket and an unset answer have no bound and raise
  nothing. While the contribution margin is not positive no alert that needs a break-even is
  evaluated. F5 and A5 are compared only in the same currency.
- **Reason:** D-190 and SPEC §4: the report and the mentor branch on a code and word the sentence
  in the user's language, and an alert must never overstate what the answers prove.
- **Status:** Active

### D-211 (2026-10-11): The tax rule contract and how the regime is picked

- **Decision:** `TaxRule` in `packages/engine/src/tax.ts` is the shape of the future `tax_rules` table
  of M5: id, country code, legal form (`sole` or `company`), regime, levy (what is paid under the
  regime, for example IFU or CASNOS), kind (`tax` or `social_contribution`), basis (`turnover`,
  `profit` or `fixed`), a flat rate or marginal brackets (up to an amount, at a rate; the last is open)
  or a fixed amount, a minimum, the regime's turnover ceiling, the payment month (1 to 12), the
  currency, the date it takes effect, the source URL, the date it was last verified and a status
  (`verified` or `unverified`). The engine holds no rate (CLAUDE.md rule 8): the caller passes the
  rules in a `TaxContext` with an optional VAT registration threshold (a figure with its
  provenance). A malformed rule stops the run with `invalid_param`. `taxDue` follows SPEC §4: a turnover
  basis uses the year's turnover, a profit basis the larger of the profit and zero, a fixed basis its
  amount; brackets are marginal and their parts are added exactly and rounded once, half away from
  zero (D-179); the minimum applies whenever the rule has one, also to a year with no turnover or
  profit. The regime comes from the country and G1: the rules of that country and legal form that
  take effect on or before the run's reference date, a newer rule of the same levy replacing an older
  one, also when it renames the regime, and only then are the regimes of the remaining rules compared
  (two rules of one regime and levy taking effect on the same day are a data error; two regimes
  taking effect on the same day are ambiguous). A VAT threshold that is negative or in another
  currency than the project's stops the run with `invalid_param`, like a malformed rule. G1 "not sure yet" or missing is the sole
  proprietor, flagged by `legalFormAssumed` and the note `legal_form_assumed_sole` (unvalidated
  low-confidence assumption); G1 is an input of every tax figure and of the ceiling alert, so the tax,
  the cash flow, the funding need and the payback built on an assumed regime are assumptions too; a G1 the question bank does not offer stops the run. No rule, rules of
  several regimes (the engine does not choose) or rules in another currency than the project's (D-180)
  give `not_calculated` with the reason, never a guessed tax, and the alert
  `tax_regime_not_calculated`. Every tax figure is `external` and lists the rule as a
  `country_pack_item`; it is validated with high confidence only when the rule is `verified`, so a
  fixture or unverified rule shows (D-181). Three warnings, typed like D-210 but with the projection
  year and the regime: `turnover_above_regime_ceiling` (a year's turnover strictly above the lowest
  ceiling of the regime), `turnover_above_vat_threshold` (strictly above the caller's threshold) and
  `tax_regime_not_calculated`. VAT itself is not calculated.
- **Reason:** D-186 and CLAUDE.md rules 8 and 9. Keeping the regime and the levy apart keeps CASNOS and an
  income tax apart and lets a new rule replace an old one without editing it. Choosing between
  regimes belongs to T17 in M5, not to a guess here. Tests and the golden files use fixture rules
  marked unverified, including the Algerian auto-entrepreneur values of SPEC §7 (0.5%, minimum
  10,000 DZD, ceiling 5,000,000 DZD).
- **Status:** Active

### D-212 (2026-10-11): When tax is paid, and the tax of year 3

- **Decision:** Tax accrues on each projection year (months 1 to 12 are year 1, not a calendar year,
  D-184) from that year's turnover and operating profit before tax. A rule's payment month is a month
  of the next projection year: the tax of year `y` is paid in projection month `12 x y + payment month`.
  With the 36-month horizon the tax of year 3 falls in months 37 to 48. It is left out of the cash
  flow, so it is in neither the funding need nor the payback; the cash flow reports it as
  `taxAfterHorizon` and the note `tax_after_horizon`. When no regime could be calculated the cash flow
  is made without tax, flagged by `taxIncluded: false` and the note `tax_not_calculated`, instead of
  being not calculable: countries without verified rules (every country but Jordan and Algeria at
  first, D-066) still get the funding need and the payback, before tax and saying so. A rule that
  takes effect after the reference date is not applied to later years of the same run.
- **Reason:** D-186 ("paid in the rule's month of the following year") and the projection of D-184,
  whose years begin at month 1. Calendar-year tax periods would split every year of a run in two
  and need the real tax calendar of each country, which M5 will bring with the rules.
- **Status:** Active

### D-213 (2026-10-11): The timing of cash receipts and payments

- **Decision:** Set-up costs (F5) are paid in month 0, before month 1; COGS and operating costs are
  paid in the month they arise (no supplier credit); receipts follow F7 with the timings of D-187
  (cash in the month of the sale, credit the month after, three monthly instalments from the month
  of the sale, a deposit of half and half). A sale is split over its parts so that they add to the
  sale exactly: every part but the first gets its share rounded down, and the first gets the
  remainder, so 1,000.000 JOD in three instalments is 333.334, 333.333 and 333.333, and a deposit of
  1,001 fils is 501 and 500. This is a floor, not D-179's half-away rounding, because a split must
  not create or lose a minor unit. Receipts after the last month are left out of the cumulative cash
  and reported as `receiptsAfterHorizon` with the note `receipts_after_horizon`. An F7 that is missing
  or not an option the engine knows is cash on sale, an unvalidated low-confidence assumption with
  the note `payment_assumed_cash`. An F5 that is missing or «لا أعرف» makes the cash flow
  `not_calculable` with the reason `setup_costs_unset` and the state (D-200 left this to this
  decision); the projection, T8, the tax and the break-even and profit of the FX test stay available.
- **Reason:** D-187 and D-200. Hiding the remainder in the last part would make the first instalment
  smaller than the others, which is not what a founder invoicing the first part expects. Cash is the
  least surprising reading of a missing F7, and the note makes the assumption visible.
- **Status:** Active

### D-214 (2026-10-11): The FX test

- **Decision:** D6 reads into `foreignShare`: "yes" with a percent above 0 is that percent as an exact
  rate; "no", "yes" with 0 percent, a missing or an unknown D6 gives none (the last two with the note
  `foreign_exposure_unset`), and an answer the question bank cannot produce (a yes without a percent,
  a percent outside 0 to 100) stops the run. With a share, `fxTest` makes the projection, the tax and
  the cash flow again for each shock of the engine parameter `fx.cogs_shocks` (default -20%, -10%,
  +10%, +20%; each at least -100%, at most ten). Shocked COGS is `COGS x (1 - share) + COGS x share x
(1 + shock)`, which is COGS multiplied by `1 + share x shock`, on COGS only: fixed costs are not
  shocked. The multiplier is applied together with the inflation of the year, so a monthly line is
  rounded once; `projectOperatingLines` takes it as the option `cogsMultiplier` (an exact rate of 0 or
  more, listed as the rule `T9.cogs_multiplier` in the inputs of COGS when it is not 1), which pull
  request 6 uses for the variable-cost scenarios. Without the option, or at 1, every result and
  provenance is what it was. For each shock the test reports the break-even month (the first month
  with an operating profit of zero or more, one function shared with T8, D-207), the funding need
  (null if the cash flow needs F5) and the operating profit before tax of year 1.
- **Reason:** SPEC §4 T9 ("if D6 > 0: COGS at ±10% and ±20% FX") and the brief of this pull request.
  Rounding once keeps the line independent of the order of the two factors, and the shocks are a
  documented default like the T10 multipliers (CLAUDE.md rule 10).
- **Status:** Active

### D-215 (2026-10-11): The funding need and the payback

- **Decision:** Cumulative cash starts at zero before month 0, so it is minus the set-up costs after
  month 0 and the cash after tax of each month adds to it up to month 36. The funding need is the
  absolute value of the lowest cumulative cash over months 0 to 36, and zero when it never goes below
  zero; the first month with the lowest value is reported with it. The payback of D-188 is read as
  the month after the last month, from 0 to 36, in which the cumulative cash is below zero: the
  number of months counted from month 1 until the cash is back at zero or above _and stays there_
  to the end of the 36 months. It is 0 when the cash was never below zero, and null, shown as "not
  within 3 years", when it is still below zero in month 36. A recovery followed by a new loss does
  not count: the project would need cash again, and the first time the sum touches zero would show a
  payback sooner than the cash allows, which D-188 rejects.
- **Reason:** D-188 and SPEC §4 T9. "Is back at zero or above" is ambiguous for a cash flow that
  dips again (a tax paid in month 16 after the cash had recovered in month 10); the reading that
  needs the cash to stay is the conservative one and is easy to explain.
- **Status:** Active

### D-216 (2026-10-11): The surface of the cash analysis

- **Decision:** `analyseCash(input, projection, context, params)` returns the tax analysis, the cash
  flow (ok, or not calculable for F5), the FX test (or null) and the tax alerts. The tax alerts are
  their own type, `TaxAlert`, not members of D-210's `Alert`, because they carry a projection year,
  a regime and a gap; the run function of pull request 6 merges the two lists. `CashAnalysis.alerts`
  is the same list as `tax.alerts`: merge one, not both. Each cash line is a
  `ProjectionLine` (months 1 to 36 and the calendar columns); the cumulative cash is a figure with 37
  entries, the entry at index `m` being the cash after month `m`. `ENGINE_VERSION` stays 0.1.0 until
  pull request 6 sets 1.0.0. For M5, the `tax_rules` table of SPEC §8 needs, besides its listed
  columns, the legal form, the levy, the kind, the brackets, the fixed amount, the payment month and
  the status of `TaxRule`.
- **Reason:** The same composition as `analyseEconomics` (D-190) keeps the run function a thin
  caller, and a typed contract for the table now saves a migration later.
- **Status:** Active

### D-217 (2026-10-11): The projection adjustments and the launch delay

- **Decision:** `projectOperatingLines` takes one exact `ProjectionAdjustments` object
  (`ProjectionOptions` stays as an alias): a sales multiplier, a price multiplier, a COGS multiplier
  (D-214, unchanged), a fixed-cost multiplier and a launch delay in months. A missing option or one at
  its identity (1, or 0 months) leaves every result and every provenance exactly as before, which the
  existing tests prove; a negative multiplier or a delay that is not a whole number of months stops
  the run with `invalid_param`. The sales multiplier is applied to the unrounded level times the
  seasonal factor, and the product is rounded once to whole units, half away from zero (D-179); E7's
  capacity still cuts the result, so a scenario cannot sell more than the business can serve. The
  price multiplier scales each monthly revenue line (units times price, rounded once). The
  fixed-cost multiplier scales D-182's full fixed cost, which is F4, the payroll of the staff who
  have started and the F4.1 marketing, each rounded once on its monthly line together with the
  inflation. The launch delay shifts the whole units series, seasonality included, later by that
  many months: the first months sell nothing, the last months of the series fall beyond the horizon
  and are dropped, and the capacity flags move with the units. Fixed costs, payroll and marketing
  start as planned, and the set-up costs stay in month 0 (D-189). Each adjustment in use is listed as
  a rule (`T9.sales_multiplier`, `T9.price_multiplier`, `T9.fixed_cost_multiplier`,
  `T9.launch_delay`) in the inputs of the lines it changes, and in the lines built on them.
- **Reason:** SPEC §4 T10 and D-189. Rounding the units once, before the cut to capacity, keeps a
  scenario's units whole and within E7. Moving the seasons with the sales is the simplest reading of
  "shift the sales later", and the delayed launch then meets the seasons of its own months (this is
  listed for the owner in open question #93).
- **Status:** Active

### D-218 (2026-10-11): The scenarios and the tornado of T10

- **Decision:** `scenarioAnalysis(input, context, params)` in `packages/engine/src/scenarios.ts`
  reruns the projection, the tax of the context and the cash flow, and not the FX test, for three
  scenarios. The conservative scenario multiplies the units by `scenario.conservative.sales_factor`
  (0.6) and the variable cost by `scenario.conservative.vc_factor` (1.1) and delays the launch by
  `scenario.conservative.launch_delay_months` (3), all together; the base scenario is the founder's
  numbers; the optimistic scenario uses `scenario.optimistic.sales_factor` (1.3) and
  `scenario.optimistic.vc_factor` (0.95) with no delay. Each reports the break-even month (the one
  function T8 and the FX test use, D-207, null when no month of the horizon reaches it), the funding
  need (D-215; `not_calculable` with the F5 reason when the cash flow is, D-213) and the operating
  profit before tax of projection year 1. `tornadoAnalysis(input, params)` moves the price, the
  variable cost, the sales and the fixed cost each alone by minus and plus `scenario.tornado_swing`
  (20%, a new engine parameter) and reads the same year-1 operating profit before tax at each end.
  The fixed cost is D-182's full fixed cost (F4, the payroll of the staff who have started and F4.1).
  The swing of a variable is the absolute difference between its two ends; the rows are ranked by
  it, widest first, and equal swings keep the order price, VC, sales, fixed costs. The top variable
  (the first T18 experiment) is the widest one, and null when no variable moves the profit. Every
  figure lists the parameters it used as assumptions (source `assumption`, validated false) and the
  rule `T10.scenario` or `T10.tornado`.
- **Reason:** SPEC §4 T10 and D-189. The year-1 profit before tax is the measure SPEC names; tax
  is left out of the tornado so that a rule that is only a fixture does not decide the ranking, and
  the funding need of a scenario still includes it through the cash flow. The hand-checked vector
  of the tests is a flat curve of 400 units, price 10, VC 4 and fixed costs 1,000.
- **Status:** Active

### D-219 (2026-10-11): The canonical serialiser

- **Decision:** `canonicalJson(value)` and `serialiseRun(run)` in `packages/engine/src/serialise.ts`
  write a value as stable JSON text: a `bigint` as its decimal digits in a string, a rate (an
  object of exactly a `num` and a `den` bigint) as `"numerator/denominator"` in a string, keys
  sorted by their UTF-16 code units (no locale), a key whose value is `undefined` left out, and one
  newline at the end. Containers that hold only scalars stay on one line when they fit in 100
  characters, the rest are written one entry to a line with two spaces of indent. Only whole
  numbers are written: a float, NaN, a class instance, a function or a symbol stops with the new
  error code `unserialisable`. There is no parser and no input hash: M5 stores the text and reads
  the run from its inputs again.
- **Reason:** The golden files and the stored tool runs of M5 must be byte-stable on any machine, so
  nothing may depend on a locale, a time zone, `Intl` or floating point.
- **Status:** Active

### D-220 (2026-10-11): The run function and its merged alerts

- **Decision:** `runEngine(answers, provenance, project, tax, overrides, pricingOptions)` in
  `packages/engine/src/run.ts` is the one entry point M5 calls. It makes the engine parameters
  (`createEngineParams`, so an override out of its range throws `invalid_param` first), reads the
  answers (`engineInputFrom`) and returns either `not_calculable` with the adapter's reasons or
  `ok` with an `EngineRun`: the `ENGINE_VERSION`, the input and its notes, the parameters used
  (`listEngineParams`), the operating projection, T8, T7, the cash analysis (tax, cash flow with
  its funding need and payback, FX test; without the alerts, which are in the one list below), the
  scenarios, the tornado and `alerts`. `alerts` holds the alerts of T8 and T7 (D-210) and of the tax
  engine (D-211), each once, each marked `origin: 'economics'` or `'tax'`, ordered block, then
  warning, then note, each group by alert code in plain code-unit order, and alerts of the same
  code in the order they were raised (the sort is stable): the economics alerts first, then the tax
  alerts by year. `mergeAlerts` is exported for M5. The run is pure and deterministic: the same
  arguments give a deeply equal result, and a test proves it. `cash.tax.alerts` is the tax view's
  own copy of the tax alerts and appears in the serialised run; a reader takes the alerts from
  `alerts` only and never merges `cash.tax.alerts` into it again.
- **Reason:** D-216 asked the run function to merge the two lists once. A fixed order lets the report
  and the mentor branch on the list and keeps the golden files stable.
- **Status:** Active

### D-221 (2026-10-11): ENGINE_VERSION 1.0.0

- **Decision:** `ENGINE_VERSION` is `1.0.0` and lives in `packages/engine/src/version.ts` (so that
  the run function can read it without a cycle through `index.ts`, which still exports it). It is
  the engine M4 completes: T7, T8, T9 with its tax, cash flow and FX test, T10, and the run
  function. A search of the repository for `0.1.0` finds it outside `packages/engine` only in
  `docs/DECISIONS.md` (D-196 and D-216, which say it stays 0.1.0 until this version) and nowhere in
  code. From now on it is bumped whenever an output can change, and the golden files show the
  change as a diff.
- **Reason:** D-178 and D-216.
- **Status:** Active

### D-222 (2026-10-11): The golden projects and golden files

- **Decision:** Three golden projects are fixtures in `packages/engine/src/golden-projects.ts`: a
  Jordanian software service sold as a monthly subscription (JOD; F2 subscription, F2.1 churn, F4.1
  marketing, a payroll in E8, LTV and CAC; paid in cash; a company), a Jordanian home e-commerce shop
  (JOD; imported goods so that D6 gives an FX test; a seasonal D7; G1 not sure, so its tax figures
  are assumptions; paid in three instalments) and an Algerian auto-entrepreneur (DZD; the SPEC §7
  levy of 0.5% of turnover with a minimum of 10,000 and a ceiling of 5,000,000, unverified; turnover
  crosses the ceiling in year 3 only; paid by deposit). Each is answers with provenance, a project
  context, a tax context and the reference date 2026-10-05. Their inputs are round: a flat, linear
  or exactly doubling curve, so that every headline number has a hand computation written next to
  it (year-1 revenue and operating profit, the contribution margin, break-even units, revenue and
  month, the tax of year 1, the funding need and its month, the payback, and LTV, CAC and the price
  floor where they exist), and `golden.test.ts` asserts that the engine equals it. The shop is also
  run under each of the four F7 options with hand-checked funding need, month and payback, so
  together the fixtures use cash, credit, instalments and deposit, and both payback outcomes
  (recovered within three years in projects 1 and 3, not within three years in project 2). The tax
  rules of the fixtures are artificial: source `https://example.invalid/fixture`, status
  `unverified`, no verification date, and a name that says fixture; the Jordanian rates are made up
  and imply no real rate (CLAUDE.md rules 8 and 9). The scenarios, the tornado, the FX test, the
  alerts and the minimum and ceiling of the Algerian levy are pinned in the same test. The whole
  `EngineRun` serialised (D-219) is `packages/engine/golden/<name>.json`. The golden test compares
  the engine's text with the file; when the environment variable `UPDATE_GOLDEN` is set it rewrites
  the file instead (`UPDATE_GOLDEN=1 pnpm --filter @sbn/engine test`), so that a changed formula
  shows as a diff to read and accept on purpose. The test throws when `UPDATE_GOLDEN` is set while
  `CI` is set, so a rewrite can never hide a changed number in a workflow. The golden files and the
  review page are listed
  in `.prettierignore`, and ESLint does not lint JSON or HTML.
- **Reason:** CLAUDE.md §8.3 and §9 (M4: golden-file tests for three sample projects), D-178. A test
  that rewrites its own expectation by default would hide a change, so the rewrite is explicit.
- **Status:** Active

### D-223 (2026-10-11): The owner review page

- **Decision:** `docs/engine-review/index.html` is one self-contained HTML file rendered from the
  three golden runs by the pure function `renderReviewPage` in `packages/engine/src/review-page.ts`.
  It is a document for the owner, not an app route: nothing in `apps/web` changes, and founders see
  no engine figure before M5. It is Modern Standard Arabic, right to left, with the English term in
  parentheses at its first use, Western digits and arithmetic isolated in `bdi`, the currency label
  after the number (`د.أ` for JOD, the ISO code DZD where no symbol is agreed), the brand colours
  only (black, gold for the key numbers on a black chip, teal for focus and link underlines), light
  and dark themes through CSS tokens, WCAG 2.2 AA contrast (checked in a test), a visible focus
  ring, tables that stack at 360 px, no script and no request to anywhere. For each project it
  shows one sentence, the founder's inputs in words, the headline numbers each next to its hand
  computation and a mark that the engine agrees, the three scenarios, the ranked tornado, the FX
  table and the four payment options where the project has them, the alerts that fired with their
  reason and provenance, and what the engine read differently from the answers; it ends with the
  engine's assumptions and opens with a banner saying these are sample projects with unverified
  fixture tax rules and no advice. The golden test compares the file with the render, and
  `UPDATE_GOLDEN` rewrites it, like the golden files. A bracket without its partner inside a
  number run stays outside the isolate, so a pair of brackets is never split between the left-to-right
  isolate and the right-to-left text (a test checks every isolate on the page).
- **Reason:** D-178: the owner reviews the engine's numbers and wording before M5 puts any of it in
  front of a founder.
- **Status:** Active

### D-224 (2026-10-11): Smaller decisions of the last M4 pull request

- **Decision:** `packages/engine/tsconfig.json` now has `types: ["node"]` (like `packages/ai`) so
  that the golden test can read and write files. Because the type checker no longer refuses Node
  built-ins, the ESLint rule for the engine's source files (everything but `*.test.ts`) now bans
  every built-in module by its exact name, taken from `node:module`, and the Node-only globals
  `Buffer`, `require`, `__dirname`, `__filename`, `setImmediate` and `queueMicrotask`, besides the
  bans it already had. The error code `unserialisable` joins `EngineErrorCode`. `golden-projects.ts` and `review-page.ts` sit in `src` so
  that they are tested and covered, and are not exported from `index.ts`: they are fixtures and a
  document, not engine API. A new engine parameter, `scenario.tornado_swing`, is listed by
  `listEngineParams` after `fx.cogs_shocks`.
- **Reason:** Keeping the fixtures next to the code they test keeps the coverage gate honest, and
  keeping them out of the public surface keeps M5 from depending on them.
- **Status:** Active

### D-225 (2026-10-11): The M5 plan and its order

- **Decision:** M5 is built in eight steps, in this order, each a pull request reviewed
  independently and merged after the six checks and CodeQL, under the merge rule the owner gives for
  M5: (0) the PDF spike, which decides a Vercel function or a render worker; (1) data foundations
  (`tax_rules`, `country_pack_items`, `reports`, the `reports` bucket, an engine-run recorder,
  entitlement checks); (2) the verdict, confidence and T18 logic in the engine (1.1.0); (3) the
  canvases T1 and T2; (4) country data and T17; (5) the summary and the report on screen; (6) the PDF;
  (7) AI wording and the English pass. The owner approves four print pages as an HTML mock before step 5. The working plan is `docs/M5-PLAN.md`.
- **Reason:** CLAUDE.md §8.1 and §9; the owner's approval on 2026-10-11 (the plan page, four answers
  and three clarifications). The spike comes first because CLAUDE.md §5 requires Arabic PDF rendering
  to be proven before anything is built around it; the canvases come before the country data so that
  the owner can use a screen early.
- **Status:** Active

### D-226 (2026-10-11): Deterministic first, AI wording last, and the number guard

- **Decision:** Every M5 output (canvases, summary, report, PDF) is complete without AI, because an
  account without the cross-border consent keeps every non-AI feature (D-062). AI only rewrites
  wording, in step 7, from computed numbers it is given, for paying users with consent and quota; the
  free summary uses deterministic text. A number guard (`guardNumbers`) compares every numeric token of
  a model reply, in Western or Arabic-Indic digits, with the numbers that were sent; one extra number
  rejects the reply and the deterministic text is used. Replies are cached in `tool_runs` by input
  hash, rendered as text only, and the founder's text enters a prompt as quoted data.
- **Reason:** CLAUDE.md rules 1, 4, 5 and 9; D-062.
- **Status:** Active

### D-227 (2026-10-11): The feasibility score and the verdict

- **Decision:** The engine adds `feasibility` and `verdict`. The score is the share of applicable
  criteria that pass, each of equal weight: unit margin above zero; break-even within 36 months;
  break-even within the patience of H5; break-even within the runway of A7 (as the T8 alert reads
  it, D-190); funding need within the capital of A5; set-up costs within A5; price not below the T7
  floor; LTV/CAC of at least 3 (subscriptions only); break-even in the conservative scenario; payback
  within 36 months; break-even units within E7. A criterion whose inputs are missing is left out, and
  the report shows how many were evaluated. Blockers: unit margin of zero or less; no break-even
  within 36 months in the base case; a funding need above twice the largest capital of A5 when H3
  names no outside source (loan, investor, grant or competition). `go` needs a score of 75% or more,
  no blocker and a project confidence (D-229) of medium or high; `stop` is any blocker; `revise` is
  everything else. The thresholds (75%, 2, 36) are engine parameters, labelled assumptions. The score
  is not a probability of success, and the report says so. Wording: امضِ / عدّل / توقّف, where توقّف
  is always «غير قابل للتنفيذ بصيغته الحالية» with three changes (D-228); in English Go / Revise / Stop
  and "Not viable in its current form" (#74: the owner may change it).
- **Reason:** The owner's decision of 2026-10-11 (fixed rules, a 75% line, suggested changes),
  CLAUDE.md §3 and rule 1. The criteria are the T8 and T10 alerts read as pass or fail, so the
  verdict adds no second source of truth. Resolves #55 (the verdict).
- **Status:** Active

### D-228 (2026-10-11): The changes that would change the verdict

- **Decision:** `suggestChanges` in `packages/engine/src/changes.ts` searches, deterministically and
  within a budget of engine evaluations (a parameter), for changes of the founder's own numbers that
  remove the blockers and, where it can, lift the score to the threshold. Levers: price (first up to
  the largest competitor price of D4; above it only as a premium that needs a measurable difference
  under T7's rule R5, shown as a prompt to strengthen the value and not as a number), variable cost
  (down to half), fixed cost as D-182 defines it (down to half), sales (up to double) and set-up costs
  (down to half). It tries single levers by bisection to a rounded value, then pairs of levers, and
  returns the three smallest relative changes for `stop` and up to three for `revise`; each has the new
  value, the relative change, and the resulting score and verdict. When fewer than three changes work
  inside the bounds for `stop`, the remaining places are the largest drivers of the tornado, listed as
  "rethink these" without target values. Every number comes from the engine. It runs on demand and is
  cached by input hash, not inside `runEngine`.
- **Reason:** CLAUDE.md §3 (exactly three changes for stop); the owner's decision that a suggested
  price must fit market basics and otherwise the value must change.
- **Status:** Active

### D-229 (2026-10-11): Overall confidence, the three numbers and the risks

- **Decision:** Overall confidence is the share of five pivotal figures (price F1, variable cost F3,
  fixed costs F4, set-up F5, sales F6) whose confidence is medium or high: 75% or more is high, 50% or
  more is medium, below that is low. The three numbers of the executive summary are the funding need,
  the break-even month and the operating profit of year 1 before tax. The three risks are taken in this
  order: blockers, then warnings (by the tornado rank of the variable they concern), then notes, then
  the least confident pivotal figures, and the founder's own worry (H6) when the list is short; each is
  a template sentence with the numbers of the alert. Low-confidence pivotal numbers render highlighted
  with «هذا الرقم افتراض، اختبره قبل أن تبني عليه قراراً.»
- **Reason:** CLAUDE.md rules 2 and 9; SPEC §6. Resolves #55 (confidence and the three numbers).
- **Status:** Active

### D-230 (2026-10-11): The validation plan T18

- **Decision:** The assumptions are the four tornado variables (price, variable cost, sales, fixed
  costs). Confidence maps low 1, medium 2, high 3 from the answers behind each; the score is
  (4 − confidence) × (5 − rank), rank 1 being the most sensitive, so low confidence and high
  sensitivity score highest. The founder's own biggest worry (H6) takes the first place when it is
  answered; the other places go to the highest scores (ties by rank, then the order P, VC, sales,
  fixed costs), three in all. Each experiment comes from a fixed library keyed by variable, with a
  metric, a success threshold, a fallback and a cost described in words (your time, a small amount of
  cash, a supplier quote), never an invented amount. Thresholds are protocol defaults, shown as such
  and editable by the founder. The engine returns the plan data; the wording is deterministic until
  step 7.
- **Reason:** SPEC §5 (T18) and §1 (H6 first); CLAUDE.md rule 9. Resolves #53.
- **Status:** Active

### D-231 (2026-10-11): The canvases and two-way binding

- **Decision:** `packages/report/src/canvas/` holds the map from answers to blocks and pure
  builders. Business Model Canvas: customer segments from C1, C2 and B3; value propositions from B1,
  B2, D5 and C3; channels from C7, E1 and D1; customer relationships from the new follow-up C7.1;
  revenue streams from F1, F2 and F7; key resources from E3, A3 and E6; key activities from E2 and E1;
  key partners from E5, E4 and A4; cost structure from F3, F4, F4.1, F5 and E8 with the engine's totals.
  Lean Canvas: problem from B2 and B4 (existing alternatives from D3); customer segments from C2 and
  B3; unique value proposition from B1 and D5; solution from B1 and E1; channels from C7 and D1; revenue
  streams from F1, F2 and F7; cost structure as above; key metrics from H2 and H1; unfair advantage
  from B8. A cell shows one chip per source answer or line item, each with its provenance mark and a
  link to its question. Editing a chip uses the diagnostic's own editor and save action, so the
  answer stays the single source (rule 3), and the run is recomputed by input hash (rule 4). A cell
  with no answer shows an empty state with its reason, never invented text. The geometry is D-051; on
  a phone the cells stack in filling order. C7.1 is a draft question for the owner's review (#86).
- **Reason:** SPEC §5 (T1, T2); CLAUDE.md rules 2, 3, 4 and 9; D-051.
- **Status:** Active

### D-232 (2026-10-11): Entitlements before payments, the full-report gate and server-side locks

- **Decision:** `lib/entitlements.ts` reads `config/plans.ts`, and no code branches on a plan name.
  Until M7 every account is `free`; the server-only variable `FULL_REPORT_PREVIEW_EMAILS` lists the
  owner's address so that the full report can be built and seen, and it is removed with M7. The full
  report needs a completeness of 80% or more and F1, F3, F4, F5 and F6 (F8 is satisfied by the
  project's currency, D-111); `FULL_REPORT_QUESTIONS` gains F6. Locked sections are decided on the
  server: for an account without the entitlement the page receives the section titles only, so the
  locked values are in neither the HTML nor the RSC payload, and a test proves it.
- **Reason:** CLAUDE.md §3 (entitlements) and rule 6; SPEC §3. Resolves #42.
- **Status:** Active

### D-233 (2026-10-11): Country packs, T17 and the tax information policy

- **Decision:** Country data is collected from official sources only, from an allowed-domain list kept
  in `settings` (government portals and official agencies such as anae.dz). Each `country_pack_items`
  row has `source_url`, `last_verified` and a status (`verified`, `unverified` or `under_review`); an
  item older than 90 days, or not verified, renders with «تحقّق من المصدر الرسمي» (rule 8). A
  `tax_rules` row is stored only when its rule was read on an official page; otherwise none is stored
  and the report says the tax was not calculated (the engine already refuses to guess, D-211). Every
  report shows the official tax authority link for the user's country where one is known, and a line
  that recommends a tax adviser there; for a country with no pack it shows that line without a link,
  never an invented one. T17 for Jordan decides the food and cosmetics approvals from the sector D2,
  not from B7 (#39). For Algeria it shows the auto-entrepreneur path and the commercial register path
  with their conditions, asks the founder to confirm the activity on the official ANAE list instead of
  deciding eligibility, and takes the goods-import signal from D6 (#40). Reading tax law with AI, and
  answering a user's questions by verbatim quotation with the link, is a later feature that comes with
  the mentor (M6): it needs consent and quota, and no number written by a model enters a report
  (rules 1, 8 and 9).
- **Reason:** The owner's decision of 2026-10-11 (official links and an adviser, AI reading of the law
  after M5), CLAUDE.md rules 1, 8 and 9, SPEC §7. Resolves #39 and #40.
- **Status:** Active

### D-234 (2026-10-11): Reports, storage, retention and deletion

- **Decision:** A `reports` row records the project, the kind (summary or full), the locale, the
  audience (H8), the input hash, the engine version, the path and the size. PDFs live in a private
  bucket `reports` at `{user_id}/{project_id}/{report_id}.pdf` with owner-only policies, are served by
  short-lived signed URLs, and follow the project's retention (CLAUDE.md §3). Account deletion removes
  the files through the Storage API with the user's own session before the database deletion, because
  deleting rows does not delete files; the retention job of M9 must do the same with the service role.
  The PDF carries the project title, never a name or an email. A daily limit per user (a `settings`
  row, counted in `usage_counters`) bounds the cost.
- **Reason:** CLAUDE.md rules 6 and 7; privacy by design.
- **Status:** Active

### D-235 (2026-10-11): PDF rendering and its hardening

- **Decision:** The PDF is made by headless Chromium behind a launcher abstraction in
  `packages/report`, from the same `ReportModel` as the screen. Step 0 measures it on Vercel (Hobby
  today, Pro before M7, D-021) and decides between a Vercel function and a separate render worker; a
  worker is a new processor, so it needs the owner's approval and an entry in the processing register
  before it is built. Wherever it runs: the HTML is built from escaped text only, JavaScript is off,
  every network request is aborted, the fonts (Cairo, Tajawal) are embedded, the content security
  policy is `default-src 'none'`, and the PDF is tagged with an outline if the renderer supports it.
  Tests extract the PDF text in CI against the pinned Playwright image.
- **Reason:** CLAUDE.md §5 (validate Arabic shaping and bidi in M5 week 1; propose a worker before
  building around limits) and rule 7; the founder's text must never run as markup.
- **Status:** Amended by D-240

### D-236 (2026-10-11): The scope of the M5 report

- **Decision:** The report has the sections SPEC §6 marks ● and a sources list (Appendix B), in
  Arabic first and in English in step 7 (D-067). It uses tables and no charts (SPEC: the chart is v2).
  There is one template whose opening and first number depend on the audience in H8 (investor, bank,
  grant body, course or self); the full variants are v2. T6, the competitor matrix, is deferred to v2
  (resolves #4). The word «فائدة» is banned only in financing text when G7 is yes, and stays allowed
  in its everyday sense (resolves #56).
- **Reason:** SPEC §5 and §6; the owner's decision of 2026-10-11 (English inside M5, in the last step).
- **Status:** Active

### D-237 (2026-10-11): M5 quality gates

- **Decision:** `@sbn/report` has coverage thresholds (statements and lines 95%, branches 90%,
  functions 95%); the engine keeps its gates. The golden `ReportModel` of each golden project is a
  file under the `UPDATE_GOLDEN` rule of D-222. PDF tests extract text, fonts and pages in CI. The leak
  test of D-232, the accessibility checks and the RTL and phone snapshots cover every new screen.
  Every change that can alter an output raises `ENGINE_VERSION` (D-221).
- **Reason:** CLAUDE.md rule 11 and §9.
- **Status:** Active

### D-238 (2026-10-11): Recording engine runs

- **Decision:** A new database function `record_engine_run` (security definer, with an ownership
  check, like `record_ai_run`) writes a `tool_runs` row for an engine tool. Its `output` is a compact
  JSON-safe summary: the engine version, the verdict, the score and criteria, the headline numbers as
  decimal strings, the alert codes and the cached changes of D-228. The full run is not stored: it is
  about 100 KB and has no parser (D-219), so it is recomputed from the answers when it is needed. The
  input hash covers the answers with their provenance, the tax context, the parameters and
  `ENGINE_VERSION`, so a changed answer, rule or engine makes a new row (rule 4). Rows older than the
  newest five of a project and tool are purged by the retention job of M9.
- **Reason:** CLAUDE.md rule 4; D-219; `record_tool_run` was dropped (D-191).
- **Status:** Active

### D-239 (2026-10-11): The PDF packages and how they ship

- **Decision:** Chromium is `@sparticuz/chromium` 153.0.0, paired with `puppeteer-core` 25.11.0:
  the package README asks for the Chromium major that the Puppeteer release was built for, and
  25.11.0 bundles Chrome 153.0.8010.36 (25.12.0 expects 154 and 25.13.0 expects 155, for which
  `@sparticuz/chromium` has no release yet). The package ships the Amazon Linux 2023 libraries
  (`bin/al2023.tar.br`), the system of the Node.js 24 functions, and unpacks the browser into
  `/tmp` on a cold start; its README asks for at least 512 MB of memory and recommends 1600 MB or
  more. The fonts are `@fontsource/cairo` and `@fontsource/tajawal` 5.3.0 (SIL OFL 1.1, whose
  `LICENSE` travels in each package; Arabic and Latin woff2 subsets of Cairo 600 and 700 and Tajawal
  400, 500 and 700), read by the fonts loader and inlined as `data:` URLs. `pdfjs-dist` 6.4.299
  (Apache-2.0) is a dev dependency of `@sbn/report`, for the tests and the PNG tool. Licences
  checked with `pnpm licenses`: Apache-2.0, MIT, ISC, BSD-3-Clause and OFL-1.1 only. Exact versions,
  as everywhere in the repository. In `apps/web/next.config.ts`, `serverExternalPackages` keeps
  `puppeteer-core` and `@sparticuz/chromium` out of the bundle, `outputFileTracingIncludes` adds the
  browser's `bin` folder (four files, 68 MB) and the ten font files to the spike route, and
  `@sbn/report` joins `transpilePackages`. `apps/web` also lists the four runtime packages as its own
  dependencies, because pnpm shows the tracer and the external resolution only the direct
  dependencies of the app. A production build puts the four `bin/*.br` files and the ten font files
  in `.next/server/app/api/internal/pdf-spike/route.js.nft.json`, and the route ran from
  `next start`. Not verified here: the Vercel runtime itself (D-242 records the preview
  measurements).
- **Reason:** CLAUDE.md §5 (validate Arabic shaping and bidi; propose a worker before building
  around limits); D-235.
- **Status:** Active

### D-240 (2026-10-11): The launcher, the render options and what did not work

- **Decision:** `launchBrowser()` (`packages/report/src/render/launch.ts`, no Next.js import) loads
  `@sparticuz/chromium` with a dynamic import when `VERCEL` is set and turns its graphics mode off
  (no WebGL is needed). Elsewhere it needs `PDF_CHROMIUM_PATH`; for local convenience only it falls
  back to the newest Chromium in `~/.cache/ms-playwright` (headless shell first), so a laptop that ran
  `playwright install chromium` needs nothing else. It starts a headless shell binary in the `shell`
  mode and a full Chromium in the new headless mode, and adds `--no-sandbox` only when it runs as
  root (the Playwright container). A missing browser throws `PdfRenderError` with the code
  `browser_unavailable`, a browser that does not start `launch_failed`; the message never quotes the
  document or the cause. `renderPdf({ html, locale, headerTitle })` opens a page, turns JavaScript off
  before the content is set (`setContent` and the wait for `document.fonts.ready` still work), aborts
  and counts every request that is not a `data:` URL, refuses a document without the
  `default-src 'none'` policy tag (`input_rejected`), and returns `{ pdf, aborted, ms }`. The policy
  blocks a resource before a request exists, so `aborted` counts only what the policy let through and
  is 0 for a well-formed document. `getSharedBrowser()` keeps one browser for a warm function.
  Options that worked on Chromium 153 with Puppeteer 25.11: A4 with `printBackground` and
  `preferCSSPageSize`; the named page `wide` (`@page wide { size: A4 landscape }`), which gives one
  landscape page (842 by 595 points) inside a portrait document; `displayHeaderFooter` with a title and
  "n / total" in Western digits, whose templates are drawn outside the page and so carry their own
  inlined font; `tagged: true` (a structure tree on every page); `outline: true` (bookmarks from the
  headings). What did not work well, and is therefore decided here: (1) the bookmarks of an Arabic
  document come out with the words of a title in reverse order, so `outline` is off for Arabic by
  default and on for English (it amends D-235, which said "if the renderer supports it"); (2) Chromium
  stores Arabic the way it draws it, in joined presentation forms and from left to right, so copying
  or searching text in an Arabic PDF gives reversed words in many viewers, although the page is drawn
  correctly (checked on rasterized pages: joined letters, tashkeel, right-to-left tables, digits and
  `Break-even` in brackets in the right place); the tests therefore read the file back with
  `assembleLine` (`@sbn/report/testing`), which puts each line in reading order, and the
  accessibility consequence (PDF/UA, selectable Arabic text) is open for the owner. The report page
  on screen stays real text. Measured on a laptop (WSL, `next start`, not Vercel): first call 3.4 s to
  start the browser and 0.8 s to render, later calls 0.6 to 1.1 s, 100 to 118 KB per PDF.
- **Reason:** D-235; CLAUDE.md §5 and §6; rule 7 (the founder's text must never run).
- **Status:** Active

### D-241 (2026-10-11): The spike tests, the look tool and the temporary route

- **Decision:** `packages/report` has unit tests (escaping, the print CSS, the fonts loader, the
  document and its policy, the fixture, the launcher including its error paths and the Vercel branch
  with the package mocked, the header and footer, and the line reader) under the coverage gate of
  D-237; the files that need a running browser (`render/pdf.ts`, `render/shared.ts`,
  `testing/pdf-inspect.ts`) are left out of the gate and covered by `apps/web/e2e/pdf/pdf.spec.ts`
  in the "site" project, which renders both fixtures with Playwright's Chromium
  (`PDF_CHROMIUM_PATH` from `chromium.executablePath()`) and reads the PDF back with pdf.js: the page
  count, the landscape page, the embedded Cairo and Tajawal fonts, the phrases in reading order with
  Western digits, the page numbers, the number of aborted requests (0 for the fixture, 3 for a page
  without the policy tag), and that nothing from the script and onerror attribute shows up. The spec
  needs neither a page nor Supabase; the config still starts the web server for the project. PDF
  bytes are never compared. `pnpm --filter @sbn/report run pdf:png -- <pdf> <outdir> [--scale n]
[--crop x,y,w,h]` rasterizes pages by running pdf.js inside the same headless Chromium, so a person
  can look at them. The temporary route `apps/web/src/app/api/internal/pdf-spike/route.ts` answers
  GET only, on Node.js (never edge), with `maxDuration = 60`; it returns 404 unless
  `VERCEL_ENV` is `preview` or `NODE_ENV` is `development`, renders the Arabic fixture (English with
  `?locale=en`) and sets `x-pdf-ms`, `x-pdf-cold`, `x-pdf-launch-ms`, `x-pdf-bytes`,
  `x-pdf-aborted` and `x-pdf-node-rss-mb` (Node only, without Chromium). Vercel's own preview
  protection is its only gate: it serves a literal fixture, no data. Step 6 removes the route.
- **Reason:** D-235 and D-237; the gate of step 0 is a measured decision, not a guess (D-242).
- **Status:** Active
