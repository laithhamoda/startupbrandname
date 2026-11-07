-- Visitor hygiene (D-352): settings are limited to what the app reads, and old anonymous visitors go.
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, email_confirmed_at, is_anonymous, created_at) values
  ('d1000000-0000-4000-8000-000000000001', null, null, true, now() - interval '31 days'),
  ('d1000000-0000-4000-8000-000000000002', null, null, true, now() - interval '5 days'),
  ('d1000000-0000-4000-8000-000000000003', 'kept@example.test', now(), false, now() - interval '90 days'),
  ('d1000000-0000-4000-8000-000000000004', null, null, true, now() - interval '31 days');

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('d1000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('d1000000-0000-4000-8000-000000000002', 'JO', 'ar', true),
  ('d1000000-0000-4000-8000-000000000003', 'JO', 'ar', true),
  ('d1000000-0000-4000-8000-000000000004', 'JO', 'ar', true);

insert into public.projects (user_id, title, country_code, currency, mode) values
  ('d1000000-0000-4000-8000-000000000001', 'old visitor', 'JO', 'JOD', 'full');

-- Settings ------------------------------------------------------------------------------------------------

create function pg_temp.act_as(p_user uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'aal', 'aal1')::text,
    true
  );
$$;

select pg_temp.act_as('d1000000-0000-4000-8000-000000000003');
set local role authenticated;

select is(
  (select count(*)::integer from public.settings where key in ('ai.model.fast', 'report.pdf_per_day')),
  2, 'a signed-in user reads the settings the app reads for them'
);
select is(
  (select count(*)::integer from public.settings where key like 'auth.limit.%' or key like 'ai.limit.%'),
  0, 'but not the request limits or the spend caps'
);
select is(
  (select count(*)::integer from public.settings where key in ('launch.spots_total', 'payments.checkouts_per_day')),
  0, 'nor the launch numbers or the payment limits'
);

reset role;

-- Old anonymous visitors ----------------------------------------------------------------------------------

select is(private.purge_anonymous_visitors(), 2, 'two anonymous visitors are older than 30 days');
select is(
  (select count(*)::integer from auth.users where id = 'd1000000-0000-4000-8000-000000000001'),
  0, 'the old visitor is gone'
);
select is(
  (select count(*)::integer from public.projects where user_id = 'd1000000-0000-4000-8000-000000000001'),
  0, 'with their project'
);
select is(
  (select count(*)::integer from auth.users where id = 'd1000000-0000-4000-8000-000000000002'),
  1, 'a recent visitor stays'
);
select is(
  (select count(*)::integer from auth.users where id = 'd1000000-0000-4000-8000-000000000003'),
  1, 'an account with an email stays, however old'
);

update public.settings set value = '3' where key = 'anonymous.keep_days';
select is(private.purge_anonymous_visitors(), 1, 'the number of days is a setting');

select * from finish();
rollback;
