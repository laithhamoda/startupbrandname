-- Projects and answers (M3a): ownership, the project limit, provenance rules and deletion.
begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, email, created_at) values
  ('a1000000-0000-4000-8000-000000000001', 'owner@example.test', now()),
  ('b1000000-0000-4000-8000-000000000002', 'stranger@example.test', now()),
  ('c1000000-0000-4000-8000-000000000003', 'incomplete@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('a1000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('b1000000-0000-4000-8000-000000000002', 'DZ', 'en', false);

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
-- Nobody signed in
-- ---------------------------------------------------------------------------------------------

set local role anon;

select throws_ok($$select * from public.projects$$, '42501', null, 'anon cannot read projects');
select throws_ok($$select * from public.answers$$, '42501', null, 'anon cannot read answers');
select throws_ok($$select * from public.settings$$, '42501', null, 'anon cannot read settings');
select throws_ok(
  $$select public.create_project('x', 'JO', 'JOD', 'quick')$$,
  '42501',
  null,
  'anon cannot create a project'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- Creating projects (D-109)
-- ---------------------------------------------------------------------------------------------

select is(
  (select value #>> '{}' from public.settings where key = 'entitlement.free.projects'),
  '1',
  'the free plan allows one project'
);

select pg_temp.act_as('c1000000-0000-4000-8000-000000000003');
set local role authenticated;

select throws_ok(
  $$select public.create_project('x', 'JO', 'JOD', 'quick')$$,
  '42501',
  'create_project: onboarding is not complete',
  'an account without onboarding cannot create a project'
);

select pg_temp.act_as('a1000000-0000-4000-8000-000000000001');

select isnt(
  public.create_project('  صيانة المكيّفات  ', 'JO', 'JOD', 'quick'),
  null,
  'an onboarded account creates its first project'
);

select is((select title from public.projects), 'صيانة المكيّفات', 'the title is stored trimmed');

select throws_ok(
  $$select public.create_project('second', 'JO', 'JOD', 'full')$$,
  'SB001',
  'create_project: project limit reached',
  'a second project is refused on the free plan'
);

select throws_ok(
  $$insert into public.projects (user_id, title, country_code, currency)
    values ('a1000000-0000-4000-8000-000000000001', 'direct', 'JO', 'JOD')$$,
  '42501',
  null,
  'projects cannot be inserted around create_project()'
);

select throws_ok(
  $$update public.projects set currency = 'USD'$$,
  '42501',
  null,
  'the currency cannot be changed after creation'
);

select lives_ok(
  $$update public.projects set title = 'صيانة', mode = 'full'$$,
  'the owner renames the project and switches its mode'
);

-- ---------------------------------------------------------------------------------------------
-- Answers and provenance (CLAUDE.md rule 2, D-104)
-- ---------------------------------------------------------------------------------------------

select lives_ok(
  $$insert into public.answers (project_id, question_id, raw_text, normalized_value, source, confidence)
    select id, 'B3', 'أصحاب المطاعم', '{"status": "answered", "value": "أصحاب المطاعم"}', 'user', 'high'
    from public.projects$$,
  'the owner saves an answer'
);

select lives_ok(
  $$insert into public.answers (project_id, question_id, normalized_value, source, confidence)
    select id, 'F1', '{"status": "unknown"}', 'assumption', 'low' from public.projects$$,
  'the owner saves «لا أعرف» as a low-confidence assumption'
);

select throws_ok(
  $$insert into public.answers (project_id, question_id, normalized_value, source, confidence)
    select id, 'F3', '{"status": "unknown"}', 'user', 'high' from public.projects$$,
  '23514',
  null,
  '«لا أعرف» cannot be stored as a confident user answer'
);

select throws_ok(
  $$insert into public.answers (project_id, question_id, normalized_value, source, confidence)
    select id, 'Z9', '{"status": "answered", "value": 1}', 'user', 'high' from public.projects$$,
  '23514',
  null,
  'only question and follow-up IDs are accepted'
);

select lives_ok(
  $$insert into public.answers (project_id, question_id, normalized_value, source, confidence)
    select id, 'F6.1', '{"status": "answered", "value": "عقد مع موزّع"}', 'user', 'medium'
    from public.projects$$,
  'follow-up answers are accepted'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- Another account (CLAUDE.md rule 6)
-- ---------------------------------------------------------------------------------------------

-- The foreign project's ID, as if it had leaked.
select set_config('test.project_id', (select id::text from public.projects), true);

select pg_temp.act_as('b1000000-0000-4000-8000-000000000002');
set local role authenticated;

select is_empty($$select * from public.projects$$, 'another account sees no foreign project');
select is_empty($$select * from public.answers$$, 'another account sees no foreign answer');

select throws_ok(
  $$insert into public.answers (project_id, question_id, normalized_value, source, confidence)
    values (current_setting('test.project_id')::uuid, 'B4', '{"status": "answered", "value": "x"}', 'user', 'high')$$,
  '42501',
  null,
  'another account cannot write into a foreign project'
);

-- Both touch no row: the foreign answers are invisible to them.
update public.answers set validated = true;
delete from public.answers;

select isnt(
  public.create_project('مشروعي', 'DZ', 'DZD', 'quick'),
  null,
  'the limit counts each account''s own projects'
);

-- From here on the other account owns a project too, so every statement names its target by ID.
select set_config('test.own_project_id', (select id::text from public.projects), true);

-- Both touch no row: the foreign project is invisible to them.
update public.projects set title = 'مشروع مسروق'
  where id = current_setting('test.project_id')::uuid;
delete from public.projects where id = current_setting('test.project_id')::uuid;

select lives_ok(
  $$insert into public.answers (project_id, question_id, normalized_value, source, confidence)
    values (current_setting('test.own_project_id')::uuid, 'C1', '{"status": "answered", "value": "x"}', 'user', 'medium')$$,
  'the other account saves an answer in its own project'
);

select throws_ok(
  $$update public.answers set project_id = current_setting('test.project_id')::uuid
    where project_id = current_setting('test.own_project_id')::uuid and question_id = 'C1'$$,
  '42501',
  null,
  'another account cannot move its own answer into a foreign project'
);

reset role;

select is(
  (select title from public.projects where id = current_setting('test.project_id')::uuid),
  'صيانة',
  'another account cannot rename a foreign project'
);

select is(
  (select count(*)::int from public.projects where id = current_setting('test.project_id')::uuid),
  1,
  'another account cannot delete a foreign project'
);

select is(
  (
    select count(*)::int from public.answers
    where project_id = current_setting('test.project_id')::uuid and validated
  ),
  0,
  'another account cannot change foreign answers'
);

select is(
  (select count(*)::int from public.answers where project_id = current_setting('test.project_id')::uuid),
  3,
  'another account cannot delete foreign answers'
);

-- ---------------------------------------------------------------------------------------------
-- Deleting the account deletes everything (SPEC §11)
-- ---------------------------------------------------------------------------------------------

delete from auth.users where id = 'a1000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::int from public.projects where user_id = 'a1000000-0000-4000-8000-000000000001'),
  0,
  'the account''s projects are deleted with it'
);

select is(
  (select count(*)::int from public.answers where project_id = current_setting('test.project_id')::uuid),
  0,
  'their answers are deleted too'
);

select is(
  (select count(*)::int from public.answers where project_id = current_setting('test.own_project_id')::uuid),
  1,
  'the other account''s answers stay'
);

select * from finish();

rollback;
