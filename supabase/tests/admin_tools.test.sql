-- M7 step 8, part 2: the admin tools (D-328): the aal2 wall, what each tool does, and its audit row.
begin;

create extension if not exists pgtap with schema extensions;

select plan(40);

insert into auth.users (id, email, created_at) values
  ('ae000000-0000-4000-8000-000000000001', 'tools-admin@example.test', now()),
  ('ae000000-0000-4000-8000-000000000002', 'tools-user@example.test', now()),
  ('ae000000-0000-4000-8000-000000000003', 'tools-nobody@example.test', now());

insert into public.admins (user_id) values ('ae000000-0000-4000-8000-000000000001');

insert into public.profiles (user_id, country_code, locale, has_project) values
  ('ae000000-0000-4000-8000-000000000002', 'JO', 'ar', true);

insert into public.projects (id, user_id, title, country_code, currency) values
  ('ae100000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000002', 'tools', 'JO', 'JOD');

-- A paid subscription and its payment, as the webhook would have written them.
insert into public.subscriptions (id, user_id, plan_id, project_id, source, status, starts_at, ends_at, provider_ref) values
  ('ae200000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000002', 'strategist',
   'ae100000-0000-4000-8000-000000000001', 'paddle', 'active', now(), now() + interval '365 days', 'txn_pgtap');
insert into public.payments (user_id, subscription_id, provider, provider_transaction_id, provider_ref, amount_minor, currency, status, occurred_at) values
  ('ae000000-0000-4000-8000-000000000002', 'ae200000-0000-4000-8000-000000000001', 'paddle',
   'txn_pgtap', 'txn_pgtap', 2000, 'USD', 'completed', now());

create function pg_temp.act_as(p_user uuid, p_aal text) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
$$;

-- The wall --------------------------------------------------------------------------------------

set local role authenticated;

select pg_temp.act_as('ae000000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($$select * from public.admin_affiliates()$$, '42501', null, 'someone who is not an admin is refused');

select pg_temp.act_as('ae000000-0000-4000-8000-000000000001', 'aal1');
select throws_ok(
  $$select * from public.admin_issue_batch('course_12m', 1)$$, '42501', null, 'an admin at aal1 is refused'
);

-- Vouchers and affiliates -------------------------------------------------------------------------

select pg_temp.act_as('ae000000-0000-4000-8000-000000000001', 'aal2');

select is((select count(*)::int from public.admin_voucher_types()), 1, 'the voucher types are listed');
select is(
  (select count(*)::int from public.admin_issue_batch('course_12m', 2, null, 'tools')),
  2, 'a batch of 2 returns 2 codes'
);
select throws_ok(
  $$select * from public.admin_issue_batch('nope', 1)$$, '22023', null, 'an unknown type is refused'
);

select set_config('t.aff', public.admin_create_affiliate('Partner', 300)::text, true);
select ok(current_setting('t.aff') ~ '^[0-9a-f-]{36}$', 'an affiliate is created');
select throws_ok(
  $$select public.admin_create_affiliate('Free', 0)$$, '23514', null, 'a zero commission is refused'
);
select is(
  (select count(*)::int from public.admin_issue_batch('course_12m', 1, current_setting('t.aff')::uuid, 'aff')),
  1, 'a batch for the affiliate'
);

reset role;
select is(
  public.activate_voucher(
    'ae000000-0000-4000-8000-000000000002', repeat('9', 64),
    (select v.code from public.vouchers v join public.voucher_batches b on b.id = v.batch_id
      where b.affiliate_id = current_setting('t.aff')::uuid limit 1),
    true
  ),
  'activated', 'a trainee activates the affiliate''s code'
);

set local role authenticated;
select pg_temp.act_as('ae000000-0000-4000-8000-000000000001', 'aal2');

select is(
  (select due_usd_cents from public.admin_affiliates() where id = current_setting('t.aff')::uuid),
  300::bigint, 'the affiliate list shows the commission due'
);
select is(
  (select activated from public.admin_affiliates() where id = current_setting('t.aff')::uuid),
  1::bigint, 'and the code activated'
);
select is(public.admin_pay_commissions(current_setting('t.aff')::uuid), 1, 'one commission is marked paid');
select is(
  (select paid_usd_cents from public.admin_affiliates() where id = current_setting('t.aff')::uuid),
  300::bigint, 'it moves from due to paid'
);
select is(
  public.admin_pay_commissions(current_setting('t.aff')::uuid), 0, 'paying again marks nothing'
);

-- Subscriptions and payments ----------------------------------------------------------------------

select throws_ok(
  $$select public.admin_grant_subscription('tools-user@example.test', 'gold', 30)$$,
  '22023', null, 'an unknown plan is refused'
);
select throws_ok(
  $$select public.admin_grant_subscription('tools-user@example.test', 'course', 0)$$,
  '22023', null, 'zero days are refused'
);
select throws_ok(
  $$select public.admin_grant_subscription('tools-user@example.test', 'strategist', 30)$$,
  '22023', null, 'a package needs a project'
);
select throws_ok(
  $$select public.admin_grant_subscription('tools-user@example.test', 'course', 30, 'ae100000-0000-4000-8000-000000000001')$$,
  '22023', null, 'the course plan takes no project'
);
select throws_ok(
  $$select public.admin_grant_subscription('nobody@example.test', 'strategist', 30, 'ae100000-0000-4000-8000-000000000001')$$,
  '22023', null, 'an unknown account is refused'
);
select throws_ok(
  $$select public.admin_grant_subscription('tools-admin@example.test', 'strategist', 30, 'ae100000-0000-4000-8000-000000000001')$$,
  '22023', null, 'a project of another account is refused'
);

select set_config(
  't.sub', public.admin_grant_subscription('TOOLS-user@example.test', 'course', 30)::text, true
);
select ok(current_setting('t.sub') ~ '^[0-9a-f-]{36}$', 'an account is given the course plan by hand');
select ok(
  public.admin_grant_subscription('tools-user@example.test', 'commander', 365, 'ae100000-0000-4000-8000-000000000001') is not null,
  'and a package for its project'
);

select is(
  (select count(*)::int from public.admin_subscriptions()
    where email = 'tools-user@example.test' and source = 'admin'),
  2, 'the list shows the two grants with the email'
);
select is(
  (select count(*)::int from public.admin_subscriptions() where source in ('paddle', 'voucher')),
  2, 'and the paid one and the voucher one'
);
select is(
  (select amount_minor from public.admin_payments() where email = 'tools-user@example.test'),
  2000::bigint, 'the payments list shows the payment'
);

select lives_ok(
  format('select public.admin_end_subscription(%L)', current_setting('t.sub')), 'a grant by hand ends'
);
select throws_ok(
  $$select public.admin_end_subscription('ae200000-0000-4000-8000-000000000001')$$,
  '22023', null, 'a paid subscription does not: that is a refund in Paddle'
);
select throws_ok(
  $$select public.admin_end_subscription('ae200000-0000-4000-8000-0000000000ff')$$,
  '22023', null, 'an unknown subscription is refused'
);

-- Nobody else ------------------------------------------------------------------------------------

select pg_temp.act_as('ae000000-0000-4000-8000-000000000003', 'aal2');
select throws_ok(
  $$select public.admin_pay_commissions(gen_random_uuid())$$, '42501', null, 'a non-admin cannot pay commissions'
);
select throws_ok(
  $$select public.admin_grant_subscription('tools-user@example.test', 'course', 30)$$,
  '42501', null, 'nor grant access'
);
select throws_ok($$select * from public.admin_subscriptions()$$, '42501', null, 'nor read subscriptions');
select throws_ok($$select * from public.admin_payments()$$, '42501', null, 'nor payments');

set local role anon;
select throws_ok($$select * from public.admin_affiliates()$$, '42501', null, 'a visitor cannot call a tool');

-- The audit log ----------------------------------------------------------------------------------

reset role;
select is(
  (select count(*)::int from public.audit_log where action = 'admin.issue_batch'),
  2, 'both batches are in the log'
);
select is(
  (select count(*)::int from public.audit_log where detail::text ~ 'VIVA'),
  0, 'and no code is'
);
select is(
  (select (detail ->> 'count')::int from public.audit_log where action = 'admin.issue_batch' order by id limit 1),
  2, 'a batch row keeps the count'
);
select is(
  (select count(*)::int from public.audit_log where action in ('admin.view_subscriptions', 'admin.view_payments')),
  3, 'reading the lists with emails is logged, each time'
);
select is(
  (select count(*)::int from public.audit_log where action in
    ('admin.create_affiliate', 'admin.pay_commissions', 'admin.grant_subscription', 'admin.end_subscription')),
  6, 'every change is logged (an affiliate, two payments, two grants, one end)'
);
select is(
  (select status from public.subscriptions where id = current_setting('t.sub')::uuid),
  'ended', 'the ended grant is ended'
);
select is(
  (select count(*)::int from public.audit_log where actor = 'ae000000-0000-4000-8000-000000000001'),
  (select count(*)::int from public.audit_log), 'every row names the admin'
);

select * from finish();
rollback;
