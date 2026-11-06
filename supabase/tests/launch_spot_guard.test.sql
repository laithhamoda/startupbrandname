-- Launch spots, abuse guard (D-338): one mailbox, one spot; no spot for a throwaway domain.
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email, email_confirmed_at, created_at) values
  ('b1000000-0000-4000-8000-000000000001', 'Guard.One@gmail.com', now(), now()),
  ('b1000000-0000-4000-8000-000000000002', 'guardone+promo@gmail.com', now(), now()),
  ('b1000000-0000-4000-8000-000000000003', 'g.u.a.r.d.one@googlemail.com', now(), now()),
  ('b1000000-0000-4000-8000-000000000004', 'someone@mailinator.com', now(), now()),
  ('b1000000-0000-4000-8000-000000000005', 'other.person@example.test', now(), now()),
  ('b1000000-0000-4000-8000-000000000006', 'other.person+two@example.test', now(), now());

update public.settings set value = 'false' where key = 'launch.require_phone';
update public.settings set value = '10' where key = 'launch.spots_total';
update public.settings
set value = to_jsonb((now() + interval '30 days')::text)
where key = 'launch.ends_at';

create function pg_temp.act_as(p_user uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'aal', 'aal1')::text,
    true
  );
$$;

-- The canonical mailbox ------------------------------------------------------------------------------

select is(
  private.canonical_email('Guard.One+promo@Gmail.com'), 'guardone@gmail.com',
  'Gmail: case, dots and +tag are ignored'
);
select is(
  private.canonical_email('g.u.a.r.d.one@googlemail.com'), 'guardone@gmail.com',
  'googlemail.com is gmail.com'
);
select is(
  private.canonical_email('Sam+x@Example.test'), 'sam@example.test',
  'another domain: case and +tag are ignored'
);
select is(
  private.canonical_email('a.b@example.test'), 'a.b@example.test',
  'another domain: dots are kept'
);
select is(private.canonical_email('nonsense'), 'nonsense', 'an unreadable address comes back as it was');
select is(private.canonical_email('+x@example.test'), '+x@example.test', 'an empty local part is left alone');

-- Throwaway domains ------------------------------------------------------------------------------------

select ok(private.email_blocked('someone@mailinator.com'), 'a known throwaway domain is blocked');
select ok(not private.email_blocked('other@example.test'), 'an ordinary domain is not');

set local role authenticated;
select throws_ok(
  $$select * from public.blocked_email_domains$$, '42501', null,
  'a signed-in account cannot read the blocked domains'
);

-- Taking a spot ----------------------------------------------------------------------------------------

select pg_temp.act_as('b1000000-0000-4000-8000-000000000001');
select is((select public.claim_launch_spot()), 'granted', 'the first address of a mailbox takes a spot');
select is((select public.claim_launch_spot()), 'already', 'and only one');

select pg_temp.act_as('b1000000-0000-4000-8000-000000000002');
select is((select public.claim_launch_spot()), 'email_used', 'a +tag address of the same mailbox takes none');

select pg_temp.act_as('b1000000-0000-4000-8000-000000000003');
select is(
  (select public.claim_launch_spot()), 'email_used', 'nor does the googlemail.com form with dots'
);

select pg_temp.act_as('b1000000-0000-4000-8000-000000000004');
select is((select public.claim_launch_spot()), 'email_blocked', 'a throwaway domain takes none');

select pg_temp.act_as('b1000000-0000-4000-8000-000000000005');
select is((select public.claim_launch_spot()), 'granted', 'a different mailbox takes a spot');

select pg_temp.act_as('b1000000-0000-4000-8000-000000000006');
select is((select public.claim_launch_spot()), 'email_used', 'a +tag of that one takes none');

reset role;

select is(
  (select email_canonical from public.launch_spots
   where user_id = 'b1000000-0000-4000-8000-000000000001'),
  'guardone@gmail.com', 'the spot records the canonical mailbox'
);

select * from finish();
rollback;
