-- The «استراتيجي» numbers report kind (D-316): reports.kind accepts summary, standard and full only.
begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select ok(
  pg_get_constraintdef((select oid from pg_constraint where conname = 'reports_kind_check'))
    like '%standard%',
  'a stored report may be the numbers report'
);
select ok(
  pg_get_constraintdef((select oid from pg_constraint where conname = 'reports_kind_check'))
    not like '%lean%',
  'and no kind beyond the three'
);

select * from finish();

rollback;
