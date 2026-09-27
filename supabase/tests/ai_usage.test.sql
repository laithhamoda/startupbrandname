-- AI usage (M3c): the model settings, the daily limits and the run log (D-103, D-120).
begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, email, created_at) values
  ('a2000000-0000-4000-8000-000000000001', 'ai-owner@example.test', now()),
  ('b2000000-0000-4000-8000-000000000002', 'ai-stranger@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('a2000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('b2000000-0000-4000-8000-000000000002', 'DZ', 'ar', true);

insert into public.projects (id, user_id, title, country_code, currency) values
  ('a2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'p', 'JO', 'JOD');

create function pg_temp.act_as(p_user uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Settings (CLAUDE.md rule 10, D-120, D-122)
-- ---------------------------------------------------------------------------------------------

select is(
  (select value #>> '{}' from public.settings where key = 'ai.model.fast'),
  'claude-haiku-4-5-20251001',
  'the fast model is Haiku 4.5'
);
select is(
  (select value ->> 'source_url' from public.settings where key = 'ai.price.claude-haiku-4-5-20251001'),
  'https://platform.claude.com/docs/en/about-claude/pricing',
  'the price records where it was read'
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

-- ---------------------------------------------------------------------------------------------
-- Nobody signed in
-- ---------------------------------------------------------------------------------------------

set local role anon;
select throws_ok($$select public.reserve_ai_call()$$, '42501', null, 'anon cannot reserve a call');
select throws_ok($$select * from public.tool_runs$$, '42501', null, 'anon cannot read tool runs');
reset role;

-- ---------------------------------------------------------------------------------------------
-- The daily limit per user
-- ---------------------------------------------------------------------------------------------

update public.settings set value = '2' where key = 'ai.limit.user_daily_calls';

select pg_temp.act_as('a2000000-0000-4000-8000-000000000001');
set local role authenticated;

select ok(public.reserve_ai_call(), 'the first call of the day is allowed');
select ok(public.reserve_ai_call(), 'the second call is allowed');
select ok(not public.reserve_ai_call(), 'the third call passes the limit and is refused');
select is(
  (select count from public.usage_counters where key = 'ai_calls'),
  2,
  'the counter stops at the limit'
);

select pg_temp.act_as('b2000000-0000-4000-8000-000000000002');
select ok(public.reserve_ai_call(), 'another user has their own limit');
select is_empty(
  $$select * from public.usage_counters where user_id <> 'b2000000-0000-4000-8000-000000000002'$$,
  'a user sees only their own counters'
);

-- ---------------------------------------------------------------------------------------------
-- Recording runs, and the global spend cap
-- ---------------------------------------------------------------------------------------------

select throws_ok(
  $$select public.record_tool_run('a2100000-0000-4000-8000-000000000001', 'review_text', repeat('a', 64),
    '{}', 'm', 'v1', 1, 1, 0, 0, 0.01)$$,
  '42501',
  'record_tool_run: not your project',
  'nobody records a run on a project that is not theirs'
);

select pg_temp.act_as('a2000000-0000-4000-8000-000000000001');

select isnt(
  public.record_tool_run('a2100000-0000-4000-8000-000000000001', 'review_text', repeat('a', 64),
    '{"language": "msa"}', 'claude-haiku-4-5-20251001', 'review-text-1', 900, 80, 0, 0, 0.0013),
  null,
  'the owner records a run'
);

select throws_ok(
  $$insert into public.tool_runs (project_id, tool_id, input_hash, output)
    values ('a2100000-0000-4000-8000-000000000001', 'x', repeat('a', 64), '{}')$$,
  '42501',
  null,
  'tool runs cannot be written around record_tool_run()'
);

select pg_temp.act_as('b2000000-0000-4000-8000-000000000002');
select is_empty($$select * from public.tool_runs$$, 'another user sees no foreign run');

reset role;
update public.settings set value = '40' where key = 'ai.limit.user_daily_calls';
update public.settings set value = '0.001' where key = 'ai.limit.global_daily_usd';

select pg_temp.act_as('b2000000-0000-4000-8000-000000000002');
set local role authenticated;
select ok(not public.reserve_ai_call(), 'no call is allowed once today''s spend reaches the cap');

reset role;
update public.settings set value = '0' where key = 'ai.limit.global_daily_usd';
select pg_temp.act_as('b2000000-0000-4000-8000-000000000002');
set local role authenticated;
select ok(not public.reserve_ai_call(), 'a cap of 0 turns AI off');

select * from finish();

rollback;
