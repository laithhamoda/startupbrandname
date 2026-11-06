-- The limit on sign-in codes, code checks and spot claims (D-340).
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- Two codes per mailbox and three per network, so the test reaches both limits.
update public.settings set value = '2' where key = 'auth.limit.code_email';
update public.settings set value = '3' where key = 'auth.limit.code_ip';

-- Only the server's secret key may call it ----------------------------------------------------------

set local role anon;
select throws_ok(
  $$select public.check_auth_attempt('code', 'ip1', 'mail-a')$$, '42501', null,
  'a visitor cannot call the check'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select public.check_auth_attempt('code', 'ip1', 'mail-a')$$, '42501', null,
  'nor can a signed-in account'
);
reset role;

-- The limits --------------------------------------------------------------------------------------------

set local role service_role;
select is(public.check_auth_attempt('code', 'ip1', 'mail-a'), true, 'a first code request passes');
select is(public.check_auth_attempt('code', 'ip1', 'mail-a'), true, 'so does a second');
select is(
  public.check_auth_attempt('code', 'ip2', 'mail-a'), false,
  'a third for one mailbox is refused, from whatever network'
);
select is(
  public.check_auth_attempt('code', 'ip1', 'mail-b'), true,
  'another mailbox from the same network still passes, up to the network limit'
);
select is(
  public.check_auth_attempt('code', 'ip1', 'mail-c'), false,
  'a fourth request from that network is refused'
);
reset role;

select is(
  (select count(*)::int from private.auth_attempts), 3,
  'refused requests are not recorded'
);

select throws_ok(
  $$select public.check_auth_attempt('nope', 'ip', 'x')$$, '22023', null,
  'an unknown kind is an error'
);

select ok(
  exists (select 1 from cron.job where jobname = 'purge-auth-attempts'),
  'old attempts are purged by a job'
);

select * from finish();
rollback;
