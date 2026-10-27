-- M7 step 7: affiliates and commissions (D-326): the commission is written on activation only,
-- once per code, voided when the activation is undone, and read only by its affiliate.
begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

insert into auth.users (id, email, created_at) values
  ('a9000000-0000-4000-8000-000000000001', 'aff-owner@example.test', now()),
  ('b9000000-0000-4000-8000-000000000001', 'aff-t1@example.test', now()),
  ('b9000000-0000-4000-8000-000000000002', 'aff-t2@example.test', now()),
  ('b9000000-0000-4000-8000-000000000003', 'aff-t3@example.test', now()),
  ('b9000000-0000-4000-8000-000000000004', 'aff-t4@example.test', now()),
  ('b9000000-0000-4000-8000-000000000005', 'aff-t5@example.test', now()),
  ('c9000000-0000-4000-8000-000000000001', 'aff-outsider@example.test', now());

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('b9000000-0000-4000-8000-000000000001', 'JO', 'ar', true),
  ('b9000000-0000-4000-8000-000000000002', 'JO', 'ar', true),
  ('b9000000-0000-4000-8000-000000000003', 'DZ', 'ar', true),
  ('b9000000-0000-4000-8000-000000000004', 'DZ', 'ar', true),
  ('b9000000-0000-4000-8000-000000000005', 'JO', 'ar', true);

-- The affiliate -----------------------------------------------------------------------------------

create temp table aff as
  select public.create_affiliate('Viva Rise', 250, 'a9000000-0000-4000-8000-000000000001') as id;

select isnt((select id from aff), null, 'create_affiliate returns the new affiliate');
select throws_ok(
  $$insert into public.affiliates (name, commission_rule)
    values ('x', '{"kind":"percent","amount_usd_cents":5}')$$,
  '23514', null, 'a rule of another kind is refused'
);
select throws_ok(
  $$insert into public.affiliates (name, commission_rule)
    values ('x', '{"kind":"fixed_per_activation","amount_usd_cents":5,"extra":1}')$$,
  '23514', null, 'a rule with an extra key is refused'
);
select throws_ok(
  $$select public.create_affiliate('free', 0)$$, '23514', null, 'a zero commission is refused'
);

-- Issuing records nothing; activating does ---------------------------------------------------------

create temp table c1 as
  select i as code from public.issue_voucher_batch('course_12m', 1, (select id from aff), 'aff-1') as i;

select is(
  (select count(*)::int from public.commissions), 0, 'issuing a code records no commission'
);

select is(
  public.activate_voucher('b9000000-0000-4000-8000-000000000001', repeat('1', 64), (select code from c1), true),
  'activated', 'a trainee activates an affiliate code'
);
select is(
  (select count(*)::int from public.commissions c
    where c.voucher_code = (select code from c1) and c.amount_usd_cents = 250
      and c.status = 'due' and c.affiliate_id = (select id from aff)),
  1, 'the activation recorded one due commission of the affiliate''s amount'
);
select throws_ok(
  $$insert into public.commissions (affiliate_id, voucher_code, amount_usd_cents, activated_at)
    select (select id from aff), code, 250, now() from c1$$,
  '23505', null, 'a code can never have a second commission'
);

create temp table c0 as
  select i as code from public.issue_voucher_batch('course_12m', 1, null, 'no-affiliate') as i;
select is(
  public.activate_voucher('b9000000-0000-4000-8000-000000000002', repeat('2', 64), (select code from c0), true),
  'activated', 'a code without an affiliate activates'
);
select is(
  (select count(*)::int from public.commissions), 1, 'and records no commission'
);

-- An inactive affiliate earns nothing.
update public.affiliates set active = false;
create temp table c2 as
  select i as code from public.issue_voucher_batch('course_12m', 3, (select id from aff), 'aff-2') as i;
select is(
  public.activate_voucher('b9000000-0000-4000-8000-000000000003', repeat('3', 64),
    (select code from c2 order by code limit 1), true),
  'activated', 'a code of an inactive affiliate activates'
);
select is(
  (select count(*)::int from public.commissions), 1, 'and records no commission'
);
update public.affiliates set active = true;

-- Undoing an activation ---------------------------------------------------------------------------

update public.vouchers set status = 'revoked' where code = (select code from c1);
select is(
  (select count(*)::int from public.commissions
    where voucher_code = (select code from c1) and status = 'void' and voided_at is not null),
  1, 'revoking an activated code voids its due commission'
);

select public.activate_voucher('b9000000-0000-4000-8000-000000000004', repeat('4', 64),
  (select code from c2 order by code offset 1 limit 1), true);
update public.commissions set status = 'paid', paid_at = now()
  where voucher_code = (select code from c2 order by code offset 1 limit 1);
update public.vouchers set status = 'revoked' where code = (select code from c2 order by code offset 1 limit 1);
select is(
  (select status from public.commissions
    where voucher_code = (select code from c2 order by code offset 1 limit 1)),
  'paid', 'a commission already paid stays paid'
);

select public.activate_voucher('b9000000-0000-4000-8000-000000000005', repeat('5', 64),
  (select code from c2 order by code offset 2 limit 1), true);
delete from auth.users where id = 'b9000000-0000-4000-8000-000000000005';
select is(
  (select status from public.commissions
    where voucher_code = (select code from c2 order by code offset 2 limit 1)),
  'void', 'deleting the account voids the commission still due'
);

-- Who can read what -------------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a9000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
select is((select count(*)::int from public.affiliates), 1, 'the affiliate reads their own row');
select is((select count(*)::int from public.commissions), 3, 'and their own commissions');
select throws_ok($$select * from public.vouchers$$, '42501', null, 'but not the vouchers table');
select throws_ok(
  $$insert into public.commissions (affiliate_id, voucher_code, amount_usd_cents, activated_at)
    values (gen_random_uuid(), 'VIVA00000000', 1, now())$$,
  '42501', null, 'and cannot write a commission'
);
select throws_ok(
  $$select public.create_affiliate('self', 1000)$$, '42501', null, 'nor create an affiliate'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c9000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
select is(
  (select count(*)::int from public.affiliates) + (select count(*)::int from public.commissions),
  0, 'anyone else reads no affiliate and no commission'
);

select * from finish();
rollback;
