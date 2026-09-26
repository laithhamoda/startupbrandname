-- M2 accounts (D-059, D-062, D-065).
--
-- A profile exists only once a person has declared both eligibility conditions (finished
-- secondary school, aged 18 or older), so "has a profile" means "onboarding complete".
-- Consent history is append-only. A refusal, a self-service deletion and the 24-hour purge of
-- incomplete accounts all delete the auth.users row; every row below cascades from it.
-- No name, photo, phone or date of birth is stored here. The email stays in auth.users only.

-- Scheduled jobs. Supabase installs pg_cron in pg_catalog; the jobs live in the cron schema.
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- ISO 3166-1 alpha-2, declared by the user (D-063). The app validates it against the list.
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  secondary_declared_at timestamptz not null,
  adult_declared_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per account that completed onboarding (both declarations made). Written by complete_onboarding().';

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
-- Declarations are written once by complete_onboarding(); users may change only these two.
grant update (country_code, locale) on table public.profiles to authenticated;

create policy "profiles: owner reads" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles: owner updates country and language" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Consent history
-- ---------------------------------------------------------------------------------------------

create table public.consent_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- terms: terms of use and privacy notice, accepted at signup.
  -- crossborder: optional consent to processing outside the user's country (D-062).
  kind text not null check (kind in ('terms', 'crossborder')),
  action text not null check (action in ('given', 'withdrawn')),
  text_version text not null check (text_version ~ '^[a-z0-9.-]{1,40}$'),
  locale text not null check (locale in ('ar', 'en')),
  created_at timestamptz not null default now(),
  -- Withdrawing the terms means closing the account: delete_my_account().
  constraint consent_events_terms_not_withdrawn check (kind <> 'terms' or action = 'given')
);

comment on table public.consent_events is
  'Append-only record of consents given and withdrawn, with the version of the text shown.';

create index consent_events_user_kind_idx
  on public.consent_events (user_id, kind, created_at desc, id desc);

alter table public.consent_events enable row level security;

revoke all on table public.consent_events from anon, authenticated;
grant select on table public.consent_events to authenticated;

create policy "consent_events: owner reads" on public.consent_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------
-- Functions called by the app (as the signed-in user)
-- ---------------------------------------------------------------------------------------------

-- Records both declarations and the consents in one step. Returns 'completed',
-- 'already_complete' or 'refused'. A "no" to either declaration deletes the account at once:
-- the platform is for adults who finished secondary school, and nothing is kept (D-059, D-065).
create function public.complete_onboarding(
  p_country_code text,
  p_locale text,
  p_secondary_completed boolean,
  p_adult boolean,
  p_terms_version text,
  p_crossborder_consent boolean,
  p_crossborder_version text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'complete_onboarding: not signed in' using errcode = '42501';
  end if;

  -- A missing answer is a bug in the caller, never a refusal.
  if p_secondary_completed is null or p_adult is null or p_crossborder_consent is null then
    raise exception 'complete_onboarding: every declaration needs an answer' using errcode = '22023';
  end if;

  if exists (select 1 from public.profiles where user_id = v_user) then
    return 'already_complete';
  end if;

  if not p_secondary_completed or not p_adult then
    delete from auth.users where id = v_user;
    return 'refused';
  end if;

  insert into public.profiles (user_id, country_code, locale, secondary_declared_at, adult_declared_at)
  values (v_user, p_country_code, p_locale, now(), now());

  insert into public.consent_events (user_id, kind, action, text_version, locale)
  values (v_user, 'terms', 'given', p_terms_version, p_locale);

  if p_crossborder_consent then
    insert into public.consent_events (user_id, kind, action, text_version, locale)
    values (v_user, 'crossborder', 'given', p_crossborder_version, p_locale);
  end if;

  return 'completed';
end;
$$;

-- Gives or withdraws the optional cross-border consent (D-062). Repeating the current state
-- records nothing.
create function public.set_crossborder_consent(p_given boolean, p_text_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_locale text;
  v_current boolean;
begin
  if v_user is null then
    raise exception 'set_crossborder_consent: not signed in' using errcode = '42501';
  end if;
  if p_given is null then
    raise exception 'set_crossborder_consent: an answer is required' using errcode = '22023';
  end if;

  select locale into v_locale from public.profiles where user_id = v_user;
  if v_locale is null then
    raise exception 'set_crossborder_consent: onboarding is not complete' using errcode = '42501';
  end if;

  select action = 'given' into v_current
  from public.consent_events
  where user_id = v_user and kind = 'crossborder'
  order by created_at desc, id desc
  limit 1;

  if coalesce(v_current, false) = p_given then
    return;
  end if;

  insert into public.consent_events (user_id, kind, action, text_version, locale)
  values (
    v_user,
    'crossborder',
    case when p_given then 'given' else 'withdrawn' end,
    p_text_version,
    v_locale
  );
end;
$$;

-- The current state of the signed-in user's cross-border consent (false until given).
create function public.has_crossborder_consent()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select action = 'given'
      from public.consent_events
      where user_id = (select auth.uid()) and kind = 'crossborder'
      order by created_at desc, id desc
      limit 1
    ),
    false
  );
$$;

-- Deletes the signed-in user's account and, through the foreign keys, all of its data.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'delete_my_account: not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.complete_onboarding(text, text, boolean, boolean, text, boolean, text)
  from public, anon;
revoke all on function public.set_crossborder_consent(boolean, text) from public, anon;
revoke all on function public.has_crossborder_consent() from public, anon;
revoke all on function public.delete_my_account() from public, anon;

grant execute on function public.complete_onboarding(text, text, boolean, boolean, text, boolean, text)
  to authenticated;
grant execute on function public.set_crossborder_consent(boolean, text) to authenticated;
grant execute on function public.has_crossborder_consent() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Purge of incomplete accounts (D-065)
-- ---------------------------------------------------------------------------------------------

-- Deletes accounts that never completed onboarding: a Google sign-in that stopped at the
-- declarations, or an email code that was requested and never used. Returns the number deleted.
-- Any future account type without a profile (for example admins in M7) must be excluded here.
create function private.purge_incomplete_accounts(p_older_than interval default interval '24 hours')
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from auth.users u
  where u.created_at < now() - p_older_than
    and not exists (select 1 from public.profiles p where p.user_id = u.id);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function private.purge_incomplete_accounts(interval) from public;

select cron.schedule(
  'purge-incomplete-accounts',
  '17 * * * *',
  $$select private.purge_incomplete_accounts()$$
);
