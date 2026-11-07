-- The limit on first visits without signup (D-350): per network, one hour.
begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

update public.settings set value = '2' where key = 'auth.limit.start_ip';

set local role service_role;
select is(public.check_auth_attempt('start', 'ip1', 'a'), true, 'a first start passes');
select is(public.check_auth_attempt('start', 'ip1', 'b'), true, 'so does a second, from the same network');
select is(public.check_auth_attempt('start', 'ip1', 'c'), false, 'a third from that network is refused');
select is(public.check_auth_attempt('start', 'ip2', 'd'), true, 'another network is not affected');
reset role;

select * from finish();
rollback;
