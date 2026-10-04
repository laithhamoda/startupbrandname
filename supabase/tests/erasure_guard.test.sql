-- SPEC §11, GDPR Art. 17: deleting an account or a project deletes everything that hangs off it.
-- Fails CI as soon as a foreign key into a table that such a deletion empties (auth.users,
-- public.projects and every table that cascades from them, at any depth) neither cascades nor sets
-- a nullable column to null, so a deletion would be refused or leave rows behind; or as soon as a
-- user_id or project_id column has no foreign key into such a table, so a deletion never reaches
-- it. ON DELETE SET NULL passes without review: the row stays but no longer points at the account
-- or the project, so such a table must hold nothing else that identifies the founder. A record that
-- has to keep its owner's id (for example a payment record kept for tax law, OPEN-QUESTIONS #31)
-- has no such foreign key, or one that does not erase, and goes in erasure_allowlist below with
-- its reason.
begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

create temporary table erasure_allowlist (
  -- schema.table.constraint for a foreign key, schema.table.column for a column without one
  name text primary key,
  reason text not null check (btrim(reason) <> '')
);

-- Every foreign key from a table in public or private into a table that a deletion empties, and
-- whether it lets the deletion through (erases).
create temporary view erasure_foreign_keys as
with recursive emptied (relid) as (
  values ('auth.users'::regclass::oid), ('public.projects'::regclass::oid)
  union
  select k.conrelid
  from pg_constraint k
  join emptied e on e.relid = k.confrelid
  where k.contype = 'f'
    and k.confdeltype = 'c'
)
select
  k.conrelid as table_id,
  k.conkey as key_columns,
  format('%I.%I', n.nspname, c.relname) as table_name,
  format('%I.%I.%I', n.nspname, c.relname, k.conname) as foreign_key,
  k.confdeltype = 'c'
    or (
      k.confdeltype = 'n'
      and not exists (
        select 1 from pg_attribute a
        where a.attrelid = k.conrelid and a.attnum = any (k.conkey) and a.attnotnull
      )
    ) as erases
from pg_constraint k
join emptied e on e.relid = k.confrelid
join pg_class c on c.oid = k.conrelid
join pg_namespace n on n.oid = c.relnamespace
where k.contype = 'f'
  and n.nspname in ('public', 'private');

-- Every user_id or project_id column in public or private without a foreign key into a table that
-- a deletion empties: a key into any other table does not bring the deletion to the row.
create temporary view erasure_owner_columns as
select format('%I.%I.%I', n.nspname, c.relname, a.attname) as column_name
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private')
  and c.relkind in ('r', 'p')
  and a.attnum > 0
  and not a.attisdropped
  and a.attname ~ '(^|_)(user|project)_id$'
  and not exists (
    select 1 from erasure_foreign_keys f
    where f.table_id = c.oid and a.attnum = any (f.key_columns)
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
-- Foreign keys and owner columns (every table in public and private)
-- ---------------------------------------------------------------------------------------------

select bag_has(
  $$ select table_name from erasure_foreign_keys $$,
  $$
    values ('public.profiles'), ('public.consent_events'), ('public.projects'),
      ('public.answers'), ('public.tool_runs'), ('public.usage_counters')
  $$,
  'the guard sees the foreign keys of every table that holds a founder''s data'
);

select is_empty(
  $$
    select foreign_key
    from erasure_foreign_keys
    where not erases
      and foreign_key not in (select name from erasure_allowlist)
  $$,
  'every foreign key into a table a deletion empties cascades, or sets a nullable column to null'
);

select is_empty(
  $$
    select column_name
    from erasure_owner_columns
    where column_name not in (select name from erasure_allowlist)
  $$,
  'every user_id or project_id column has a foreign key into a table a deletion empties'
);

-- The guard follows cascades: a table that points at tool_runs, which go with their project, is
-- checked like one that points at the project. This one would block the deletion.
create table public.erasure_probe (
  tool_run_id bigint not null
    constraint erasure_probe_tool_run_fkey references public.tool_runs (id)
);

select is(
  (
    select erases from erasure_foreign_keys
    where foreign_key = 'public.erasure_probe.erasure_probe_tool_run_fkey'
  ),
  false,
  'the guard also checks a foreign key into a table that cascades from a project'
);

drop table public.erasure_probe;

-- A foreign key alone is not enough: this user_id points at a table that no deletion empties.
create table public.erasure_probe_target (id uuid primary key);
create table public.erasure_probe_owner (
  user_id uuid references public.erasure_probe_target (id) on delete cascade
);

select is(
  (
    select count(*)::int from erasure_owner_columns
    where column_name = 'public.erasure_probe_owner.user_id'
  ),
  1,
  'the guard flags an owner column whose foreign key points at a table no deletion empties'
);

drop table public.erasure_probe_owner, public.erasure_probe_target;

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
