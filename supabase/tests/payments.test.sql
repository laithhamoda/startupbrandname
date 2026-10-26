-- M7 step 1: billing products, checkout references, subscriptions, payments and provider events
-- (docs/M7-PLAN.md, D-309, D-086).
begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

insert into auth.users (id, email, created_at) values
  ('a7000000-0000-4000-8000-000000000001', 'm7-buyer@example.test', now()),
  ('b7000000-0000-4000-8000-000000000002', 'm7-stranger@example.test', now()),
  ('c7000000-0000-4000-8000-000000000003', 'm7-no-profile@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('a7000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('b7000000-0000-4000-8000-000000000002', 'DZ', 'ar', true);

insert into public.projects (id, user_id, title, country_code, currency) values
  ('a7100000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'paid', 'JO', 'JOD'),
  ('b7100000-0000-4000-8000-000000000002', 'b7000000-0000-4000-8000-000000000002', 'other', 'DZ', 'DZD');

insert into public.billing_products (provider, plan_id, provider_price_id, active) values
  ('paddle', 'monthly', 'pri_test_monthly', true),
  ('paddle', 'annual', 'pri_test_annual', true),
  ('paddle', 'alumni', 'pri_test_alumni', false);

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
-- Billing products
-- ---------------------------------------------------------------------------------------------

set local role anon;
select is(
  (select count(*)::int from public.billing_products),
  2,
  'a visitor reads the active prices only'
);
select throws_ok(
  $$insert into public.billing_products (provider, plan_id, provider_price_id) values ('paddle', 'weekly', 'pri_x')$$,
  '42501', null, 'a visitor cannot add a price'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- Starting a checkout
-- ---------------------------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('a7000000-0000-4000-8000-000000000001');

select throws_ok(
  $$select public.start_checkout('standard', null, false)$$,
  '22023', null, 'a checkout needs the 18+ confirmation'
);
select throws_ok(
  $$select public.start_checkout('standard', null, null)$$,
  '22023', null, 'a missing 18+ answer is not a confirmation'
);
select throws_ok(
  $$select public.start_checkout('course', null, true)$$,
  '22023', null, 'the course voucher cannot be bought'
);
select throws_ok(
  $$select public.start_checkout('free', null, true)$$,
  '22023', null, 'a plan without a price cannot be bought'
);
select throws_ok(
  $$select public.start_checkout('adventurer', 'b7100000-0000-4000-8000-000000000002', true)$$,
  '42501', null, 'a buyer cannot pay for another user''s project'
);
select lives_ok(
  $$select public.start_checkout('adventurer', 'a7100000-0000-4000-8000-000000000001', true)$$,
  'an adult buyer starts a checkout for their project'
);
select throws_ok(
  $$select * from public.checkout_refs$$,
  '42501', null, 'a user cannot read checkout references directly'
);

select pg_temp.act_as('c7000000-0000-4000-8000-000000000003');
select throws_ok(
  $$select public.start_checkout('standard', null, true)$$,
  '42501', null, 'an account that has not finished onboarding cannot buy'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.start_checkout('standard', null, true)$$,
  '42501', null, 'a visitor cannot start a checkout'
);
reset role;

select is(
  (select count(*)::int from public.checkout_refs
   where user_id = 'a7000000-0000-4000-8000-000000000001' and adult_confirmed_at is not null),
  1,
  'the checkout records when the buyer confirmed being 18 or older'
);

-- The daily limit: the buyer has one checkout today; a limit of 1 closes the door.
update public.settings set value = '1' where key = 'payments.checkouts_per_day';
set local role authenticated;
select pg_temp.act_as('a7000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select public.start_checkout('standard', null, true)$$,
  '54000', null, 'the daily checkout limit holds'
);
reset role;
update public.settings set value = '20' where key = 'payments.checkouts_per_day';

-- ---------------------------------------------------------------------------------------------
-- Applying provider events
-- ---------------------------------------------------------------------------------------------

create temporary table t_ref as
select ref from public.checkout_refs where user_id = 'a7000000-0000-4000-8000-000000000001';
grant select on t_ref to service_role, authenticated;

set local role authenticated;
select pg_temp.act_as('a7000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select public.apply_payment_event('paddle', 'evt_x', 'subscription.created', now(), '{"kind": "ignore"}')$$,
  '42501', null, 'a user cannot apply a provider event'
);
reset role;

set local role service_role;

select is(
  public.apply_payment_event(
    'paddle', 'evt_1', 'subscription.created', '2026-10-25 10:00+00',
    jsonb_build_object(
      'kind', 'subscription', 'provider_ref', 'sub_1', 'customer_id', 'ctm_1',
      'checkout_ref', (select ref from t_ref), 'plan_id', 'monthly', 'status', 'active',
      'starts_at', '2026-10-25 10:00+00', 'ends_at', null
    )
  ),
  'applied',
  'a new subscription is matched to the buyer by the checkout reference'
);
select is(
  public.apply_payment_event(
    'paddle', 'evt_1', 'subscription.created', '2026-10-25 10:00+00',
    jsonb_build_object(
      'kind', 'subscription', 'provider_ref', 'sub_1', 'checkout_ref', (select ref from t_ref),
      'plan_id', 'monthly', 'status', 'active', 'starts_at', '2026-10-25 10:00+00', 'ends_at', null
    )
  ),
  'duplicate',
  'the same event delivered twice is applied once'
);
select is(
  (select count(*)::int from public.subscriptions where provider_ref = 'sub_1'),
  1,
  'a replay creates no second subscription'
);

select is(
  public.apply_payment_event(
    'paddle', 'evt_2', 'transaction.completed', '2026-10-25 10:00:05+00',
    jsonb_build_object(
      'kind', 'payment', 'transaction_id', 'txn_1', 'provider_ref', 'sub_1',
      'checkout_ref', (select ref from t_ref), 'amount_minor', 1700, 'currency', 'USD'
    )
  ),
  'applied',
  'a completed transaction is recorded'
);
select is(
  (select subscription_id from public.payments where provider_transaction_id = 'txn_1'),
  (select id from public.subscriptions where provider_ref = 'sub_1'),
  'the payment is linked to the subscription it paid for'
);

-- A newer update, then an older one arriving late.
select is(
  public.apply_payment_event(
    'paddle', 'evt_4', 'subscription.canceled', '2026-10-26 09:00+00',
    jsonb_build_object(
      'kind', 'subscription', 'provider_ref', 'sub_1', 'plan_id', 'monthly', 'status', 'canceled',
      'starts_at', '2026-10-25 10:00+00', 'ends_at', '2026-11-25 10:00+00'
    )
  ),
  'applied',
  'a cancellation sets the end of the paid period'
);
select is(
  public.apply_payment_event(
    'paddle', 'evt_3', 'subscription.updated', '2026-10-25 12:00+00',
    jsonb_build_object(
      'kind', 'subscription', 'provider_ref', 'sub_1', 'plan_id', 'monthly', 'status', 'active',
      'starts_at', '2026-10-25 10:00+00', 'ends_at', null
    )
  ),
  'stale',
  'an older event arriving late is recorded as stale'
);
select is(
  (select status from public.subscriptions where provider_ref = 'sub_1'),
  'canceled',
  'the stale event did not undo the cancellation'
);

select is(
  public.apply_payment_event(
    'paddle', 'evt_5', 'subscription.created', now(),
    jsonb_build_object(
      'kind', 'subscription', 'provider_ref', 'sub_9', 'checkout_ref', gen_random_uuid(),
      'plan_id', 'monthly', 'status', 'active', 'starts_at', now(), 'ends_at', null
    )
  ),
  'unmatched',
  'an event for an unknown checkout is kept as unmatched and changes nothing'
);
select is(
  (select count(*)::int from public.subscriptions where provider_ref = 'sub_9'),
  0,
  'no subscription is created without an account'
);

select is(
  public.apply_payment_event('paddle', 'evt_6', 'customer.updated', now(), '{"kind": "ignore"}'),
  'ignored',
  'an event we do not keep is recorded as ignored'
);

select throws_ok(
  $$select public.apply_payment_event('paddle', 'evt_7', 'x', now(), '{"kind": "grant_everything"}')$$,
  '22023', null, 'an unknown change kind is refused'
);
select throws_ok(
  $$select public.apply_payment_event('paddle', 'evt_8', 'x', now(),
      '{"kind": "payment_status", "transaction_id": "txn_1", "status": "completed"}')$$,
  '22023', null, 'a payment status other than a refund or chargeback is refused'
);

-- A one-time purchase: the payment itself grants the period.
select is(
  public.apply_payment_event(
    'paddle', 'evt_10', 'transaction.completed', '2026-10-25 11:00+00',
    jsonb_build_object(
      'kind', 'payment', 'transaction_id', 'txn_annual', 'provider_ref', 'txn_annual',
      'checkout_ref', (select ref from t_ref), 'amount_minor', 15000, 'currency', 'USD',
      'grant', jsonb_build_object(
        'plan_id', 'annual', 'starts_at', '2026-10-25 11:00+00', 'ends_at', '2027-10-25 11:00+00'
      )
    )
  ),
  'applied',
  'a one-time purchase is recorded'
);
select is(
  (select plan_id || ' ' || status || ' ' || to_char(ends_at at time zone 'utc', 'YYYY-MM-DD')
   from public.subscriptions where provider_ref = 'txn_annual'),
  'annual active 2027-10-25',
  'a one-time purchase grants its period'
);
select is(
  (select project_id from public.subscriptions where provider_ref = 'txn_annual'),
  'a7100000-0000-4000-8000-000000000001'::uuid,
  'the access a project purchase gives is bound to that project'
);

-- A payment that arrives before its subscription is linked when the subscription arrives.
select is(
  public.apply_payment_event(
    'paddle', 'evt_11', 'transaction.completed', '2026-10-25 12:00+00',
    jsonb_build_object(
      'kind', 'payment', 'transaction_id', 'txn_early', 'provider_ref', 'sub_late',
      'checkout_ref', (select ref from t_ref), 'amount_minor', 1700, 'currency', 'USD'
    )
  ),
  'applied',
  'a payment before its subscription is recorded'
);
select is(
  public.apply_payment_event(
    'paddle', 'evt_12', 'subscription.created', '2026-10-25 12:00+00',
    jsonb_build_object(
      'kind', 'subscription', 'provider_ref', 'sub_late', 'checkout_ref', (select ref from t_ref),
      'plan_id', 'monthly', 'status', 'active', 'starts_at', '2026-10-25 12:00+00', 'ends_at', null
    )
  ),
  'applied',
  'the late subscription is created'
);
select is(
  (select subscription_id from public.payments where provider_transaction_id = 'txn_early'),
  (select id from public.subscriptions where provider_ref = 'sub_late'),
  'the early payment is linked to the late subscription'
);

-- A refund ends the access that payment bought.
select is(
  public.apply_payment_event(
    'paddle', 'evt_9', 'adjustment.updated', '2026-10-27 08:00+00',
    '{"kind": "payment_status", "transaction_id": "txn_1", "status": "refunded"}'
  ),
  'applied',
  'a full refund is applied'
);
select is(
  (select status from public.subscriptions where provider_ref = 'sub_1'),
  'ended',
  'a full refund ends the access it paid for'
);
select ok(
  (select ends_at <= now() from public.subscriptions where provider_ref = 'sub_1'),
  'the access ends no later than the refund'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- Reading and the other user
-- ---------------------------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('a7000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.subscriptions), 3, 'the buyer reads their subscriptions');
select is((select count(*)::int from public.payments), 3, 'the buyer reads their payments');
select throws_ok(
  $$update public.subscriptions set status = 'active', ends_at = null$$,
  '42501', null, 'the buyer cannot extend their own access'
);
select throws_ok(
  $$select * from public.payment_events$$,
  '42501', null, 'a user cannot read provider events'
);

select pg_temp.act_as('b7000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.subscriptions), 0, 'another user sees no subscription');
select is((select count(*)::int from public.payments), 0, 'another user sees no payment');
reset role;

-- Deleting the paid project deletes the access bought for it, and its payment.
delete from public.projects where id = 'a7100000-0000-4000-8000-000000000001';
select is(
  (select count(*)::int from public.subscriptions where provider_ref = 'txn_annual'),
  0,
  'deleting a project deletes the access bought for it'
);
select is(
  (select count(*)::int from public.payments where provider_transaction_id = 'txn_annual'),
  0,
  'and the payment that bought it'
);

select * from finish();

rollback;
