-- Report versions without a limit (D-343): null settings mean no cap, numbers bring it back.
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, created_at) values
  ('ac000000-0000-4000-8000-000000000001', 'unlimited-versions@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('ac000000-0000-4000-8000-000000000001', 'JO', 'ar', true);

insert into public.projects (id, user_id, title, country_code, currency, mode) values
  ('ac100000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001', 'paid', 'JO', 'JOD', 'standard');

insert into public.answers (project_id, question_id, normalized_value, source, confidence) values
  ('ac100000-0000-4000-8000-000000000001', 'B1', '{"status": "answered", "value": "idea"}', 'user', 'medium');

insert into public.subscriptions (user_id, project_id, plan_id, source, status, starts_at, ends_at) values
  ('ac000000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001', 'strategist', 'admin', 'active', now() - interval '1 day', now() + interval '364 days');

create function pg_temp.act_as(p_user uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
$$;

create function pg_temp.h(p_n integer) returns text
language sql
as $$ select lpad(to_hex(p_n), 64, '0') $$;

grant execute on function pg_temp.h(integer) to authenticated;

-- The migration lifted both limits ----------------------------------------------------------------------

select is(
  (select count(*)::int from public.settings
   where key in ('versions.max', 'versions.after_go') and value = 'null'::jsonb),
  2, 'the migration sets both limits to null'
);

set local role authenticated;
select pg_temp.act_as('ac000000-0000-4000-8000-000000000001');

-- Twelve versions, the first of them a go: past the old 10 and the old 5 after a go.
select lives_ok(
  $$select public.record_report_version('ac100000-0000-4000-8000-000000000001', pg_temp.h(n), 'go')
    from generate_series(1, 12) as n$$,
  'twelve versions, with a go among them, are recorded'
);
reset role;

select is(
  (select count(*)::int from public.report_versions
   where project_id = 'ac100000-0000-4000-8000-000000000001'),
  12, 'and all twelve are kept'
);

-- A number brings the cap back -----------------------------------------------------------------------------

update public.settings set value = '12' where key = 'versions.max';

set local role authenticated;
select pg_temp.act_as('ac000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select public.record_report_version('ac100000-0000-4000-8000-000000000001', pg_temp.h(13), 'revise')$$,
  'SB002', null, 'a numeric versions.max limits again'
);
reset role;

update public.settings set value = 'null'::jsonb where key = 'versions.max';
update public.settings set value = '3' where key = 'versions.after_go';

set local role authenticated;
select pg_temp.act_as('ac000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select public.record_report_version('ac100000-0000-4000-8000-000000000001', pg_temp.h(14), 'revise')$$,
  'SB002', null, 'so does a numeric versions.after_go, after the first go'
);
reset role;

update public.settings set value = 'null'::jsonb where key = 'versions.after_go';

set local role authenticated;
select pg_temp.act_as('ac000000-0000-4000-8000-000000000001');
select is(
  public.record_report_version('ac100000-0000-4000-8000-000000000001', pg_temp.h(15), 'revise'),
  13, 'and null again means no limit'
);
reset role;

select * from finish();
rollback;
