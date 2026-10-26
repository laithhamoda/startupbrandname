-- M7 step 6c: report versions, the final version and the locked core answers (D-321).
begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

insert into auth.users (id, email, created_at) values
  ('ab000000-0000-4000-8000-000000000001', 'versions-paid@example.test', now()),
  ('ab000000-0000-4000-8000-000000000002', 'versions-free@example.test', now()),
  ('ab000000-0000-4000-8000-000000000003', 'versions-go@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('ab000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('ab000000-0000-4000-8000-000000000002', 'JO', 'ar', true),
  ('ab000000-0000-4000-8000-000000000003', 'DZ', 'ar', true);

insert into public.projects (id, user_id, title, country_code, currency, mode) values
  ('ab100000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'paid', 'JO', 'JOD', 'standard'),
  ('ab100000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000002', 'free', 'JO', 'JOD', 'quick'),
  ('ab100000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000003', 'go', 'DZ', 'DZD', 'full');

insert into public.answers (project_id, question_id, normalized_value, source, confidence) values
  ('ab100000-0000-4000-8000-000000000001', 'B1', '{"status": "answered", "value": "idea"}', 'user', 'medium'),
  ('ab100000-0000-4000-8000-000000000001', 'F3', '{"status": "answered", "value": "100"}', 'user', 'medium'),
  ('ab100000-0000-4000-8000-000000000002', 'B1', '{"status": "answered", "value": "idea"}', 'user', 'medium'),
  ('ab100000-0000-4000-8000-000000000003', 'B1', '{"status": "answered", "value": "idea"}', 'user', 'medium');

-- A package bought for the paid project; a course voucher covers the "go" account.
insert into public.subscriptions (user_id, project_id, plan_id, source, status, starts_at, ends_at) values
  ('ab000000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001', 'strategist', 'admin', 'active', now() - interval '1 day', now() + interval '364 days'),
  ('ab000000-0000-4000-8000-000000000003', null, 'course', 'voucher', 'active', now() - interval '1 day', null);

create function pg_temp.act_as(p_user uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
$$;

-- A 64-character hash from a number, so each version has its own.
create function pg_temp.h(p_n integer) returns text
language sql
as $$ select lpad(to_hex(p_n), 64, '0') $$;

grant execute on function pg_temp.h(integer) to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------------------------------
-- Who may record
-- ---------------------------------------------------------------------------------------------

select pg_temp.act_as('ab000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.record_report_version('ab100000-0000-4000-8000-000000000002', pg_temp.h(1), 'stop')$$,
  '42501', null, 'a project without a package records no version'
);
select throws_ok(
  $$select public.record_report_version('ab100000-0000-4000-8000-000000000001', pg_temp.h(1), 'stop')$$,
  '42501', null, 'nobody records a version of another user''s project'
);
select lives_ok(
  $$update public.answers set normalized_value = '{"status": "answered", "value": "other idea"}'
    where project_id = 'ab100000-0000-4000-8000-000000000002' and question_id = 'B1'$$,
  'a free project changes its core answers freely'
);

-- ---------------------------------------------------------------------------------------------
-- Ten versions while the verdict is revise or stop
-- ---------------------------------------------------------------------------------------------

select pg_temp.act_as('ab000000-0000-4000-8000-000000000001');
select is(
  public.record_report_version('ab100000-0000-4000-8000-000000000001', pg_temp.h(1), 'stop'),
  1,
  'the first report of a paid project is version 1'
);
select is(
  (select jsonb_array_length(answers) from public.report_versions
   where project_id = 'ab100000-0000-4000-8000-000000000001' and number = 1),
  2,
  'a version keeps a copy of the answers it was made from'
);
select is(
  public.record_report_version('ab100000-0000-4000-8000-000000000001', pg_temp.h(1), 'stop'),
  1,
  'the same answers give back the same version'
);
select throws_ok(
  $$select public.record_report_version('ab100000-0000-4000-8000-000000000001', pg_temp.h(2), 'maybe')$$,
  '22023', null, 'an unknown verdict is refused'
);

update public.answers set normalized_value = '{"status": "answered", "value": "200"}'
where project_id = 'ab100000-0000-4000-8000-000000000001' and question_id = 'F3';

select lives_ok(
  $$select public.record_report_version('ab100000-0000-4000-8000-000000000001', pg_temp.h(n), 'revise')
    from generate_series(2, 10) as n$$,
  'versions 2 to 10 while the verdict is revise'
);
select throws_ok(
  $$select public.record_report_version('ab100000-0000-4000-8000-000000000001', pg_temp.h(11), 'revise')$$,
  'SB002', null, 'no eleventh version'
);

-- ---------------------------------------------------------------------------------------------
-- Core answers
-- ---------------------------------------------------------------------------------------------

select throws_ok(
  $$update public.answers set normalized_value = '{"status": "answered", "value": "another idea"}'
    where project_id = 'ab100000-0000-4000-8000-000000000001' and question_id = 'B1'$$,
  'SB004', null, 'the idea of a paid project cannot change'
);
select throws_ok(
  $$delete from public.answers
    where project_id = 'ab100000-0000-4000-8000-000000000001' and question_id = 'B1'$$,
  'SB004', null, 'nor be removed'
);
select lives_ok(
  $$update public.answers set normalized_value = '{"status": "answered", "value": "idea"}'
    where project_id = 'ab100000-0000-4000-8000-000000000001' and question_id = 'B1'$$,
  'saving the same core answer again is not a change'
);
select lives_ok(
  $$insert into public.answers (project_id, question_id, normalized_value, source, confidence)
    values ('ab100000-0000-4000-8000-000000000001', 'D2', '{"status": "answered", "value": "food"}', 'user', 'medium')$$,
  'a core question answered for the first time is welcome'
);

-- ---------------------------------------------------------------------------------------------
-- The final version
-- ---------------------------------------------------------------------------------------------

select throws_ok(
  $$select public.choose_final_version('ab100000-0000-4000-8000-000000000001', 11)$$,
  '22023', null, 'only a recorded version can be chosen'
);
select lives_ok(
  $$select public.choose_final_version('ab100000-0000-4000-8000-000000000001', 1)$$,
  'the founder chooses version 1 as final'
);
select is(
  (select normalized_value ->> 'value' from public.answers
   where project_id = 'ab100000-0000-4000-8000-000000000001' and question_id = 'F3'),
  '100',
  'the answers become the final version''s again'
);
select is(
  (select count(*)::int from public.answers where project_id = 'ab100000-0000-4000-8000-000000000001'),
  2,
  'an answer given after that version is gone'
);
select is(
  (select final_version from public.projects where id = 'ab100000-0000-4000-8000-000000000001'),
  1,
  'the project records its final version'
);
select throws_ok(
  $$update public.answers set normalized_value = '{"status": "answered", "value": "300"}'
    where project_id = 'ab100000-0000-4000-8000-000000000001' and question_id = 'F3'$$,
  'SB003', null, 'the answers of a closed project cannot change'
);
select throws_ok(
  $$select public.choose_final_version('ab100000-0000-4000-8000-000000000001', 2)$$,
  'SB003', null, 'the final version is chosen once'
);
select throws_ok(
  $$select public.record_report_version('ab100000-0000-4000-8000-000000000001', pg_temp.h(12), 'go')$$,
  'SB003', null, 'and a closed project records no version'
);
select throws_ok(
  $$update public.projects set final_version = null where id = 'ab100000-0000-4000-8000-000000000001'$$,
  '42501', null, 'the founder cannot reopen the project'
);

-- ---------------------------------------------------------------------------------------------
-- Five more after «امضِ», under a course voucher
-- ---------------------------------------------------------------------------------------------

select pg_temp.act_as('ab000000-0000-4000-8000-000000000003');
select lives_ok(
  $$select public.record_report_version('ab100000-0000-4000-8000-000000000003', pg_temp.h(n),
      case when n < 3 then 'revise' else 'go' end)
    from generate_series(1, 8) as n$$,
  'a course voucher records versions; the first go is version 3, then five more'
);
select throws_ok(
  $$select public.record_report_version('ab100000-0000-4000-8000-000000000003', pg_temp.h(9), 'go')$$,
  'SB002', null, 'no sixth version after the first go'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- Reading, and deleting a paid project
-- ---------------------------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$select public.record_report_version('ab100000-0000-4000-8000-000000000003', pg_temp.h(9), 'go')$$,
  '42501', null, 'a visitor records nothing'
);
reset role;

set local role authenticated;
select pg_temp.act_as('ab000000-0000-4000-8000-000000000002');
select is(
  (select count(*)::int from public.report_versions),
  0,
  'a user reads no other user''s versions'
);
reset role;

delete from public.projects where id = 'ab100000-0000-4000-8000-000000000003';
select is(
  (select count(*)::int from public.report_versions where project_id = 'ab100000-0000-4000-8000-000000000003'),
  0,
  'deleting a paid project deletes its versions and its locked answers'
);

select * from finish();

rollback;
