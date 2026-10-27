-- M7 step 8, part 1: admins, the aal2 rule and the append-only audit log (D-327).
begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, email, created_at) values
  ('ad000000-0000-4000-8000-000000000001', 'adm-admin@example.test', now()),
  ('ad000000-0000-4000-8000-000000000002', 'adm-user@example.test', now());

insert into public.admins (user_id) values ('ad000000-0000-4000-8000-000000000001');

create function pg_temp.act_as(p_user uuid, p_aal text) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
$$;

-- Status ----------------------------------------------------------------------------------------

set local role authenticated;

select pg_temp.act_as('ad000000-0000-4000-8000-000000000002', 'aal2');
select is(public.admin_status(), 'none', 'someone who is not an admin is none, even at aal2');

select pg_temp.act_as('ad000000-0000-4000-8000-000000000001', 'aal1');
select is(public.admin_status(), 'needs_mfa', 'an admin at aal1 needs the second step');

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'ad000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
select is(public.admin_status(), 'needs_mfa', 'a token without aal counts as aal1');

select pg_temp.act_as('ad000000-0000-4000-8000-000000000001', 'aal2');
select is(public.admin_status(), 'admin', 'an admin at aal2 is admin');

-- Entering --------------------------------------------------------------------------------------

select pg_temp.act_as('ad000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$select public.admin_enter()$$, '42501', null, 'a non-admin cannot enter');

select pg_temp.act_as('ad000000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$select public.admin_enter()$$, '42501', null, 'an admin at aal1 cannot enter');

select pg_temp.act_as('ad000000-0000-4000-8000-000000000001', 'aal2');
select lives_ok($$select public.admin_enter()$$, 'an admin at aal2 enters');

reset role;
select is(
  (select count(*)::int from public.audit_log
    where action = 'admin.enter' and actor = 'ad000000-0000-4000-8000-000000000001'),
  1, 'and the entry is in the audit log under their account'
);
select is(
  (select count(*)::int from public.audit_log), 1, 'the refused entries wrote nothing'
);

-- The log cannot be changed -----------------------------------------------------------------------

select throws_ok(
  $$update public.audit_log set action = 'admin.nothing'$$, '42501', null, 'a row cannot be updated'
);
select throws_ok($$delete from public.audit_log$$, '42501', null, 'a row cannot be deleted');
select throws_ok($$truncate public.audit_log$$, '42501', null, 'the log cannot be emptied');
select throws_ok(
  $$insert into public.audit_log (action) values ('Bad Action')$$,
  '23514', null, 'an action name has a fixed shape'
);
select throws_ok(
  $$insert into public.audit_log (action, detail) values ('admin.x', '[]')$$,
  '23514', null, 'the detail is an object'
);

-- Who can read what -------------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('ad000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$select * from public.admins$$, '42501', null, 'even an admin cannot read the admin list');
select throws_ok($$select * from public.audit_log$$, '42501', null, 'nor the log (the admin tools read it through functions)');
select throws_ok(
  $$insert into public.admins (user_id) values ('ad000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'nor add an admin'
);
select throws_ok(
  $$select private.write_audit('admin.sneak')$$, '42501', null, 'private functions are out of reach'
);

set local role anon;
select throws_ok($$select public.admin_status()$$, '42501', null, 'a visitor cannot ask the status');
select throws_ok($$select public.admin_enter()$$, '42501', null, 'nor enter');

reset role;
select is(
  (select count(*)::int from public.audit_log), 1, 'no attempt left a row'
);

-- Deleting the admin's account keeps the row and clears only who did it.
select lives_ok(
  $$delete from auth.users where id = 'ad000000-0000-4000-8000-000000000001'$$,
  'the account of an admin with a row in the log can be deleted'
);
select is(
  (select count(*)::int from public.audit_log where action = 'admin.enter' and actor is null),
  1, 'and the row stays, with no actor'
);
select throws_ok(
  $$update public.audit_log set actor = 'ad000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'the actor cannot be set again'
);

select * from finish();
rollback;
