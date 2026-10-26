-- M7 step 4: the project limit follows the account's package (D-313).
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, created_at) values
  ('a9000000-0000-4000-8000-000000000001', 'limits-free@example.test', now()),
  ('a9000000-0000-4000-8000-000000000002', 'limits-paid@example.test', now()),
  ('a9000000-0000-4000-8000-000000000003', 'limits-course@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('a9000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('a9000000-0000-4000-8000-000000000002', 'JO', 'ar', true),
  ('a9000000-0000-4000-8000-000000000003', 'DZ', 'ar', true);

-- A refunded package, an expired one and a running «متردد» for the paid account; the course
-- account has a running voucher without an end date.
insert into public.subscriptions (user_id, plan_id, source, status, starts_at, ends_at) values
  ('a9000000-0000-4000-8000-000000000002', 'adventurer', 'admin', 'ended', now() - interval '2 days', now() + interval '300 days'),
  ('a9000000-0000-4000-8000-000000000002', 'adventurer', 'admin', 'active', now() - interval '400 days', now() - interval '35 days'),
  ('a9000000-0000-4000-8000-000000000002', 'standard', 'admin', 'active', now() - interval '1 day', now() + interval '364 days'),
  ('a9000000-0000-4000-8000-000000000003', 'course', 'voucher', 'active', now() - interval '1 day', null);

create function pg_temp.act_as(p_user uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
$$;

select is(private.account_plan('a9000000-0000-4000-8000-000000000001'), 'free', 'no package means free');
select is(
  private.account_plan('a9000000-0000-4000-8000-000000000002'),
  'standard',
  'a refunded or expired package does not count; the running one does'
);
select is(private.account_plan('a9000000-0000-4000-8000-000000000003'), 'course', 'a voucher without an end runs');

set local role authenticated;

select pg_temp.act_as('a9000000-0000-4000-8000-000000000001');
select lives_ok($$select public.create_project('one', 'JO', 'JOD', 'quick')$$, 'a free account creates its project');
select throws_ok(
  $$select public.create_project('two', 'JO', 'JOD', 'quick')$$,
  'SB001', null, 'a free account stops at one project'
);

select pg_temp.act_as('a9000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.create_project('one', 'JO', 'JOD', 'standard'),
           public.create_project('two', 'JO', 'JOD', 'standard'),
           public.create_project('three', 'JO', 'JOD', 'standard')$$,
  'a paid package creates three projects'
);
select throws_ok(
  $$select public.create_project('four', 'JO', 'JOD', 'standard')$$,
  'SB001', null, 'and stops at three'
);

select pg_temp.act_as('a9000000-0000-4000-8000-000000000003');
select lives_ok(
  $$select public.create_project('a', 'DZ', 'DZD', 'full'), public.create_project('b', 'DZ', 'DZD', 'full'),
           public.create_project('c', 'DZ', 'DZD', 'full'), public.create_project('d', 'DZ', 'DZD', 'full')$$,
  'a course voucher has no project limit'
);

select throws_ok(
  $$select private.account_plan('a9000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'a user cannot call account_plan'
);

reset role;

select * from finish();

rollback;
