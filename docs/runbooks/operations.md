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

| Switch                         | What stops                                                       | How                                                                                                       | Takes effect                                                        | Undo                                              |
| ------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| AI, at once                    | Every model call; the fixed checks carry on                      | Production SQL editor: `update public.settings set value = '0' where key = 'ai.limit.global_daily_usd';`  | Next call: `reserve_ai_call()` reads the limit every time (seconds) | Set it back to `5` (D-120)                        |
| AI, by release                 | Every model call                                                 | Vercel Production: `AI_PROVIDER=off`, then redeploy                                                       | Next deployment (minutes)                                           | Remove the variable, redeploy                     |
| Anthropic key                  | Every model call; a leaked key can no longer be used             | Anthropic Console: revoke the key                                                                         | At once; calls fail and fall back to the fixed checks (D-124)       | New key in Vercel (Sensitive), redeploy           |
| Algeria (locked, CLAUDE.md §3) | New signups from Algeria; existing accounts keep working         | Vercel Production: `MARKET_DZ_ENABLED=false`, then redeploy                                               | Next deployment                                                     | `true`, redeploy                                  |
| Google sign-in                 | The "Continue with Google" button                                | Supabase → Authentication → Sign In / Providers → Google off; or `AUTH_GOOGLE_ENABLED=false` and redeploy | Within a minute: the app caches the provider check for 60 s (D-089) | Provider on; or `true` and redeploy               |
| New accounts                   | Every new signup; existing users still sign in. Emergencies only | Supabase → Authentication → Sign In / Providers → Allow new users to sign up off                          | At once                                                             | Switch it on again                                |
| Search indexing                | Indexing of the public pages                                     | Vercel Production: `SITE_INDEXABLE=false`, then redeploy                                                  | Next deployment                                                     | `true`, redeploy ([launch-seo.md](launch-seo.md)) |
| The whole release              | The current app version                                          | Instant Rollback to the previous deployment, or a revert pull request ([above](#rolling-back))            | Seconds; a revert once merged and built                             | Undo Rollback; revert the revert                  |

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
   set value = value || '{"<model ID>": {"input": 0, "output": 0, "cache_write": 0, "cache_read": 0, "source_url": "<pricing page>", "checked_at": "<YYYY-MM-DD>"}}'::jsonb
   where key = 'ai.prices';

   update public.settings set value = '"<model ID>"' where key = 'ai.model.fast';
   ```

   The zeros stand for the USD prices per million tokens; `cost_usd` is computed from them.

3. Update the assertions in `supabase/tests/ai_usage.test.sql`, including one that each price of
   the new model is greater than 0, and add a decision.
4. Release it as above. The input hash includes the model, so no review from the old model is
   reused for the new one. A model without a price turns AI off instead of being counted as free.

If the model stops working before the migration reaches production, calls fail and the diagnostic
falls back to the fixed checks (D-124); the first kill switch stops the failing calls from counting.

## Supabase outage

`GET /api/health` answers `503` with `status: "degraded"` and a reason:

| `supabase.reason`      | Meaning                                                          | Action                                                                     |
| ---------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `timeout`, `network`   | Supabase cannot be reached from `fra1`                           | Check status.supabase.com and the project in the dashboard; wait           |
| `http_5xx`             | Supabase answers with a server error                             | Same                                                                       |
| `http_401`, `http_403` | Not an outage: the key does not belong to the project at the URL | Fix `NEXT_PUBLIC_SUPABASE_URL` and the publishable key in Vercel, redeploy |

During an outage the public pages keep working for visitors who are not signed in: they are
prerendered, and the proxy calls Supabase only when a session cookie is present. For signed-in
visitors, pages may be slow while the proxy tries to refresh an expiring session; sign-in, the
account and the diagnostic fail, and no answer can be saved. There is nothing to switch in the app, and a
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
| `AI_PROVIDER`                           | `fake`                                | Unset (`anthropic`)                        | Unset (`anthropic`); `fake` is refused here |
| `ANTHROPIC_API_KEY`                     | Unset                                 | Sensitive                                  | Sensitive                                   |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_REGION` | Unset                                 | Set by Vercel                              | Set by Vercel                               |

As of M3c (2026-09-28), `LOG_LEVEL` is validated but no logger reads it (M9 checklist). The
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

| Key                         | Value now                                                                  | Meaning                                                     | Read by                                                     | Decision |
| --------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- | -------- |
| `entitlement.free.projects` | `1`                                                                        | Projects per account until paid plans exist                 | `create_project()`; must equal `plans.ts` (`plans.test.ts`) | D-109    |
| `ai.model.fast`             | `"claude-haiku-4-5-20251001"`                                              | The model that reviews answers                              | `readSettings` in `apps/web/src/lib/ai/service.ts`          | D-122    |
| `ai.prices`                 | USD per million tokens, keyed by model ID, with `source_url`, `checked_at` | The cost of each call; a model without a price turns AI off | `readSettings`                                              | D-122    |
| `ai.limit.user_daily_calls` | `40`                                                                       | Model calls per user per UTC day; `0` stops AI              | `reserve_ai_call()`                                         | D-120    |
| `ai.limit.global_daily_usd` | `5`                                                                        | Total model spend per UTC day; `0` stops AI                 | `reserve_ai_call()`                                         | D-120    |
