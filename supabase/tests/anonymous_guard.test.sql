-- The first visit without signup (D-350): an anonymous visitor holds no launch spot.
begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, email_confirmed_at, is_anonymous, created_at) values
  ('c1000000-0000-4000-8000-000000000001', null, null, true, now()),
  ('c1000000-0000-4000-8000-000000000002', 'anon.upgraded@example.test', now(), false, now());

update public.settings set value = 'false' where key = 'launch.require_phone';
update public.settings set value = '10' where key = 'launch.spots_total';
update public.settings
set value = to_jsonb((now() + interval '30 days')::text)
where key = 'launch.ends_at';

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

select pg_temp.act_as('c1000000-0000-4000-8000-000000000001', true);
select is(private.is_anonymous(), true, 'a token with is_anonymous true is an anonymous visitor');

select pg_temp.act_as('c1000000-0000-4000-8000-000000000002', false);
select is(private.is_anonymous(), false, 'a token with is_anonymous false is an account');

select set_config('request.jwt.claims', json_build_object('sub', 'x', 'role', 'authenticated')::text, true);
select is(private.is_anonymous(), false, 'a token without the claim is an account');

set local role authenticated;
select pg_temp.act_as('c1000000-0000-4000-8000-000000000001', true);
select is((select public.claim_launch_spot()), 'email_unverified', 'an anonymous visitor takes no spot');

select pg_temp.act_as('c1000000-0000-4000-8000-000000000002', false);
select is((select public.claim_launch_spot()), 'granted', 'the same visitor with a confirmed email takes one');

reset role;

select * from finish();
rollback;
