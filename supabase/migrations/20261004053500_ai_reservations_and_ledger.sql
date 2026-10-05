-- Audit fixes, PR B: AI calls are recorded only against a one-time reservation, their cost is
-- computed here from the settings price, and the spend of each day is kept in a ledger that no
-- deletion lowers, where each reservation holds the most its call can cost until the call is
-- recorded (D-146; SEC-1, COST-1, OBS-2; CLAUDE.md rule 10).
--
-- Until now any signed-in user could call record_tool_run() with a cost of their choosing and
-- close AI for every founder until midnight UTC, and deleting a project or an account removed its
-- runs from the sum the global cap read. The app still needs no secret key (D-077): every call
-- below runs as the signed-in user.
--
-- Expand only: reserve_ai_run() and record_ai_run() are added next to reserve_ai_call() and
-- record_tool_run(), which signed-in users may no longer run. The old pair is dropped in a later
-- contract migration, once no deployed app calls it.

-- ---------------------------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------------------------

-- The input tokens one call may count: input, cache writes and cache reads together. A review
-- sends about 6000 at most (the instructions, the question and an answer of 4000 characters).
-- Output tokens are capped at 1500, the max_tokens of every call. Tokens are reported by the app,
-- so these bounds cap what one reservation can add to today's spend, and they give the most one
-- call can cost, which each reservation holds until its run is recorded.
insert into public.settings (key, value) values ('ai.limit.tokens_in_per_call', '8000');

-- ---------------------------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------------------------

create table private.ai_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The model the call is for, and the most it can cost, held in the ledger until it is recorded.
  model text not null check (char_length(model) between 1 and 80),
  held_usd numeric(14, 6) not null check (held_usd >= 0),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

comment on table private.ai_reservations is
  'One row per AI call allowed by reserve_ai_run(), with the cost it holds. record_ai_run() uses each one once, within 5 minutes.';

create index ai_reservations_user_created_idx on private.ai_reservations (user_id, created_at);

alter table private.ai_reservations enable row level security;
revoke all on table private.ai_reservations from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The daily spend ledger
-- ---------------------------------------------------------------------------------------------

create table private.ai_spend_daily (
  -- A UTC day (D-120).
  day date not null,
  model text not null check (char_length(model) between 1 and 80),
  calls integer not null default 0 check (calls >= 0),
  tokens_in bigint not null default 0 check (tokens_in >= 0),
  tokens_out bigint not null default 0 check (tokens_out >= 0),
  cache_write_tokens bigint not null default 0 check (cache_write_tokens >= 0),
  cache_read_tokens bigint not null default 0 check (cache_read_tokens >= 0),
  cost_usd numeric(14, 6) not null default 0 check (cost_usd >= 0),
  -- The most the calls reserved but not recorded can cost. A call cut off by the time budget
  -- (D-150) or whose record failed may still be billed, so it counts towards the cap at that
  -- most, and its hold gives way to its real cost once it is recorded.
  held_usd numeric(14, 6) not null default 0 check (held_usd >= 0),
  primary key (day, model)
);

comment on table private.ai_spend_daily is
  'AI calls, tokens and cost per UTC day and model, and the cost held by calls not recorded, with no user or project key, so deleting an account or a project never lowers it. The global cap reads it.';

alter table private.ai_spend_daily enable row level security;
revoke all on table private.ai_spend_daily from public, anon, authenticated;

-- The runs recorded so far, so today's cap and the cost history start from what is known. A run
-- with an empty model, or with a cost no review comes near (one costs about 0.02 USD at most),
-- could only come from the record_tool_run() hole closed below: the first is left out and the
-- second counts as 1 USD, so neither can stop this migration on a check or an overflow.
insert into private.ai_spend_daily (
  day, model, calls, tokens_in, tokens_out, cache_write_tokens, cache_read_tokens, cost_usd
)
select
  (created_at at time zone 'utc')::date,
  model,
  count(*),
  sum(tokens_in),
  sum(tokens_out),
  sum(cache_write_tokens),
  sum(cache_read_tokens),
  sum(least(cost_usd, 1))
from public.tool_runs
where char_length(model) between 1 and 80
group by 1, 2;

-- ---------------------------------------------------------------------------------------------
-- Functions called by the app (as the signed-in user)
-- ---------------------------------------------------------------------------------------------

-- Allows one AI call for today (UTC). Returns {"reservation": <uuid or null>, "reason": …}:
-- 'ok' with a reservation for record_ai_run(); 'user_limit' when the user has made today's calls;
-- 'global_cap' when today's spend has reached the cap; 'disabled' when a limit is missing or 0,
-- or the fast model has no price. The reservation holds the most its call can cost in today's
-- ledger, so a call that is never recorded still counts towards the cap. Calls reserved at the
-- same moment can pass the cap by their holds.
create function public.reserve_ai_run()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_calls integer;
  v_budget numeric;
  v_tokens_in integer;
  v_model text;
  v_price jsonb;
  v_hold numeric;
  v_count integer;
  v_reservation uuid;
begin
  if v_user is null then
    raise exception 'reserve_ai_run: not signed in' using errcode = '42501';
  end if;

  select (value #>> '{}')::integer into v_calls
  from public.settings where key = 'ai.limit.user_daily_calls';
  select (value #>> '{}')::numeric into v_budget
  from public.settings where key = 'ai.limit.global_daily_usd';
  select (value #>> '{}')::integer into v_tokens_in
  from public.settings where key = 'ai.limit.tokens_in_per_call';
  select value #>> '{}' into v_model from public.settings where key = 'ai.model.fast';
  select value -> v_model into v_price from public.settings where key = 'ai.prices';

  -- The most one call can cost (USD per million tokens, D-122): every input token at the dearest
  -- of the input rates, and the 1500 output tokens record_ai_run() counts at most.
  v_hold := round(
    (
      v_tokens_in * greatest(
        (v_price ->> 'input')::numeric,
        (v_price ->> 'cache_write')::numeric,
        (v_price ->> 'cache_read')::numeric
      )
      + 1500 * (v_price ->> 'output')::numeric
    ) / 1000000,
    6
  );

  if coalesce(v_calls, 0) <= 0
    or coalesce(v_budget, 0) <= 0
    or coalesce(v_tokens_in, 0) <= 0
    or not coalesce(v_price ?& array['input', 'output', 'cache_write', 'cache_read'], false)
    or v_hold is null
  then
    return jsonb_build_object('reservation', null, 'reason', 'disabled');
  end if;

  if (
    select coalesce(sum(cost_usd + held_usd), 0) from private.ai_spend_daily where day = v_day
  ) >= v_budget then
    return jsonb_build_object('reservation', null, 'reason', 'global_cap');
  end if;

  insert into public.usage_counters (user_id, key, period_start, count)
  values (v_user, 'ai_calls', v_day, 1)
  on conflict (user_id, key, period_start)
    do update set count = public.usage_counters.count + 1
    where public.usage_counters.count < v_calls
  returning count into v_count;

  if v_count is null then
    return jsonb_build_object('reservation', null, 'reason', 'user_limit');
  end if;

  -- A reservation older than a day can never be used again; its hold stays in the ledger.
  delete from private.ai_reservations
  where user_id = v_user and created_at < now() - interval '1 day';

  insert into private.ai_reservations (user_id, model, held_usd) values (v_user, v_model, v_hold)
  returning id into v_reservation;

  insert into private.ai_spend_daily as spend (day, model, held_usd)
  values (v_day, v_model, v_hold)
  on conflict (day, model) do update set held_usd = spend.held_usd + excluded.held_usd;

  return jsonb_build_object('reservation', v_reservation, 'reason', 'ok');
end;
$$;

-- Records one model call against an unused reservation of the signed-in user from the last 5
-- minutes, for one of their projects, and returns the run's id. The cost is computed here from
-- the model's price in settings ('ai.prices'), never taken from the caller; a model without a
-- price, an unknown tool or an output over 16 KB is refused. Tokens are clamped to the bounds
-- above. In the same transaction the reservation's hold leaves the ledger and the run's cost
-- joins it; a refused record keeps the hold.
create function public.record_ai_run(
  p_reservation uuid,
  p_project_id uuid,
  p_tool_id text,
  p_input_hash text,
  p_output jsonb,
  p_model text,
  p_prompt_version text,
  p_tokens_in integer,
  p_tokens_out integer,
  p_cache_write_tokens integer,
  p_cache_read_tokens integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_price jsonb;
  v_limit integer;
  v_in integer;
  v_out integer;
  v_cache_write integer;
  v_cache_read integer;
  v_cost numeric;
  v_hold numeric;
  v_hold_model text;
  v_hold_day date;
  v_id bigint;
begin
  if v_user is null then
    raise exception 'record_ai_run: not signed in' using errcode = '42501';
  end if;

  update private.ai_reservations
  set used_at = now()
  where id = p_reservation
    and user_id = v_user
    and used_at is null
    and created_at > now() - interval '5 minutes'
  returning held_usd, model, (created_at at time zone 'utc')::date
  into v_hold, v_hold_model, v_hold_day;
  if not found then
    raise exception 'record_ai_run: no open reservation' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.projects where id = p_project_id and user_id = v_user
  ) then
    raise exception 'record_ai_run: not your project' using errcode = '42501';
  end if;

  -- The model calls the app makes. A new tool is added here with its migration.
  if p_tool_id is null or p_tool_id not in ('review_text') then
    raise exception 'record_ai_run: unknown tool' using errcode = '22023';
  end if;

  if p_output is null or octet_length(p_output::text) > 16384 then
    raise exception 'record_ai_run: the output is missing or too large' using errcode = '22023';
  end if;

  select value -> p_model into v_price from public.settings where key = 'ai.prices';
  select (value #>> '{}')::integer into v_limit
  from public.settings where key = 'ai.limit.tokens_in_per_call';
  if coalesce(v_limit, 0) <= 0 then
    raise exception 'record_ai_run: no token limit' using errcode = '22023';
  end if;

  v_out := least(greatest(coalesce(p_tokens_out, 0), 0), 1500);
  v_in := least(greatest(coalesce(p_tokens_in, 0), 0), v_limit);
  v_cache_write := least(greatest(coalesce(p_cache_write_tokens, 0), 0), v_limit - v_in);
  v_cache_read := least(greatest(coalesce(p_cache_read_tokens, 0), 0), v_limit - v_in - v_cache_write);

  -- Prices are in USD per million tokens (D-122); a missing or malformed price gives null.
  v_cost := round(
    (
      v_in * (v_price ->> 'input')::numeric
      + v_out * (v_price ->> 'output')::numeric
      + v_cache_write * (v_price ->> 'cache_write')::numeric
      + v_cache_read * (v_price ->> 'cache_read')::numeric
    ) / 1000000,
    6
  );
  if jsonb_typeof(v_price) is distinct from 'object' or v_cost is null then
    raise exception 'record_ai_run: the model has no price' using errcode = '22023';
  end if;

  insert into public.tool_runs (
    project_id, tool_id, input_hash, output, model, prompt_version,
    tokens_in, tokens_out, cache_write_tokens, cache_read_tokens, cost_usd
  )
  values (
    p_project_id, p_tool_id, p_input_hash, p_output, p_model, p_prompt_version,
    v_in, v_out, v_cache_write, v_cache_read, v_cost
  )
  returning id into v_id;

  update private.ai_spend_daily
  set held_usd = greatest(held_usd - v_hold, 0)
  where day = v_hold_day and model = v_hold_model;

  insert into private.ai_spend_daily as spend (
    day, model, calls, tokens_in, tokens_out, cache_write_tokens, cache_read_tokens, cost_usd
  )
  values (
    (now() at time zone 'utc')::date, p_model, 1, v_in, v_out, v_cache_write, v_cache_read, v_cost
  )
  on conflict (day, model) do update set
    calls = spend.calls + 1,
    tokens_in = spend.tokens_in + excluded.tokens_in,
    tokens_out = spend.tokens_out + excluded.tokens_out,
    cache_write_tokens = spend.cache_write_tokens + excluded.cache_write_tokens,
    cache_read_tokens = spend.cache_read_tokens + excluded.cache_read_tokens,
    cost_usd = spend.cost_usd + excluded.cost_usd;

  return v_id;
end;
$$;

revoke all on function public.reserve_ai_run() from public, anon;
grant execute on function public.reserve_ai_run() to authenticated;

revoke all on function public.record_ai_run(uuid, uuid, text, text, jsonb, text, text, integer, integer, integer, integer)
  from public, anon;
grant execute on function public.record_ai_run(uuid, uuid, text, text, jsonb, text, text, integer, integer, integer, integer)
  to authenticated;

-- The old pair: record_tool_run() took the cost from the caller (SEC-1), and reserve_ai_call()
-- reads a sum that deletions lower. An app deployed before this migration then keeps to the fixed
-- checks: its reservation is refused before any model call, so no spend goes unrecorded.
revoke execute on function public.reserve_ai_call() from authenticated;
revoke execute on function public.record_tool_run(uuid, text, text, jsonb, text, text, integer, integer, integer, integer, numeric)
  from authenticated;
