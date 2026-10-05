# Operations

How changes reach production, how to undo them, and what to switch off when something goes wrong.
For the owner and for whoever runs a release. Setup of the hosted sign-in is in
[auth-setup.md](auth-setup.md); a suspected data breach follows [breach-response.md](breach-response.md).

## Environments

|            | App                                                       | Database (Supabase, `eu-central-1`)                 | Migrations                                                 |
| ---------- | --------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Local      | `pnpm dev` on port 3000                                   | Docker, `pnpm db:start`                             | `pnpm db:reset`                                            |
| Preview    | Vercel Preview, every branch except `main`, `fra1`        | `startupbrandname-staging` (`mllysinjzlkhpcgbckil`) | `DB deploy`, automatically when `main` changes a migration |
| Production | Vercel Production, `main`, `startupbrandname.com`, `fra1` | `startupbrandname-prod` (`blexotsepkuslrnawbbq`)    | `DB deploy` from `main`, after the owner approves          |

The two deploy separately: Vercel publishes every push to `main` to production at once, while the
production database changes only when the owner approves a `DB deploy` run. Everything below
follows from that.

## Release order

Production migrates only from `main`, after the owner approves the run on GitHub (the `db-production`
environment has a required reviewer and accepts `main` only). So for a while after every merge,
the new app runs on the old schema.

1. **Pull request.** The migration only adds (expand): new tables, columns, functions or settings
   rows. The app code in the same pull request works with and without it: when a table, column,
   function or settings key it needs is missing, the feature stays off (fail closed) and nothing
   else breaks. All six CI jobs are green.
2. **Merge.** Vercel deploys `main` to production, still on the old schema. `DB deploy` migrates
   staging by itself (it runs on every push to `main` that touches `supabase/migrations`).
3. **Check staging.** The `DB deploy` run is green. Vercel builds no preview of `main`, and a pull
   request opened before the merge does not hold the merged code, so push a throwaway branch at
   the merge commit: `git fetch origin && git push origin origin/main:refs/heads/staging-check`.
   Its Vercel Preview runs on the migrated staging database; check the feature there, then delete
   the branch with `git push origin --delete staging-check`.
4. **Migrate production.** GitHub → Actions → **DB deploy** → Run workflow: branch `main`, target
   `production`, and the confirmation the form asks for. The run then waits for the owner's approval
   of the `db-production` environment.
5. **Verify.** The run's log lists the migrations it applied, `GET /api/health` returns `200`, and
   the feature is on.
6. **Contract, later.** Drops, renames and changed function signatures go in a later pull request,
   once production has been migrated and no deployment that could be served (including one you
   might roll back to) still uses the old object. Its release follows the same steps.

Do not run `DB deploy` for staging from a branch: staging would record a migration that may still
change before it is merged, and its history would then differ from `main`.

What this prevents: commit 399f246 dropped the old `complete_onboarding` signature and two
`profiles` columns (`20260926140000_signup_without_declarations.sql`) in the same change as the app
code that stopped using them. Under this order, the drop is a second pull request.

## A migration that fails

The Supabase CLI applies each file together with its history row, so a failing file is not recorded
as applied and the files before it stay applied. The app keeps running on the previous schema, as
the release order requires: nothing needs rolling back.

1. Stop. Do not re-run the workflow and hope. A failure on staging means production is not touched:
   do not migrate production until staging is green.
2. Read the error in the `DB deploy` log. See what each database has applied: Supabase dashboard →
   Database → Migrations. Do not `supabase link` a local clone to a hosted project: the link
   stays (in the ignored `supabase/.temp`), and a later `supabase db push` from that clone would
   migrate the hosted database directly, past the owner's approval.
3. Fix forward. Never edit a merged migration.
   - **The database's data or state makes the file fail** (CI proves every file applies to an empty
     database; staging and production hold real rows): correct that state with a reviewed statement
     in the SQL editor, with the owner's approval, then run the workflow again. Record what was run
     in the pull request or a decision.
   - **The file itself cannot succeed there**: the history has to change (for example
     `supabase migration repair` and a replacement file). Stop and get the owner's decision first,
     and record it in [DECISIONS.md](../DECISIONS.md).
   - **A file that was applied but is wrong**: a new migration corrects it.

## Rolling back

**App.** Vercel → Project → Deployments → a good production deployment → **Instant Rollback**. It
takes seconds and needs no build. Vercel then stops promoting new `main` deployments by itself
until a deployment is promoted again (**Undo Rollback** or **Promote**).

- **Plan limit.** Until the team moves to Vercel Pro (D-021), Instant Rollback reaches only the
  production deployment immediately before the current one. To go further back, revert the merge
  commits in a pull request to `main` (`git revert -m 1 <merge commit>`, newest first); Vercel
  deploys `main` once it is merged. On Pro, any earlier production deployment can be chosen.
- **Old variables.** A rolled-back deployment runs with the environment variables it was built
  with, so it undoes an environment switch set after it (`AI_PROVIDER=off`,
  `MARKET_DZ_ENABLED=false`). Set the switch again: Deployments → the rolled-back deployment →
  **Redeploy** (the same commit, built with today's variables), then **Promote** the new one. The
  settings switch (`ai.limit.global_daily_usd`) lives in the database and survives a rollback.
- The database stays migrated. That is safe because every migration only adds; do not roll back to
  a deployment older than the change that stopped using an object a contract migration has since
  removed.
- To undo the code as well, revert the merge commit in a new pull request. Never force-push `main`.

**Database.** There are no down migrations: a wrong migration is corrected by a new one. Restoring a
backup (daily on the Pro plan, D-064) loses every write since that backup, up to 24 hours: the
owner's decision only, as a last resort. After a restore, account deletions made since the backup
must be applied again ([M9 checklist](../security/m9-checklist.md)).

**Milestone tags.** Annotated tags on `main` mark each finished milestone, as anchors for comparing
and reverting. The lead creates them; one is added per milestone.

| Tag   | Commit    | Milestone                                     |
| ----- | --------- | --------------------------------------------- |
| `m2`  | `7bdc10c` | Accounts, sign-in, Arabic and English         |
| `m2b` | `44acb55` | Public site, SEO and GEO                      |
| `m3a` | `933ed3f` | Question bank and answer storage              |
| `m3b` | `77288b0` | The diagnostic screens                        |
| `m3c` | `7c763e9` | AI in the diagnostic, Haiku with consent only |

`git diff --name-status tags/m3c origin/main -- supabase/migrations` lists the migrations added
since M3c (the `tags/` prefix avoids old local branches with the same names). To bring the app back
to a milestone, revert in one pull request, newest first, the commits that
`git log --first-parent --oneline tags/m3c..origin/main` lists. On Vercel Pro, an Instant Rollback
to the production deployment whose commit is the tag's also works, within the limits above.

## Kill switches

| Switch                         | What stops                                                       | How                                                                                                       | Takes effect                                                                                     | Undo                                              |
| ------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| AI, at once                    | Every model call; the fixed checks carry on                      | Production SQL editor: `update public.settings set value = '0' where key = 'ai.limit.global_daily_usd';`  | Next call: `reserve_ai_run()` reads the limit every time and answers `disabled` (seconds, D-146) | Set it back to `5` (D-120)                        |
| AI, by release                 | Every model call                                                 | Vercel Production: `AI_PROVIDER=off`, then redeploy                                                       | Next deployment (minutes)                                                                        | Remove the variable, redeploy                     |
| Anthropic key                  | Every model call; a leaked key can no longer be used             | Anthropic Console: revoke the key                                                                         | At once; calls fail and fall back to the fixed checks (D-124, D-151)                             | New key in Vercel (Sensitive), redeploy           |
| Algeria (locked, CLAUDE.md §3) | New signups from Algeria; existing accounts keep working         | Vercel Production: `MARKET_DZ_ENABLED=false`, then redeploy                                               | Next deployment                                                                                  | `true`, redeploy                                  |
| Google sign-in                 | The "Continue with Google" button                                | Supabase → Authentication → Sign In / Providers → Google off; or `AUTH_GOOGLE_ENABLED=false` and redeploy | Within a minute: the app caches the provider check for 60 s (D-089)                              | Provider on; or `true` and redeploy               |
| New accounts                   | Every new signup; existing users still sign in. Emergencies only | Supabase → Authentication → Sign In / Providers → Allow new users to sign up off                          | At once                                                                                          | Switch it on again                                |
| Search indexing                | Indexing of the public pages                                     | Vercel Production: `SITE_INDEXABLE=false`, then redeploy                                                  | Next deployment                                                                                  | `true`, redeploy ([launch-seo.md](launch-seo.md)) |
| The whole release              | The current app version                                          | Instant Rollback to the previous deployment, or a revert pull request ([above](#rolling-back))            | Seconds; a revert once merged and built                                                          | Undo Rollback; revert the revert                  |

A rollback brings back the variables of the deployment it restores, which can undo the switches
held in variables: see **Old variables** under [Rolling back](#rolling-back).

A settings change made in the SQL editor exists only in that database. If it stays beyond the
incident, add a migration with the same value, so staging, local databases and a later settings
migration agree with production, and record the change in [DECISIONS.md](../DECISIONS.md).

## Changing the model or its price before M7

Until the admin area exists (M7), the model and prices change by migration (D-122), following the
release order:

1. Check the model ID, its status and its price on Anthropic's official models and pricing pages
   (CLAUDE.md §5). Never copy them from anywhere else.
2. A new migration adds the price first, then points `ai.model.fast` at it. Keep the old model's
   price in the map: earlier tool runs were costed with it.

   ```sql
   -- <date>: <new model ID> replaces <old model ID> (D-<id>). Checked on <pages> on <date>.
   update public.settings
   set value = value || '{"<model ID>": {"input": <input>, "output": <output>, "cache_write": <cache write>, "cache_read": <cache read>, "source_url": "<pricing page>", "checked_at": "<YYYY-MM-DD>"}}'::jsonb
   where key = 'ai.prices';

   update public.settings set value = '"<model ID>"' where key = 'ai.model.fast';
   ```

   The four prices are USD per million tokens: `record_ai_run()` computes each run's `cost_usd`
   from them, and `reserve_ai_run()` the most a call can cost. A price without all four answers
   `disabled`, and a placeholder left in is not valid JSON, so the migration fails to apply. Each
   price must be greater than 0: the app and the database accept 0, which would count every call
   as free, and the daily USD limit would never stop AI.

3. Update the assertions in `supabase/tests/ai_usage.test.sql`, including one that each price of
   the new model is greater than 0, and add a decision.
4. Release it as above. The input hash includes the model, so no review from the old model is
   reused for the new one. A model without a price turns AI off instead of being counted as free.
   Each server instance reads the model and its price again within a minute (`SETTINGS_TTL_MS`,
   D-167).

If the model stops working before the migration reaches production, calls fail and the diagnostic
falls back to the fixed checks (D-124). A failed input is not tried again for 10 minutes on that
instance (D-151), but every call that was reserved still counts against the user's day and holds
the most it could cost in the day's spend (D-146): the first kill switch stops new ones.

## AI after the audit fixes

Pull request B counts AI calls against one-time reservations and counts a consent only for a listed
text version (D-146, D-147). Its two migrations, `20261004053500_ai_reservations_and_ledger.sql` and
`20261004053600_consent_versions.sql`, follow the release order above, while the app on `main`
already expects them (D-155):

| Production database   | The app on `main`                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neither migration yet | AI stays off: a typed answer to B1, or any typed answer once B1 is saved, logs `ai.skipped` with reason `previous_schema`, at warn level. The account page compares the latest consent with `CROSSBORDER_VERSION` itself, so a consent to the earlier text shows as outdated; a renewal is recorded only once the second migration has run. |
| Only `20261004053500` | The same: `crossborder_consent_state()` comes with the second migration.                                                                                                                                                                                                                                                                    |
| Both                  | AI runs for founders whose consent is `current`; the others are asked on `/account` to renew it.                                                                                                                                                                                                                                            |

In every state, `GET /api/health` shows `"ai": "on"` once a model provider is configured: it does
not show whether the review can run. An app from before pull request B keeps to the fixed checks
on the migrated database, since `reserve_ai_call()` is closed to signed-in users: rolling back to
it is safe, with AI off.

After `DB deploy` has migrated production:

1. The run's log lists both versions as applied.
2. The production SQL editor returns two rows for:

   ```sql
   select key, value
   from public.settings
   where key in ('ai.limit.tokens_in_per_call', 'consent.crossborder.accepted_versions');
   ```

3. On `/account`, renew your own consent if it shows as outdated, as a consent to the earlier text
   now does. Then save a typed answer to B1 that you have not saved before, in one of your projects.
   Vercel → Logs shows no new `ai.skipped` line with `previous_schema`, and the production SQL
   editor returns at least 1 for:

   ```sql
   select count(*)
   from private.ai_reservations
   where created_at > now() - interval '10 minutes';
   ```

   Use B1: any other answer skips with `no_idea` until B1 is saved, before the consent is read, and
   an answer typed before reuses its stored review without a reservation. Neither `GET /api/health`
   nor a quiet log proves on its own that the review runs.

Later, the contract pull request ([OPEN-QUESTIONS #89](../OPEN-QUESTIONS.md)): once production has
both migrations and no deployment that could be served, a rollback target included, calls the old
functions, a migration with a `-- contract:` line (D-141) drops `reserve_ai_call()`, the old
`record_tool_run()` and `has_crossborder_consent()`, and the app drops its previous-schema paths
(the account page's own comparison in `accountConsentState` and the `previous_schema` skip). It
follows the release order like any other.

## Budgets

Limits that fail a check or end a wait, each set from a measurement. Raise one only with its reason
in a new decision in the same pull request; lower a size budget whenever a change makes the route
or page smaller (D-171).

| Budget                                  | Value                                                                               | Where                                                                                                                                | Decision |
| --------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| JavaScript a route loads first, gzipped | Home 192,500 B; signup 211,400 B; onboarding 209,300 B; a diagnostic step 347,800 B | `BUDGETS` in `scripts/check-bundle-budget.mjs`, run by the `checks` job after the build                                              | D-171    |
| Script and font bytes of a public page  | 213,000 B of script, 116,500 B of fonts                                             | `BYTE_BUDGETS` in `apps/web/scripts/lighthouse.mjs` (`lighthouse` job)                                                               | D-171    |
| Layout shift                            | Below 0.1                                                                           | `MAX_LAYOUT_SHIFT` in `lighthouse.mjs`; `expectNoLayoutShift` in `apps/web/e2e/layout-shift.ts` (`/ar`, `/en` and a diagnostic step) | D-171    |
| AI review of one save                   | 8 s in all; each request 8 s with at most one retry                                 | `AI_BUDGET_MS` in `apps/web/src/lib/ai/service.ts`; `REQUEST_TIMEOUT_MS`, `MAX_RETRIES` in `packages/ai/src/client.ts`               | D-150    |
| A Supabase request                      | 8 s from pages, actions and route handlers; 3 s from the proxy                      | `apps/web/src/lib/supabase/timed-fetch.ts`                                                                                           | D-168    |
| The proxy's session refresh             | 4 s                                                                                 | `REFRESH_DEADLINE_MS` in `apps/web/src/lib/supabase/proxy.ts`                                                                        | D-168    |
| A diagnostic step, a save included      | 30 s                                                                                | `maxDuration` in `apps/web/src/app/[locale]/(app)/projects/[id]/q/[step]/page.tsx`                                                   | D-150    |

The time budgets were set together: the Supabase deadlines keep a typed answer's save, with its
8-second AI review, inside the step page's 30 seconds (D-168). Raising one means checking the
others, and `maxDuration` with them.

## Supabase outage

`GET /api/health` answers `503` with `status: "degraded"` and a reason:

| `supabase.reason`      | Meaning                                                          | Action                                                                     |
| ---------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `timeout`, `network`   | Supabase cannot be reached from `fra1`                           | Check status.supabase.com and the project in the dashboard; wait           |
| `http_5xx`             | Supabase answers with a server error                             | Same                                                                       |
| `http_401`, `http_403` | Not an outage: the key does not belong to the project at the URL | Fix `NEXT_PUBLIC_SUPABASE_URL` and the publishable key in Vercel, redeploy |

During an outage the public pages keep working for visitors who are not signed in: they are
prerendered, and the proxy calls Supabase only when a session cookie is present. For signed-in
visitors, the proxy gives up on refreshing an expiring session after 4 seconds and renders the page
signed out, logging `proxy.refresh_timeout`; every other Supabase request gives up after 8 seconds
(D-168). Sign-in, the account and the diagnostic fail within that time, and no answer can be saved;
the editor keeps what was typed for a retry (D-129). There is nothing to switch in the app, and a
backup restore is not a remedy for an outage. Afterwards: check that `purge-incomplete-accounts`
ran again (Supabase → Integrations → Cron), and re-run any `DB deploy` that failed meanwhile.

## Variables

Vercel applies a variable change to the next deployment only: redeploy after changing one.
`NEXT_PUBLIC_` values are also built into the browser code.

| Variable                                | Local (`apps/web/.env.local`)         | Preview (Vercel)                           | Production (Vercel)                         |
| --------------------------------------- | ------------------------------------- | ------------------------------------------ | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | `http://127.0.0.1:54321`              | `https://mllysinjzlkhpcgbckil.supabase.co` | `https://blexotsepkuslrnawbbq.supabase.co`  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | Printed by `pnpm db:start`            | Staging publishable key                    | Production publishable key                  |
| `LOG_LEVEL`                             | `info`                                | Unset (`info`)                             | Unset (`info`)                              |
| `MARKET_DZ_ENABLED`                     | `true`                                | Unset (`true`, D-068)                      | Unset (`true`, D-068); the Algeria switch   |
| `SITE_INDEXABLE`                        | `false`                               | Ignored outside production                 | `false` until public launch                 |
| `AUTH_GOOGLE_ENABLED`                   | `false` (`test:e2e:auth` sets `true`) | `true` once Google is set up for staging   | `true` once Google is set up for production |
| `AUTH_GOOGLE_VERIFY_PROVIDER`           | Unset; tests only                     | Never set                                  | Never set                                   |
| `AI_PROVIDER`                           | `fake`                                | Unset (`anthropic`)                        | Unset (`anthropic`); `fake` turns AI off    |
| `ANTHROPIC_API_KEY`                     | Unset                                 | Sensitive                                  | Sensitive                                   |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_REGION` | Unset                                 | Set by Vercel                              | Set by Vercel                               |

`LOG_LEVEL` sets the lowest level that `apps/web/src/lib/log.ts` writes to the server logs (D-126). The
schemas are `apps/web/src/env/server.ts` and `client.ts`; a new variable follows the checklist in
[CONTRIBUTING.md](../../CONTRIBUTING.md).

Outside Vercel:

- GitHub secrets read by `DB deploy`: `SUPABASE_ACCESS_TOKEN`, and in each of the `db-staging` and
  `db-production` environments `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`.
- Supabase dashboards: the Resend SMTP key, code length and expiry, redirect URLs and the Google
  client secret ([auth-setup.md](auth-setup.md)). The app holds none of them.

## Settings

Values the app reads from `public.settings`, changed by migration until the admin area exists (M7).
Add a row here with every new key.

| Key                                     | Value now                                                                  | Meaning                                                                                            | Read by                                                                                                    | Decision     |
| --------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------ |
| `entitlement.free.projects`             | `1`                                                                        | Projects per account until paid plans exist                                                        | `create_project()`; must equal `plans.ts` (`plans.test.ts`)                                                | D-109, D-174 |
| `ai.model.fast`                         | `"claude-haiku-4-5-20251001"`                                              | The model that reviews answers                                                                     | `readSettings` in `apps/web/src/lib/ai/service.ts`, at most once a minute per instance; `reserve_ai_run()` | D-122, D-167 |
| `ai.prices`                             | USD per million tokens, keyed by model ID, with `source_url`, `checked_at` | The cost of each call; a model without all four prices turns AI off                                | `readSettings`; `reserve_ai_run()` for the hold; `record_ai_run()` for the cost                            | D-122, D-146 |
| `ai.limit.user_daily_calls`             | `40`                                                                       | Model calls per user per UTC day; `0` stops AI                                                     | `reserve_ai_run()`                                                                                         | D-120        |
| `ai.limit.global_daily_usd`             | `5`                                                                        | Total model spend per UTC day, held costs included; `0` stops AI                                   | `reserve_ai_run()`                                                                                         | D-120, D-146 |
| `ai.limit.tokens_in_per_call`           | `8000`                                                                     | Input tokens one call may count, cache tokens included; sets each reservation's hold; `0` stops AI | `reserve_ai_run()`, `record_ai_run()`                                                                      | D-146        |
| `consent.crossborder.accepted_versions` | `["2026-10-draft-2"]`                                                      | The consent text versions that count; must list `CROSSBORDER_VERSION` (`legal.test.ts`)            | `crossborder_consent_state()`                                                                              | D-147        |

Until the contract migration (#89), the old `reserve_ai_call()` still reads the two `ai.limit` keys
of D-120, though no signed-in user may run it any more.
