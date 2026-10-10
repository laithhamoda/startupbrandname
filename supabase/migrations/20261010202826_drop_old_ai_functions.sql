-- Contract half of the audit-fix migrations 20261004053500 and 20261004053600 (D-191, D-155,
-- #89). Production applied both on 2026-10-05 and serves an app built from main after pull
-- request B, which calls only reserve_ai_run(), record_ai_run() and crossborder_consent_state().
-- Nothing deployed calls the three functions dropped here; a deployment from before that pull
-- request would find them missing and keep AI off, as its calls fail closed.
--
-- The settings keys they read (ai.limit.user_daily_calls, ai.limit.global_daily_usd) are read by
-- reserve_ai_run() as well, so no key is left unused.

-- contract: replaced by reserve_ai_run() (20261004053500); closed to signed-in users since then
drop function public.reserve_ai_call();

-- contract: replaced by record_ai_run(), which takes the cost from the settings prices (SEC-1)
drop function public.record_tool_run(uuid, text, text, jsonb, text, text, integer, integer, integer, integer, numeric);

-- contract: replaced by crossborder_consent_state(), which tells the versions of the text apart
drop function public.has_crossborder_consent();

comment on table public.tool_runs is
  'One row per tool or model run, with its input hash for reuse and its tokens and cost. Written by record_ai_run().';
comment on table public.usage_counters is
  'Per-user counters per UTC day, such as AI calls. Written by reserve_ai_run().';
