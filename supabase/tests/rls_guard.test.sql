-- CLAUDE.md rule 6: every table exposed through the Data API has row level security.
-- Fails CI as soon as a migration adds a table in `public` without enabling RLS.
begin;

create extension if not exists pgtap with schema extensions;

select plan(1);

select is_empty(
  $$
    select format('%I.%I', n.nspname, c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'every table in public has row level security enabled'
);

select * from finish();

rollback;
