-- A rating before the PDF (D-345): who may rate, what is kept, and what the admin sees.
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email, created_at) values
  ('af000000-0000-4000-8000-000000000001', 'rating-owner@example.test', now()),
  ('af000000-0000-4000-8000-000000000002', 'rating-other@example.test', now()),
  ('af000000-0000-4000-8000-000000000003', 'rating-admin@example.test', now());

insert into public.admins (user_id) values ('af000000-0000-4000-8000-000000000003');

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('af000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('af000000-0000-4000-8000-000000000002', 'JO', 'ar', true);

insert into public.projects (id, user_id, title, country_code, currency) values
  ('af100000-0000-4000-8000-000000000001', 'af000000-0000-4000-8000-000000000001', 'rated', 'JO', 'JOD');

create function pg_temp.act_as(p_user uuid, p_aal text default 'aal1') returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
$$;

-- A visitor -----------------------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$select public.rate_report('af100000-0000-4000-8000-000000000001', 0, 4::smallint, 'x')$$,
  '42501', null, 'a visitor cannot rate'
);
reset role;

-- Who may rate --------------------------------------------------------------------------------------

set local role authenticated;

select pg_temp.act_as('af000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.rate_report('af100000-0000-4000-8000-000000000001', 0, 4::smallint, 'x')$$,
  '42501', null, 'an account cannot rate the project of another'
);
select is(
  public.has_report_rating('af100000-0000-4000-8000-000000000001', 0), false,
  'and sees no rating on it'
);

select pg_temp.act_as('af000000-0000-4000-8000-000000000001');
select lives_ok(
  $$select public.rate_report('af100000-0000-4000-8000-000000000001', 0, 4::smallint, '  good  ')$$,
  'the owner rates the report of the project'
);
select is(
  public.has_report_rating('af100000-0000-4000-8000-000000000001', 0), true,
  'and it is rated for that version'
);
select is(
  public.has_report_rating('af100000-0000-4000-8000-000000000001', 1), false,
  'but not for the next version'
);
select is(
  (select comment from public.report_ratings where project_id = 'af100000-0000-4000-8000-000000000001'),
  'good', 'the comment is kept trimmed'
);

-- What is refused -----------------------------------------------------------------------------------

select throws_ok(
  $$select public.rate_report('af100000-0000-4000-8000-000000000001', 0, 6::smallint, 'x')$$,
  '22023', null, 'six stars are refused'
);
select throws_ok(
  $$select public.rate_report('af100000-0000-4000-8000-000000000001', 0, 4::smallint, repeat('x', 1001))$$,
  '22023', null, 'a comment over 1000 characters is refused'
);
select throws_ok(
  $$insert into public.report_ratings (user_id, project_id, stars)
    values ('af000000-0000-4000-8000-000000000001', 'af100000-0000-4000-8000-000000000001', 5)$$,
  '42501', null, 'the table takes no direct insert'
);

-- Changing a rating ---------------------------------------------------------------------------------

select lives_ok(
  $$select public.rate_report('af100000-0000-4000-8000-000000000001', 0, 2::smallint, 'later')$$,
  'the owner changes the rating of the same version'
);
select is(
  (select count(*)::int from public.report_ratings where project_id = 'af100000-0000-4000-8000-000000000001'),
  1, 'it is still one rating'
);

-- Who reads --------------------------------------------------------------------------------------------

select pg_temp.act_as('af000000-0000-4000-8000-000000000002');
select is(
  (select count(*)::int from public.report_ratings), 0, 'another account reads none of it'
);

-- The admin --------------------------------------------------------------------------------------------

select throws_ok(
  $$select * from public.admin_ratings_summary()$$, '42501', null, 'someone who is not an admin is refused'
);

select pg_temp.act_as('af000000-0000-4000-8000-000000000003', 'aal2');
select is(
  (select ratings::int || ' ' || average::text from public.admin_ratings_summary()),
  '1 2.00', 'the admin reads the count and the average'
);
select is(
  (select count(*)::int from public.admin_report_ratings(10)), 1, 'and the latest ratings'
);
select ok(
  pg_get_function_result('public.admin_report_ratings(integer)'::regprocedure) !~* '(user|email)',
  'the admin list carries no account identity'
);

reset role;

select * from finish();
rollback;
