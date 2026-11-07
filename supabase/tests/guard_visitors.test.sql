-- Payment, rating and report records belong to an account, not to a visitor (D-355).
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, email_confirmed_at, is_anonymous, created_at) values
  ('c2000000-0000-4000-8000-000000000001', null, null, true, now());

create function pg_temp.act_as(p_user uuid, p_anonymous boolean) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user::text, 'role', 'authenticated', 'aal', 'aal1', 'is_anonymous', p_anonymous
    )::text,
    true
  );
$$;

set local role authenticated;
select pg_temp.act_as('c2000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$select public.start_checkout('monthly', 'c2000000-0000-4000-8000-0000000000aa', true)$$,
  '42501', null, 'a visitor starts no checkout'
);
select throws_ok(
  $$select public.rate_report('c2000000-0000-4000-8000-0000000000aa', 1, 5::smallint, null)$$,
  '42501', null, 'a visitor rates no report'
);
select is(
  public.has_report_rating('c2000000-0000-4000-8000-0000000000aa', 1), false,
  'a visitor has rated nothing'
);
select throws_ok(
  $$select public.record_report('c2000000-0000-4000-8000-0000000000bb', 'c2000000-0000-4000-8000-0000000000aa',
    'full', 'ar', 'founder', repeat('a', 64), '1.0.0', 'x/y.pdf', 10)$$,
  '42501', null, 'a visitor records no report'
);
select throws_ok(
  $$select public.record_report_version('c2000000-0000-4000-8000-0000000000aa', repeat('a', 64), 'go')$$,
  '42501', null, 'a visitor records no report version'
);
select throws_ok(
  $$select public.choose_final_version('c2000000-0000-4000-8000-0000000000aa', 1)$$,
  '42501', null, 'a visitor chooses no final version'
);

reset role;

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname like '%\_impl' escape '\'),
  6, 'the six original bodies live in the private schema'
);
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname like '%\_impl' escape '\'
     and (has_function_privilege('authenticated', p.oid, 'execute')
       or has_function_privilege('anon', p.oid, 'execute'))),
  0, 'no signed-in user or anon reaches an original body directly'
);
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('start_checkout', 'rate_report', 'has_report_rating', 'record_report',
       'record_report_version', 'choose_final_version')
     and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon reaches none of the six wrappers'
);

select * from finish();
rollback;
