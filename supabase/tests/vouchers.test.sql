-- M7 step 6: VIVA vouchers (D-325): issuing, activation, the 5-attempt lock, and who can read what.
begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

insert into auth.users (id, email, created_at) values
  ('a8000000-0000-4000-8000-000000000001', 'v-trainee@example.test', now()),
  ('b8000000-0000-4000-8000-000000000002', 'v-other@example.test', now()),
  ('c8000000-0000-4000-8000-000000000003', 'v-no-profile@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('a8000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('b8000000-0000-4000-8000-000000000002', 'DZ', 'ar', true);

-- Issuing ---------------------------------------------------------------------------------------

create temp table issued as
  select i as code from public.issue_voucher_batch('course_12m', 5, null, 'pgTAP') as i;

select is((select count(*)::int from issued), 5, 'a batch of 5 returns 5 codes');
select is(
  (select count(*)::int from issued where code ~ '^VIVA[0-9A-F]{8}$'),
  5,
  'every code is VIVA and 8 uppercase hex characters'
);
select is(
  (select count(distinct code)::int from issued),
  5,
  'the codes differ'
);
select is(
  (select count(*)::int from public.vouchers v join public.voucher_batches b on b.id = v.batch_id
    where b.note = 'pgTAP' and v.expires_at > now() + interval '11 months 20 days'
      and v.expires_at <= now() + interval '12 months 1 day'),
  5,
  'a course code can be activated for 12 months from issue (D-060)'
);
select throws_ok(
  $$select public.issue_voucher_batch('nope', 1)$$, '22023', null, 'an unknown type is refused'
);
select throws_ok(
  $$select public.issue_voucher_batch('course_12m', 0)$$, '22023', null, 'an empty batch is refused'
);

-- Activation ------------------------------------------------------------------------------------

select is(
  public.activate_voucher(
    'a8000000-0000-4000-8000-000000000001', repeat('a', 64),
    (select lower(substr(code, 1, 4) || ' ' || substr(code, 5, 4) || '-' || substr(code, 9)) from issued order by code limit 1),
    true
  ),
  'activated',
  'input in small letters with a space and a dash activates'
);

select is(
  (select count(*)::int from public.subscriptions
    where user_id = 'a8000000-0000-4000-8000-000000000001' and source = 'voucher'
      and plan_id = 'course' and project_id is null and status = 'active'),
  1,
  'the activation wrote one account-wide course subscription'
);
select ok(
  (select ends_at > now() + interval '11 months 29 days' and ends_at <= now() + interval '12 months 1 day'
     from public.subscriptions where user_id = 'a8000000-0000-4000-8000-000000000001'),
  'the access lasts 12 months from activation'
);
select is(
  (select count(*)::int from public.vouchers
    where status = 'activated' and activated_by = 'a8000000-0000-4000-8000-000000000001'
      and adult_confirmed_at is not null and subscription_id is not null),
  1,
  'the voucher records who, when, the adult confirmation and the subscription'
);
select is(
  private.account_plan('a8000000-0000-4000-8000-000000000001'),
  'course',
  'the account now has the course plan'
);

select is(
  public.activate_voucher(
    'b8000000-0000-4000-8000-000000000002', repeat('b', 64),
    (select code from issued order by code limit 1), true
  ),
  'invalid',
  'a used code is invalid for anyone else'
);
select is(
  public.activate_voucher(
    'a8000000-0000-4000-8000-000000000001', repeat('a', 64),
    (select code from issued order by code offset 1 limit 1), true
  ),
  'in_use',
  'an account with the plan running keeps the second code'
);
select is(
  (select status from public.vouchers where code = (select code from issued order by code offset 1 limit 1)),
  'issued',
  'and the second code stays unused'
);

-- Refusals --------------------------------------------------------------------------------------

select throws_ok(
  $$select public.activate_voucher('b8000000-0000-4000-8000-000000000002', repeat('b', 64), 'VIVA00000000', false)$$,
  '22023', null, 'the adult confirmation is required'
);
select throws_ok(
  $$select public.activate_voucher('c8000000-0000-4000-8000-000000000003', repeat('c', 64), 'VIVA00000000', true)$$,
  '42501', null, 'an account without a profile is refused'
);

update public.vouchers set status = 'revoked'
  where code = (select code from issued order by code offset 2 limit 1);
select is(
  public.activate_voucher(
    'b8000000-0000-4000-8000-000000000002', repeat('b', 64),
    (select code from issued order by code offset 2 limit 1), true
  ),
  'invalid',
  'a revoked code is invalid'
);

update public.vouchers set expires_at = now() - interval '1 second', issued_at = now() - interval '2 seconds'
  where code = (select code from issued order by code offset 3 limit 1);
select is(
  public.activate_voucher(
    'b8000000-0000-4000-8000-000000000002', repeat('b', 64),
    (select code from issued order by code offset 3 limit 1), true
  ),
  'invalid',
  'an expired code is invalid'
);

-- The lock: 5 failures per account, then per network -------------------------------------------

select is(
  public.activate_voucher('b8000000-0000-4000-8000-000000000002', repeat('b', 64), 'not a code', true),
  'invalid', 'a malformed code is invalid'
);
select is(
  public.activate_voucher('b8000000-0000-4000-8000-000000000002', repeat('b', 64), 'VIVA00000000', true),
  'invalid', 'an unknown code is invalid (the fifth failure of this account)'
);
select is(
  public.activate_voucher(
    'b8000000-0000-4000-8000-000000000002', repeat('b', 64),
    (select code from issued order by code offset 4 limit 1), true
  ),
  'locked',
  'after 5 failures even a good code is locked'
);
select is(
  (select status from public.vouchers where code = (select code from issued order by code offset 4 limit 1)),
  'issued',
  'a locked attempt does not use the code'
);

-- Another account on the same network is locked too.
select is(
  public.activate_voucher(
    'a8000000-0000-4000-8000-000000000001', repeat('b', 64),
    (select code from issued order by code offset 4 limit 1), true
  ),
  'locked',
  'the lock also holds per network'
);

-- The lock ends after its window.
update public.voucher_attempts set at = now() - interval '16 minutes';
select is(
  public.activate_voucher(
    'b8000000-0000-4000-8000-000000000002', repeat('b', 64),
    (select code from issued order by code offset 4 limit 1), true
  ),
  'activated',
  'the lock ends after 15 minutes'
);

-- Who can read what -----------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'b8000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text,
  true
);
select throws_ok($$select * from public.vouchers$$, '42501', null, 'a signed-in user cannot read vouchers');
select throws_ok($$select * from public.voucher_attempts$$, '42501', null, 'nor the attempts');
select throws_ok(
  $$select public.activate_voucher('b8000000-0000-4000-8000-000000000002', repeat('b', 64), 'VIVA00000000', true)$$,
  '42501', null, 'nor call the activation themselves'
);
select throws_ok(
  $$select public.issue_voucher_batch('course_12m', 1)$$, '42501', null, 'nor issue codes'
);
select is(
  (select count(*)::int from public.subscriptions), 1, 'they read only their own subscription'
);

select * from finish();
rollback;
