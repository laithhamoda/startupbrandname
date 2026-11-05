-- The free launch window (D-332, D-333): the spots, the phone check, the window and the admin tools.
begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

insert into auth.users (id, email, phone, phone_confirmed_at, email_confirmed_at, created_at) values
  ('a1000000-0000-4000-8000-000000000001', 'spots-one@example.test', '+962790000001', now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000002', 'spots-two@example.test', '+962790000002', now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000003', 'spots-three@example.test', '+962790000003', now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000004', 'spots-four@example.test', null, null, null, now()),
  ('a1000000-0000-4000-8000-000000000005', 'spots-five@example.test', '+962790000005', now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000006', 'spots-six@example.test', null, null, null, now()),
  ('a1000000-0000-4000-8000-000000000007', 'spots-seven@example.test', null, null, now(), now()),
  ('a1000000-0000-4000-8000-000000000009', 'spots-admin@example.test', null, null, null, now());

insert into public.admins (user_id) values ('a1000000-0000-4000-8000-000000000009');

-- Two spots, a month left: small enough to fill in the test.
update public.settings set value = '2' where key = 'launch.spots_total';
-- The phone path first; the email path is tested after it.
update public.settings set value = 'true' where key = 'launch.require_phone';
update public.settings
set value = to_jsonb((now() + interval '30 days')::text)
where key = 'launch.ends_at';

create function pg_temp.act_as(p_user uuid, p_aal text default 'aal1') returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
$$;

-- Visitors -----------------------------------------------------------------------------------------

set local role anon;
select is(
  (select spots_left from public.launch_window()), 2,
  'a visitor sees the spots left on the counter'
);
select ok((select open from public.launch_window()), 'and that the window is open');
select throws_ok(
  $$select public.claim_launch_spot()$$, '42501', null, 'a visitor cannot take a spot'
);
reset role;

-- Taking a spot ----------------------------------------------------------------------------------

set local role authenticated;

select pg_temp.act_as('a1000000-0000-4000-8000-000000000004');
select is(
  (select public.claim_launch_spot()), 'phone_unverified',
  'an account without a confirmed phone takes no spot'
);
select is((select public.my_launch_spot()), 'none', 'and holds nothing');

select pg_temp.act_as('a1000000-0000-4000-8000-000000000009', 'aal2');
select is((select public.claim_launch_spot()), 'admin', 'an admin takes no spot');

select pg_temp.act_as('a1000000-0000-4000-8000-000000000001');
select is((select public.claim_launch_spot()), 'granted', 'an account with a confirmed phone takes a spot');
select is((select public.claim_launch_spot()), 'already', 'and takes only one');
select is((select public.my_launch_spot()), 'active', 'it holds an active spot');
select is((select count(*)::int from public.launch_spots), 1, 'an account reads only its own spot');
select throws_ok(
  $$insert into public.launch_spots (user_id, phone_hash, source)
    values ('a1000000-0000-4000-8000-000000000003', repeat('a', 64), 'phone')$$,
  '42501', null, 'an account cannot write a spot itself'
);

reset role;

-- The first account changes its number; a second account verifies the number it left.
update auth.users set phone = '+962790000011' where id = 'a1000000-0000-4000-8000-000000000001';
update auth.users set phone = '+962790000001', phone_confirmed_at = now()
where id = 'a1000000-0000-4000-8000-000000000003';

select is(
  (select phone_hash from public.launch_spots where user_id = 'a1000000-0000-4000-8000-000000000001'),
  encode(sha256(convert_to('+962790000001', 'utf8')), 'hex'),
  'the number is kept as its sha256, not as digits'
);

set local role authenticated;

select pg_temp.act_as('a1000000-0000-4000-8000-000000000003');
select is(
  (select public.claim_launch_spot()), 'phone_used',
  'one phone number backs one spot, even after its first account changed number'
);

select pg_temp.act_as('a1000000-0000-4000-8000-000000000002');
select is((select public.claim_launch_spot()), 'granted', 'a second account takes the last spot');

select pg_temp.act_as('a1000000-0000-4000-8000-000000000005');
select is((select public.claim_launch_spot()), 'closed', 'no spot is left for the next account');

reset role;
set local role anon;
select is((select spots_left from public.launch_window()), 0, 'the counter reads zero');
select ok(not (select open from public.launch_window()), 'and the window is closed');
reset role;

-- The admin tools --------------------------------------------------------------------------------

set local role authenticated;

select pg_temp.act_as('a1000000-0000-4000-8000-000000000004', 'aal2');
select throws_ok(
  $$select public.admin_grant_launch_spot('spots-five@example.test')$$,
  '42501', null, 'someone who is not an admin cannot give a spot'
);

select pg_temp.act_as('a1000000-0000-4000-8000-000000000009', 'aal1');
select throws_ok(
  $$select public.admin_free_launch_spot('spots-two@example.test')$$,
  '42501', null, 'an admin at aal1 cannot take a spot back'
);

select pg_temp.act_as('a1000000-0000-4000-8000-000000000009', 'aal2');
select lives_ok(
  $$select public.admin_free_launch_spot('spots-two@example.test')$$,
  'an admin at aal2 takes a spot back'
);
select is(
  (select spots_left from public.launch_window()), 1, 'and the spot is free again'
);
select lives_ok(
  $$select public.admin_grant_launch_spot('spots-five@example.test')$$,
  'an admin gives a spot by hand'
);
select throws_ok(
  $$select public.admin_grant_launch_spot('spots-five@example.test')$$,
  '22023', null, 'but not twice'
);
select throws_ok(
  $$select public.admin_grant_launch_spot('nobody@example.test')$$,
  '22023', null, 'and not to an account that does not exist'
);
select throws_ok(
  $$select public.admin_free_launch_spot('spots-three@example.test')$$,
  '22023', null, 'and takes back only a spot that is held'
);

reset role;

select is(
  (select count(*)::int from public.audit_log
   where action in ('admin.grant_launch_spot', 'admin.free_launch_spot')),
  2, 'the two changes are in the audit log'
);
select is(
  (select source || ' ' || (phone_hash is null)::text from public.launch_spots
   where user_id = 'a1000000-0000-4000-8000-000000000005'),
  'admin true', 'a spot given by hand has no phone'
);

-- Without the phone step (D-334) -------------------------------------------------------------------

update public.settings set value = 'false' where key = 'launch.require_phone';
update public.settings set value = '5' where key = 'launch.spots_total';

set local role authenticated;

select pg_temp.act_as('a1000000-0000-4000-8000-000000000006');
select is(
  (select public.claim_launch_spot()), 'email_unverified',
  'with the phone step off, an account with no confirmed email takes no spot'
);

select pg_temp.act_as('a1000000-0000-4000-8000-000000000007');
select is(
  (select public.claim_launch_spot()), 'granted',
  'an account with a confirmed email takes a spot, with no phone'
);
select is((select public.claim_launch_spot()), 'already', 'and takes only one');
reset role;

select is(
  (select source || ' ' || (phone_hash is null)::text from public.launch_spots
   where user_id = 'a1000000-0000-4000-8000-000000000007'),
  'email true', 'such a spot records its source and holds no phone'
);

-- The end date -------------------------------------------------------------------------------------

update public.settings
set value = to_jsonb((now() - interval '1 day')::text)
where key = 'launch.ends_at';

set local role authenticated;
select pg_temp.act_as('a1000000-0000-4000-8000-000000000001');
select is((select public.my_launch_spot()), 'kept', 'after the end date a holder keeps the project');
select pg_temp.act_as('a1000000-0000-4000-8000-000000000003');
select is((select public.claim_launch_spot()), 'closed', 'and nobody new takes a spot');
reset role;

update public.settings
set value = to_jsonb((now() - interval '7 months')::text)
where key = 'launch.ends_at';

set local role authenticated;
select pg_temp.act_as('a1000000-0000-4000-8000-000000000001');
select is((select public.my_launch_spot()), 'none', 'six months after the end date nothing is kept');
reset role;

delete from public.settings where key = 'launch.ends_at';
select ok(
  (select ends_at is null and not open from public.launch_window()),
  'a missing end date closes the window'
);

-- Deleting an account ------------------------------------------------------------------------------

delete from auth.users where id = 'a1000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::int from public.launch_spots where user_id = 'a1000000-0000-4000-8000-000000000001'),
  0, 'deleting the account deletes its spot'
);

select * from finish();

rollback;
