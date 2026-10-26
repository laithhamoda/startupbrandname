-- The standard diagnostic mode (D-314): projects.mode accepts quick, standard and full only.
begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

insert into auth.users (id, email, created_at) values
  ('a8000000-0000-4000-8000-000000000001', 'standard-mode@example.test', now());

select lives_ok(
  $$insert into public.projects (user_id, title, country_code, currency, mode)
    values ('a8000000-0000-4000-8000-000000000001', 'standard', 'JO', 'JOD', 'standard')$$,
  'a project can follow the standard diagnostic'
);
select lives_ok(
  $$insert into public.projects (user_id, title, country_code, currency, mode)
    values ('a8000000-0000-4000-8000-000000000001', 'quick', 'JO', 'JOD', 'quick')$$,
  'quick stays valid'
);
select throws_ok(
  $$insert into public.projects (user_id, title, country_code, currency, mode)
    values ('a8000000-0000-4000-8000-000000000001', 'other', 'JO', 'JOD', 'medium')$$,
  '23514', null, 'any other mode is refused'
);

select * from finish();

rollback;
