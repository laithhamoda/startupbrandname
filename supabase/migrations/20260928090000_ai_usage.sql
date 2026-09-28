-- M3c: AI calls, their cost and the daily limits (docs/SPEC.md §8 and §10; D-103, D-107, D-120).
--
-- Every model call is recorded in tool_runs with its tokens and cost (CLAUDE.md rule 10), and its
-- output is reused when the same input comes back (rule 4). A call is allowed only after
-- reserve_ai_call() has checked the user's daily calls and the global daily spend. Both functions
-- act for the signed-in user only; nobody writes these tables directly.

-- ---------------------------------------------------------------------------------------------
-- Settings: the model, its price and the limits
-- ---------------------------------------------------------------------------------------------

-- Checked against https://platform.claude.com/docs/en/models/overview on 2026-09-28: active,
-- retirement not sooner than 2026-10-15 and announced at least 60 days ahead (D-122).
-- Prices are in USD per million tokens, keyed by model ID: a model without a price here turns
-- AI off rather than being counted as free.
insert into public.settings (key, value) values
  ('ai.model.fast', '"claude-haiku-4-5-20251001"'),
  (
    'ai.prices',
    '{"claude-haiku-4-5-20251001": {"input": 1, "output": 5, "cache_write": 1.25, "cache_read": 0.1, "source_url": "https://platform.claude.com/docs/en/about-claude/pricing", "checked_at": "2026-09-28"}}'
  ),
  ('ai.limit.user_daily_calls', '40'),
  ('ai.limit.global_daily_usd', '5');

-- ---------------------------------------------------------------------------------------------
-- Tool runs
-- ---------------------------------------------------------------------------------------------

create table public.tool_runs (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  tool_id text not null check (tool_id ~ '^[a-z][a-z0-9_]{1,39}$'),
  -- sha256 of the tool, prompt version, model and de-identified input (rule 4).
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  output jsonb not null,
  model text check (model is null or char_length(model) <= 80),
  prompt_version text check (prompt_version is null or char_length(prompt_version) <= 40),
  -- For engine tools (M4); null for model calls.
  engine_version text check (engine_version is null or char_length(engine_version) <= 40),
  tokens_in integer not null default 0 check (tokens_in >= 0),
  tokens_out integer not null default 0 check (tokens_out >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  search_calls integer not null default 0 check (search_calls >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

comment on table public.tool_runs is
  'One row per tool or model run, with its input hash for reuse and its tokens and cost. Written by record_tool_run().';

create index tool_runs_reuse_idx on public.tool_runs (project_id, tool_id, input_hash, created_at desc);
create index tool_runs_created_idx on public.tool_runs (created_at);

alter table public.tool_runs enable row level security;

revoke all on table public.tool_runs from anon, authenticated;
grant select on table public.tool_runs to authenticated;

create policy "tool_runs: owner reads" on public.tool_runs
  for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------------------------
-- Usage counters (SPEC §8)
-- ---------------------------------------------------------------------------------------------

create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  -- A UTC day (D-120).
  period_start date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, key, period_start)
);

comment on table public.usage_counters is
  'Per-user counters per UTC day, such as AI calls. Written by reserve_ai_call().';

alter table public.usage_counters enable row level security;

revoke all on table public.usage_counters from anon, authenticated;
grant select on table public.usage_counters to authenticated;

create policy "usage_counters: owner reads" on public.usage_counters
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------
-- Functions called by the app (as the signed-in user)
-- ---------------------------------------------------------------------------------------------

-- Reserves one AI call for today (UTC) if the user is under their daily limit and today's total
-- spend is under the global cap. Returns false otherwise, or when either limit is missing or 0;
-- the app then keeps to the fixed checks (D-120).
create function public.reserve_ai_call()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_calls integer;
  v_budget numeric;
  v_count integer;
begin
  if v_user is null then
    raise exception 'reserve_ai_call: not signed in' using errcode = '42501';
  end if;

  select (value #>> '{}')::integer into v_calls from public.settings where key = 'ai.limit.user_daily_calls';
  select (value #>> '{}')::numeric into v_budget from public.settings where key = 'ai.limit.global_daily_usd';
  if coalesce(v_calls, 0) <= 0 or coalesce(v_budget, 0) <= 0 then
    return false;
  end if;

  -- One reservation at a time, so the spend check and the count stay consistent.
  perform pg_advisory_xact_lock(hashtextextended('ai-budget', 0));

  if (
    select coalesce(sum(cost_usd), 0)
    from public.tool_runs
    where created_at >= (v_day::timestamp at time zone 'utc')
  ) >= v_budget then
    return false;
  end if;

  insert into public.usage_counters (user_id, key, period_start, count)
  values (v_user, 'ai_calls', v_day, 1)
  on conflict (user_id, key, period_start)
    do update set count = public.usage_counters.count + 1
    where public.usage_counters.count < v_calls
  returning count into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.reserve_ai_call() from public, anon;
grant execute on function public.reserve_ai_call() to authenticated;

-- Records one run for a project of the signed-in user and returns its id.
create function public.record_tool_run(
  p_project_id uuid,
  p_tool_id text,
  p_input_hash text,
  p_output jsonb,
  p_model text,
  p_prompt_version text,
  p_tokens_in integer,
  p_tokens_out integer,
  p_cache_write_tokens integer,
  p_cache_read_tokens integer,
  p_cost_usd numeric
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'record_tool_run: not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.projects where id = p_project_id and user_id = auth.uid()
  ) then
    raise exception 'record_tool_run: not your project' using errcode = '42501';
  end if;

  insert into public.tool_runs (
    project_id, tool_id, input_hash, output, model, prompt_version,
    tokens_in, tokens_out, cache_write_tokens, cache_read_tokens, cost_usd
  )
  values (
    p_project_id, p_tool_id, p_input_hash, p_output, p_model, p_prompt_version,
    p_tokens_in, p_tokens_out, p_cache_write_tokens, p_cache_read_tokens, p_cost_usd
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_tool_run(uuid, text, text, jsonb, text, text, integer, integer, integer, integer, numeric)
  from public, anon;
grant execute on function public.record_tool_run(uuid, text, text, jsonb, text, text, integer, integer, integer, integer, numeric)
  to authenticated;
