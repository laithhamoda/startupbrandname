-- M7 steps 4 and 6b: the project limit (D-313), one project per purchase (D-320).
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email, created_at) values
  ('a9000000-0000-4000-8000-000000000001', 'limits-free@example.test', now()),
  ('a9000000-0000-4000-8000-000000000002', 'limits-paid@example.test', now()),
  ('a9000000-0000-4000-8000-000000000003', 'limits-course@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('a9000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('a9000000-0000-4000-8000-000000000002', 'JO', 'ar', true),
  ('a9000000-0000-4000-8000-000000000003', 'DZ', 'ar', true);

-- A refunded package, an expired one and a running «استراتيجي» for the paid account; the course
-- account has a running voucher without an end date.
insert into public.subscriptions (user_id, plan_id, source, status, starts_at, ends_at) values
  ('a9000000-0000-4000-8000-000000000002', 'commander', 'admin', 'ended', now() - interval '2 days', now() + interval '300 days'),
  ('a9000000-0000-4000-8000-000000000002', 'commander', 'admin', 'active', now() - interval '400 days', now() - interval '35 days'),
  ('a9000000-0000-4000-8000-000000000002', 'strategist', 'admin', 'active', now() - interval '1 day', now() + interval '364 days'),
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
  'strategist',
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
  $$select public.create_project('one', 'JO', 'JOD', 'standard')$$,
  'an account creates a project without a package'
);
select throws_ok(
  $$select public.create_project('two', 'JO', 'JOD', 'standard')$$,
  'SB001', null, 'and no second one while the first has no package (D-320)'
);
reset role;

-- The first project gets its own package; then a second unpaid project is allowed, not a third.
insert into public.subscriptions (user_id, project_id, plan_id, source, status, starts_at, ends_at)
select user_id, id, 'strategist', 'admin', 'active', now() - interval '1 day', now() + interval '364 days'
from public.projects where user_id = 'a9000000-0000-4000-8000-000000000002' and title = 'one';

set local role authenticated;
select pg_temp.act_as('a9000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.create_project('two', 'JO', 'JOD', 'standard')$$,
  'a paid project does not count, so a new unpaid one is allowed'
);
select throws_ok(
  $$select public.create_project('three', 'JO', 'JOD', 'standard')$$,
  'SB001', null, 'but only one unpaid project at a time'
);
reset role;

-- A refunded package no longer covers its project.
update public.subscriptions set status = 'ended'
where project_id = (select id from public.projects where title = 'one' and user_id = 'a9000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.act_as('a9000000-0000-4000-8000-000000000002');
select is(
  (select count(*)::int from public.projects),
  2,
  'the account keeps both projects after a refund'
);
select throws_ok(
  $$select public.create_project('three', 'JO', 'JOD', 'standard')$$,
  'SB001', null, 'and creates no other while both are unpaid'
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
