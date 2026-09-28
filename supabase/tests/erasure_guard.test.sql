-- SPEC §11, GDPR Art. 17: deleting an account or a project deletes everything that hangs off it.
-- Fails CI as soon as a foreign key to auth.users or public.projects neither cascades nor sets a
-- nullable column to null, so a deletion would be refused or leave rows behind. A foreign key that
-- must behave otherwise (for example on a payment record kept for tax law, OPEN-QUESTIONS #31) goes
-- in erasure_allowlist below with its reason.
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

create temporary table erasure_allowlist (
  -- schema.table.constraint
  foreign_key text primary key,
  reason text not null check (btrim(reason) <> '')
);

insert into auth.users (id, email, created_at) values
  ('a3000000-0000-4000-8000-000000000001', 'erasure@example.test', now());

insert into public.projects (id, user_id, title, country_code, currency) values
  ('a3100000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'kept', 'JO', 'JOD'),
  ('a3100000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 'deleted', 'JO', 'JOD');

insert into public.answers (project_id, question_id, normalized_value, source, confidence) values
  ('a3100000-0000-4000-8000-000000000001', 'B3', '{"status": "answered", "value": "x"}', 'user', 'medium'),
  ('a3100000-0000-4000-8000-000000000002', 'B3', '{"status": "answered", "value": "x"}', 'user', 'medium');

insert into public.tool_runs (project_id, tool_id, input_hash, output) values
  ('a3100000-0000-4000-8000-000000000001', 'review_text', repeat('a', 64), '{}'),
  ('a3100000-0000-4000-8000-000000000002', 'review_text', repeat('b', 64), '{}');

insert into public.usage_counters (user_id, key, period_start, count) values
  ('a3000000-0000-4000-8000-000000000001', 'ai_calls', current_date, 1);

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
-- Foreign keys (every table this repository creates, in public and private)
-- ---------------------------------------------------------------------------------------------

select bag_has(
  $$
    select format('%I.%I', n.nspname, c.relname)
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where k.contype = 'f'
      and k.confrelid in ('auth.users'::regclass, 'public.projects'::regclass)
      and n.nspname in ('public', 'private')
  $$,
  $$
    values ('public.profiles'), ('public.consent_events'), ('public.projects'),
      ('public.answers'), ('public.tool_runs'), ('public.usage_counters')
  $$,
  'the guard sees the foreign keys of every table that holds a founder''s data'
);

select is_empty(
  $$
    select format('%I.%I.%I', n.nspname, c.relname, k.conname)
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where k.contype = 'f'
      and k.confrelid in ('auth.users'::regclass, 'public.projects'::regclass)
      and n.nspname in ('public', 'private')
      and (
        k.confdeltype not in ('c', 'n')
        or (
          k.confdeltype = 'n'
          and exists (
            select 1 from pg_attribute a
            where a.attrelid = k.conrelid and a.attnum = any (k.conkey) and a.attnotnull
          )
        )
      )
      and format('%I.%I.%I', n.nspname, c.relname, k.conname)
        not in (select foreign_key from erasure_allowlist)
  $$,
  'every foreign key to an account or a project cascades, or sets a nullable column to null'
);

-- ---------------------------------------------------------------------------------------------
-- Deleting a project (as its owner, through RLS)
-- ---------------------------------------------------------------------------------------------

select pg_temp.act_as('a3000000-0000-4000-8000-000000000001');
set local role authenticated;

select lives_ok(
  $$delete from public.projects where id = 'a3100000-0000-4000-8000-000000000002'$$,
  'the owner deletes a project'
);

reset role;

select is(
  (select count(*)::int from public.answers where project_id = 'a3100000-0000-4000-8000-000000000002'),
  0,
  'the project''s answers are deleted with it'
);

select is(
  (select count(*)::int from public.tool_runs where project_id = 'a3100000-0000-4000-8000-000000000002'),
  0,
  'the project''s tool runs are deleted with it'
);

-- ---------------------------------------------------------------------------------------------
-- Deleting the account (delete_my_account, the self-service path)
-- ---------------------------------------------------------------------------------------------

select pg_temp.act_as('a3000000-0000-4000-8000-000000000001');
set local role authenticated;

select lives_ok($$select public.delete_my_account()$$, 'the owner deletes the account');

reset role;

select is(
  (select count(*)::int from public.tool_runs where project_id = 'a3100000-0000-4000-8000-000000000001'),
  0,
  'the tool runs of the account''s projects are deleted with it'
);

select is(
  (select count(*)::int from public.usage_counters where user_id = 'a3000000-0000-4000-8000-000000000001'),
  0,
  'the account''s usage counters are deleted with it'
);

select * from finish();

rollback;
