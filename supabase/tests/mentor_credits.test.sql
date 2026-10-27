-- M7 step 6d: the mentor pack (D-322): checkout, credit, refund, reading.
begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email, created_at) values
  ('a7600000-0000-4000-8000-000000000001', 'm7-pack-buyer@example.test', now()),
  ('b7600000-0000-4000-8000-000000000002', 'm7-pack-stranger@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('a7600000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('b7600000-0000-4000-8000-000000000002', 'DZ', 'ar', true);

-- A free project: the pack is on sale for it too.
insert into public.projects (id, user_id, title, country_code, currency) values
  ('a7610000-0000-4000-8000-000000000001', 'a7600000-0000-4000-8000-000000000001', 'free', 'JO', 'JOD');

create function pg_temp.act_as(p_user uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
$$;

/** A completed payment of a mentor pack bought with checkout `p_ref`. */
create function pg_temp.pack_paid(p_event text, p_txn text, p_ref uuid) returns text
language sql
as $$
  select public.apply_payment_event(
    'paddle', p_event, 'transaction.completed', '2026-10-27 06:00+00',
    jsonb_build_object(
      'kind', 'payment', 'transaction_id', p_txn, 'provider_ref', p_txn,
      'checkout_ref', p_ref, 'amount_minor', 700, 'currency', 'USD',
      'credit', jsonb_build_object('messages', 10)
    )
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Checkout
-- ---------------------------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('a7600000-0000-4000-8000-000000000001');
select lives_ok(
  $$select public.start_checkout('mentor_pack', 'a7610000-0000-4000-8000-000000000001', true)$$,
  'a mentor pack is on sale for a free project'
);
select lives_ok(
  $$select public.start_checkout('mentor_pack', 'a7610000-0000-4000-8000-000000000001', true)$$,
  'and can be bought again'
);
select throws_ok(
  $$select public.start_checkout('mentor_pack', null, true)$$,
  '22023', null, 'a mentor pack is bought for a project'
);
select throws_ok(
  $$select public.start_checkout('mentor_pack', 'a7610000-0000-4000-8000-000000000001', false)$$,
  '22023', null, 'a mentor pack needs the 18+ confirmation'
);
reset role;

create temporary table t_refs as
select ref, row_number() over (order by created_at, ref) as n
from public.checkout_refs where user_id = 'a7600000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------------------------
-- Applying the payment
-- ---------------------------------------------------------------------------------------------

select is(
  pg_temp.pack_paid('evt_pack_1', 'txn_pack_1', (select ref from t_refs where n = 1)),
  'applied',
  'a mentor pack payment is applied'
);
select is(
  (select messages || ' ' || project_id::text || ' ' || (checkout_ref = (select ref from t_refs where n = 1))::text
   from public.mentor_credits where payment_id = (
     select id from public.payments where provider_transaction_id = 'txn_pack_1'
   )),
  '10 a7610000-0000-4000-8000-000000000001 true',
  'it credits 10 messages to the project the checkout named, with its reference'
);
select is(
  pg_temp.pack_paid('evt_pack_1', 'txn_pack_1', (select ref from t_refs where n = 1)),
  'duplicate',
  'a replayed event is not applied twice'
);
select is(
  (select count(*)::int from public.mentor_credits),
  1,
  'so it credits the messages once'
);
select is(
  (select count(*)::int from public.subscriptions where user_id = 'a7600000-0000-4000-8000-000000000001'),
  0,
  'a mentor pack gives no package'
);
select is(
  pg_temp.pack_paid('evt_pack_x', 'txn_pack_x', 'f0000000-0000-4000-8000-00000000000f'),
  'unmatched',
  'a payment for an unknown checkout is not applied'
);

-- A second pack, partly refunded: it still counts.
do $$ begin perform pg_temp.pack_paid('evt_pack_2', 'txn_pack_2', (select ref from t_refs where n = 2)); end $$;
do $$ begin perform public.apply_payment_event(
  'paddle', 'evt_pack_2r', 'adjustment.updated', '2026-10-27 07:00+00',
  '{"kind": "payment_status", "transaction_id": "txn_pack_2", "status": "partially_refunded"}'
); end $$;
-- The first pack, fully refunded: it no longer counts.
select is(
  public.apply_payment_event(
    'paddle', 'evt_pack_1r', 'adjustment.updated', '2026-10-27 07:00+00',
    '{"kind": "payment_status", "transaction_id": "txn_pack_1", "status": "refunded"}'
  ),
  'applied',
  'a full refund of a pack is applied'
);
select is(
  (select string_agg((c.revoked_at is not null)::text, ' ' order by p.provider_transaction_id)
   from public.mentor_credits c join public.payments p on p.id = c.payment_id),
  'true false',
  'a full refund revokes the credit, a partial refund does not'
);

-- ---------------------------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('a7600000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.mentor_credits), 2, 'the buyer reads their credits');
select throws_ok(
  $$insert into public.mentor_credits (user_id, project_id, messages, source)
    values ('a7600000-0000-4000-8000-000000000001', 'a7610000-0000-4000-8000-000000000001', 1000, 'admin')$$,
  '42501', null, 'the buyer cannot add credits'
);
select pg_temp.act_as('b7600000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.mentor_credits), 0, 'another user sees no credit');
reset role;

-- Deleting the project deletes its credits.
delete from public.projects where id = 'a7610000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.mentor_credits), 0, 'deleting a project deletes its credits');

select * from finish();

rollback;
