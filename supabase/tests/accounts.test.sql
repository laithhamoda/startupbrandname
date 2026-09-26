-- Accounts (M2): onboarding, consent history, deletion and the purge of incomplete accounts.
begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

-- Test users. The email lives in auth.users only.
insert into auth.users (id, email, created_at) values
  ('a0000000-0000-4000-8000-000000000001', 'founder@example.test', now()),
  ('b0000000-0000-4000-8000-000000000002', 'other@example.test', now()),
  ('c0000000-0000-4000-8000-000000000003', 'incomplete@example.test', now()),
  ('d0000000-0000-4000-8000-000000000004', 'stale@example.test', now() - interval '25 hours'),
  ('e0000000-0000-4000-8000-000000000005', 'recent@example.test', now() - interval '23 hours'),
  ('f0000000-0000-4000-8000-000000000006', 'veteran@example.test', now() - interval '48 hours');

insert into public.profiles (user_id, country_code, locale, has_project)
values ('f0000000-0000-4000-8000-000000000006', 'JO', 'ar', true);

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
-- Nobody signed in
-- ---------------------------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select * from public.profiles$$,
  '42501',
  null,
  'anon cannot read profiles'
);

select throws_ok(
  $$select public.complete_onboarding('JO', 'ar', true, '2026-09-draft-1', false, '2026-09-draft-1')$$,
  '42501',
  null,
  'anon cannot complete onboarding'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- Onboarding (D-086: country, "do you have a project or an idea?", consents)
-- ---------------------------------------------------------------------------------------------

select pg_temp.act_as('b0000000-0000-4000-8000-000000000002');
set local role authenticated;

select is(
  public.complete_onboarding('DZ', 'en', false, '2026-09-draft-1', false, '2026-09-draft-1'),
  'completed',
  'someone without a project yet completes onboarding without cross-border consent'
);

select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');

select throws_ok(
  $$select public.complete_onboarding('JO', 'ar', null, '2026-09-draft-1', false, '2026-09-draft-1')$$,
  '22023',
  null,
  'a missing answer is an error'
);

select is(
  (select count(*)::int from public.profiles),
  0,
  'before onboarding a user sees no profile, not even other users'' profiles'
);

select is(
  public.complete_onboarding('JO', 'ar', true, '2026-09-draft-1', true, '2026-09-draft-1'),
  'completed',
  'someone with a project completes onboarding'
);

select results_eq(
  $$select country_code, locale, has_project from public.profiles$$,
  $$values ('JO'::text, 'ar'::text, true)$$,
  'the user sees exactly their own profile, with their answer'
);

select results_eq(
  $$select kind, action from public.consent_events order by id$$,
  $$values ('terms'::text, 'given'::text), ('crossborder'::text, 'given'::text)$$,
  'terms and cross-border consent are recorded'
);

select ok(public.has_crossborder_consent(), 'cross-border consent is on');

select is(
  public.complete_onboarding('JO', 'ar', false, '2026-09-draft-1', false, '2026-09-draft-1'),
  'already_complete',
  'completing twice changes nothing'
);

select is(
  (select count(*)::int from public.consent_events),
  2,
  'completing twice records no new consent'
);

-- ---------------------------------------------------------------------------------------------
-- What a user may change directly
-- ---------------------------------------------------------------------------------------------

select throws_ok(
  $$insert into public.profiles (user_id, country_code, has_project)
    values ('a0000000-0000-4000-8000-000000000001', 'JO', true)$$,
  '42501',
  null,
  'profiles cannot be inserted directly'
);

select throws_ok(
  $$update public.profiles set created_at = now()$$,
  '42501',
  null,
  'columns other than country and language cannot be edited directly'
);

select lives_ok(
  $$update public.profiles set country_code = 'EG', locale = 'en'$$,
  'the user can change their country and language'
);

select results_eq(
  $$select country_code, locale from public.profiles$$,
  $$values ('EG'::text, 'en'::text)$$,
  'the change is saved'
);

select is(
  (select count(*)::int from public.profiles where user_id = 'b0000000-0000-4000-8000-000000000002'),
  0,
  'another user''s profile stays invisible'
);

select throws_ok(
  $$insert into public.consent_events (user_id, kind, action, text_version, locale)
    values ('a0000000-0000-4000-8000-000000000001', 'crossborder', 'given', 'x', 'ar')$$,
  '42501',
  null,
  'consent history cannot be written directly'
);

-- ---------------------------------------------------------------------------------------------
-- Cross-border consent
-- ---------------------------------------------------------------------------------------------

select lives_ok(
  $$select public.set_crossborder_consent(false, '2026-09-draft-1')$$,
  'the user can withdraw cross-border consent'
);

select ok(not public.has_crossborder_consent(), 'cross-border consent is off');

select lives_ok(
  $$select public.set_crossborder_consent(false, '2026-09-draft-1')$$,
  'withdrawing again is accepted'
);

select is(
  (select count(*)::int from public.consent_events where kind = 'crossborder'),
  2,
  'withdrawing again records nothing new'
);

select pg_temp.act_as('c0000000-0000-4000-8000-000000000003');

select throws_ok(
  $$select public.set_crossborder_consent(true, '2026-09-draft-1')$$,
  '42501',
  null,
  'consent settings need a completed onboarding'
);

-- ---------------------------------------------------------------------------------------------
-- Self-service deletion
-- ---------------------------------------------------------------------------------------------

select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');

select lives_ok($$select public.delete_my_account()$$, 'a user can delete their account');

select throws_ok(
  $$select private.purge_incomplete_accounts()$$,
  '42501',
  null,
  'users cannot run the purge'
);

reset role;

select is(
  (select count(*)::int from auth.users where id = 'a0000000-0000-4000-8000-000000000001'),
  0,
  'the account is gone'
);

select is(
  (select count(*)::int from public.profiles where user_id = 'a0000000-0000-4000-8000-000000000001')
  + (select count(*)::int from public.consent_events where user_id = 'a0000000-0000-4000-8000-000000000001'),
  0,
  'its profile and consent history are gone with it'
);

-- ---------------------------------------------------------------------------------------------
-- Purge of incomplete accounts after 24 hours (D-065)
-- ---------------------------------------------------------------------------------------------

select is(
  private.purge_incomplete_accounts(),
  1,
  'the purge deletes one account'
);

select results_eq(
  $$select email::text from auth.users
    where id in (
      'c0000000-0000-4000-8000-000000000003',
      'd0000000-0000-4000-8000-000000000004',
      'e0000000-0000-4000-8000-000000000005',
      'f0000000-0000-4000-8000-000000000006'
    )
    order by email$$,
  $$values ('incomplete@example.test'::text), ('recent@example.test'::text), ('veteran@example.test'::text)$$,
  'it removes the incomplete account older than 24 hours and keeps the newer and completed ones'
);

select is(
  (select schedule from cron.job where jobname = 'purge-incomplete-accounts'),
  '17 * * * *',
  'the purge runs every hour'
);

select * from finish();

rollback;
