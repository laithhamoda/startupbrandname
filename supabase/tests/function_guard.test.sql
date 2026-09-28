-- CLAUDE.md rule 6 and D-085: functions that run with their owner's rights stay closed.
-- Fails CI as soon as a SECURITY DEFINER function in public or private leaves its search_path open
-- to the caller, or a SECURITY DEFINER function in public can be run by visitors who are not
-- signed in. Functions that belong to an extension are not ours and are skipped.
begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

select isnt_empty(
  $$
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  $$,
  'the guard sees the SECURITY DEFINER functions in public'
);

select is_empty(
  $$
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
      and not exists (
        select 1 from unnest(p.proconfig) as c(setting)
        where c.setting like 'search_path=%'
      )
  $$,
  'every SECURITY DEFINER function sets its search_path'
);

-- A function that must ever be open to visitors needs its own reviewed exception here.
select is_empty(
  $$
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
      and has_function_privilege('anon', p.oid, 'execute')
  $$,
  'anon cannot run any SECURITY DEFINER function in public'
);

select * from finish();

rollback;
