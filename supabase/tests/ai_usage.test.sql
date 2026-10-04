-- AI usage: the model settings, the daily limits, reservations, the run log and the spend ledger
-- (D-103, D-120, D-146).
begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

insert into auth.users (id, email, created_at) values
  ('a2000000-0000-4000-8000-000000000001', 'ai-owner@example.test', now()),
  ('b2000000-0000-4000-8000-000000000002', 'ai-stranger@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('a2000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('b2000000-0000-4000-8000-000000000002', 'DZ', 'ar', true);

insert into public.projects (id, user_id, title, country_code, currency) values
  ('a2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'p', 'JO', 'JOD'),
  ('b2100000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'q', 'DZ', 'DZD');

create function pg_temp.act_as(p_user uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
$$;

-- Keeps the reservation id of a reserve_ai_run() result for later tests, under `p_name`.
create function pg_temp.keep(p_name text, p_result jsonb) returns jsonb
language sql
as $$
  select set_config('test.' || p_name, coalesce(p_result ->> 'reservation', ''), true);
  select p_result;
$$;

create function pg_temp.kept(p_name text) returns uuid
language sql
as $$
  select current_setting('test.' || p_name)::uuid;
$$;

-- A run of the review tool on the owner's project, with the parts each test changes.
create function pg_temp.record(
  p_reservation uuid,
  p_project uuid default 'a2100000-0000-4000-8000-000000000001',
  p_tool text default 'review_text',
  p_output jsonb default '{"language": "msa"}',
  p_model text default 'claude-haiku-4-5-20251001',
  p_tokens_in integer default 900,
  p_tokens_out integer default 80
) returns bigint
language sql
as $$
  select public.record_ai_run(
    p_reservation, p_project, p_tool, repeat('a', 64), p_output, p_model, 'review-text-2',
    p_tokens_in, p_tokens_out, 0, 0
  );
$$;

-- Today's cost held by calls not recorded yet, read as the database owner.
create function pg_temp.held() returns numeric
language sql
as $$
  select held_usd from private.ai_spend_daily
  where day = (now() at time zone 'utc')::date and model = 'claude-haiku-4-5-20251001';
$$;

-- ---------------------------------------------------------------------------------------------
-- Settings (CLAUDE.md rule 10, D-120, D-122, D-146)
-- ---------------------------------------------------------------------------------------------

select is(
  (select value #>> '{}' from public.settings where key = 'ai.model.fast'),
  'claude-haiku-4-5-20251001',
  'the fast model is Haiku 4.5'
);
select is(
  (
    select s.value -> (m.value #>> '{}') ->> 'source_url'
    from public.settings s, public.settings m
    where s.key = 'ai.prices' and m.key = 'ai.model.fast'
  ),
  'https://platform.claude.com/docs/en/about-claude/pricing',
  'the fast model has a price that records where it was read'
);
select is(
  (select value #>> '{}' from public.settings where key = 'ai.limit.user_daily_calls'),
  '40',
  'each user has 40 AI calls a day'
);
select is(
  (select value #>> '{}' from public.settings where key = 'ai.limit.global_daily_usd'),
  '5',
  'the whole platform spends at most 5 USD a day'
);
select is(
  (select value #>> '{}' from public.settings where key = 'ai.limit.tokens_in_per_call'),
  '8000',
  'one call counts at most 8000 input tokens'
);

-- ---------------------------------------------------------------------------------------------
-- Nobody signed in, and the old functions
-- ---------------------------------------------------------------------------------------------

set local role anon;
select throws_ok($$select public.reserve_ai_run()$$, '42501', null, 'anon cannot reserve a call');
select throws_ok(
  $$select pg_temp.record('00000000-0000-4000-8000-000000000000')$$,
  '42501',
  null,
  'anon cannot record a run'
);
select throws_ok($$select * from public.tool_runs$$, '42501', null, 'anon cannot read tool runs');
reset role;

select pg_temp.act_as('a2000000-0000-4000-8000-000000000001');
set local role authenticated;

select throws_ok(
  $$select public.reserve_ai_call()$$,
  '42501',
  null,
  'the old reservation, which read a sum that deletions lower, is closed'
);
select throws_ok(
  $$select public.record_tool_run('a2100000-0000-4000-8000-000000000001', 'review_text',
    repeat('a', 64), '{}', 'claude-haiku-4-5-20251001', 'review-text-1', 1, 1, 0, 0, 5)$$,
  '42501',
  null,
  'nobody records a run with a cost of their choosing any more (SEC-1)'
);

-- ---------------------------------------------------------------------------------------------
-- The daily limit per user
-- ---------------------------------------------------------------------------------------------

reset role;
update public.settings set value = '2' where key = 'ai.limit.user_daily_calls';
set local role authenticated;

select is(
  pg_temp.keep('r1', public.reserve_ai_run()) ->> 'reason',
  'ok',
  'the first call of the day is allowed'
);
select ok(pg_temp.kept('r1') is not null, 'an allowed call comes with a reservation');
select is(
  pg_temp.keep('r2', public.reserve_ai_run()) ->> 'reason',
  'ok',
  'the second call is allowed'
);
select is(
  public.reserve_ai_run(),
  '{"reservation": null, "reason": "user_limit"}'::jsonb,
  'the third call passes the limit and is refused, with the reason'
);
select is(
  (select count from public.usage_counters where key = 'ai_calls'),
  2,
  'the counter stops at the limit'
);

reset role;
select is(
  pg_temp.held(),
  0.035::numeric,
  'each reservation holds the most its call can cost: 8000 × 1.25 + 1500 × 5 USD per million tokens'
);
set local role authenticated;

select pg_temp.act_as('b2000000-0000-4000-8000-000000000002');
select is(
  pg_temp.keep('s1', public.reserve_ai_run()) ->> 'reason',
  'ok',
  'another user has their own limit'
);
select is_empty(
  $$select * from public.usage_counters where user_id <> 'b2000000-0000-4000-8000-000000000002'$$,
  'a user sees only their own counters'
);
select throws_ok(
  $$select * from private.ai_reservations$$,
  '42501',
  null,
  'nobody reads the reservations directly'
);

-- ---------------------------------------------------------------------------------------------
-- Recording a run: only against an open reservation, at the price in settings (SEC-1)
-- ---------------------------------------------------------------------------------------------

select pg_temp.act_as('a2000000-0000-4000-8000-000000000001');

select throws_ok(
  $$select pg_temp.record('00000000-0000-4000-8000-000000000000')$$,
  '42501',
  'record_ai_run: no open reservation',
  'a run without a reservation is refused'
);
select throws_ok(
  $$select pg_temp.record(pg_temp.kept('s1'))$$,
  '42501',
  'record_ai_run: no open reservation',
  'another user''s reservation is refused'
);
select throws_ok(
  $$select pg_temp.record(pg_temp.kept('r1'), 'b2100000-0000-4000-8000-000000000002')$$,
  '42501',
  'record_ai_run: not your project',
  'nobody records a run on a project that is not theirs'
);
select throws_ok(
  $$select pg_temp.record(pg_temp.kept('r1'), p_tool => 'mentor_chat')$$,
  '22023',
  'record_ai_run: unknown tool',
  'an unknown tool is refused'
);
select throws_ok(
  $$select pg_temp.record(
    pg_temp.kept('r1'), p_output => jsonb_build_object('msa', repeat('x', 20000))
  )$$,
  '22023',
  'record_ai_run: the output is missing or too large',
  'an output over 16 KB is refused'
);
select throws_ok(
  $$select pg_temp.record(pg_temp.kept('r1'), p_model => 'claude-unpriced')$$,
  '22023',
  'record_ai_run: the model has no price',
  'a model without a price is refused, never counted as free'
);

select isnt(pg_temp.record(pg_temp.kept('r1')), null, 'the owner records a run');
select is(
  (select cost_usd from public.tool_runs where tokens_in = 900),
  0.0013::numeric,
  'its cost comes from the settings price: 900 × 1 + 80 × 5 USD per million tokens'
);
reset role;
select is(
  pg_temp.held(),
  0.035::numeric,
  'recording a run releases its hold, and the two calls still open keep theirs'
);
set local role authenticated;
select throws_ok(
  $$select pg_temp.record(pg_temp.kept('r1'))$$,
  '42501',
  'record_ai_run: no open reservation',
  'a reservation is used once'
);

select isnt(
  pg_temp.record(pg_temp.kept('r2'), p_tokens_in => 1000000000, p_tokens_out => 999999),
  null,
  'a run with impossible token counts is recorded'
);
select results_eq(
  $$select tokens_in, tokens_out, cost_usd from public.tool_runs where tokens_out = 1500$$,
  $$values (8000, 1500, 0.0155::numeric)$$,
  'with its tokens clamped to one call''s bounds, which caps the cost it adds'
);

reset role;
update public.settings set value = '40' where key = 'ai.limit.user_daily_calls';
set local role authenticated;
select pg_temp.keep('r3', public.reserve_ai_run());
reset role;
update private.ai_reservations set created_at = now() - interval '6 minutes'
where id = pg_temp.kept('r3');
set local role authenticated;

select throws_ok(
  $$select pg_temp.record(pg_temp.kept('r3'))$$,
  '42501',
  'record_ai_run: no open reservation',
  'a reservation older than 5 minutes is refused'
);
select throws_ok(
  $$insert into public.tool_runs (project_id, tool_id, input_hash, output)
    values ('a2100000-0000-4000-8000-000000000001', 'x', repeat('a', 64), '{}')$$,
  '42501',
  null,
  'tool runs cannot be written around record_ai_run()'
);
select throws_ok(
  $$select * from private.ai_spend_daily$$,
  '42501',
  null,
  'nobody reads the spend ledger directly'
);

select pg_temp.act_as('b2000000-0000-4000-8000-000000000002');
select is_empty($$select * from public.tool_runs$$, 'another user sees no foreign run');

-- ---------------------------------------------------------------------------------------------
-- The ledger survives deletions (COST-1)
-- ---------------------------------------------------------------------------------------------

reset role;
select results_eq(
  $$select calls, cost_usd, held_usd from private.ai_spend_daily
    where day = (now() at time zone 'utc')::date and model = 'claude-haiku-4-5-20251001'$$,
  $$values (2, 0.0168::numeric, 0.035::numeric)$$,
  'today''s ledger counts both runs and their cost, and holds the two calls never recorded'
);

select pg_temp.act_as('a2000000-0000-4000-8000-000000000001');
set local role authenticated;
delete from public.projects where id = 'a2100000-0000-4000-8000-000000000001';
reset role;

select is(
  (select count(*)::int from public.tool_runs),
  0,
  'deleting the project deletes its runs'
);
select is(
  (select sum(cost_usd) from private.ai_spend_daily where day = (now() at time zone 'utc')::date),
  0.0168::numeric,
  'and leaves today''s spend as it was'
);

set local role authenticated;
select public.delete_my_account();
reset role;

select results_eq(
  $$select sum(cost_usd), sum(held_usd) from private.ai_spend_daily
    where day = (now() at time zone 'utc')::date$$,
  $$values (0.0168::numeric, 0.035::numeric)$$,
  'deleting the account, with its reservations, leaves today''s spend and holds as they were'
);

-- ---------------------------------------------------------------------------------------------
-- The global spend cap and switching AI off (D-120)
-- ---------------------------------------------------------------------------------------------

update public.settings set value = '0.03' where key = 'ai.limit.global_daily_usd';
select pg_temp.act_as('b2000000-0000-4000-8000-000000000002');
set local role authenticated;
select is(
  public.reserve_ai_run(),
  '{"reservation": null, "reason": "global_cap"}'::jsonb,
  'calls never recorded count towards the cap at their most: 0.0168 spent and 0.035 held pass 0.03'
);

reset role;
update public.settings set value = '0.01' where key = 'ai.limit.global_daily_usd';
set local role authenticated;
select is(
  public.reserve_ai_run(),
  '{"reservation": null, "reason": "global_cap"}'::jsonb,
  'no call is allowed once today''s spend reaches the cap, deleted runs included'
);

reset role;
update public.settings set value = '0' where key = 'ai.limit.global_daily_usd';
set local role authenticated;
select is(public.reserve_ai_run() ->> 'reason', 'disabled', 'a cap of 0 turns AI off');

reset role;
update public.settings set value = '5' where key = 'ai.limit.global_daily_usd';
update public.settings set value = '"claude-unpriced"' where key = 'ai.model.fast';
set local role authenticated;
select is(
  public.reserve_ai_run() ->> 'reason',
  'disabled',
  'a fast model without a price turns AI off, so no call is held or counted as free'
);

reset role;
update public.settings set value = '"claude-haiku-4-5-20251001"' where key = 'ai.model.fast';
delete from public.settings where key = 'ai.limit.tokens_in_per_call';
set local role authenticated;
select is(
  public.reserve_ai_run() ->> 'reason',
  'disabled',
  'without a token bound, no call is allowed'
);

select * from finish();

rollback;
