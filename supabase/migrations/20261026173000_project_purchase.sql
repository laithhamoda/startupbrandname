-- M7 step 6b: one purchase covers one project (D-320).
--
-- create_project(): an account keeps at most entitlement.free.projects (1) projects without a
-- running package of their own; a project with one does not count, so an account may hold any
-- number of paid projects. A running package that covers the account with an "unlimited" limit
-- (the course voucher) lifts the rule. Running means as the app reads it (lib/payments/plan-of.ts).
-- start_checkout(): a package is always bought for a project of the buyer.
--
-- Expand only: both functions keep their signatures; only their bodies change.

create or replace function public.create_project(
  p_title text,
  p_country_code text,
  p_currency text,
  p_mode text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_setting jsonb;
  v_limit integer;
  v_unpaid integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'create_project: not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where user_id = v_user) then
    raise exception 'create_project: onboarding is not complete' using errcode = '42501';
  end if;

  -- One creation at a time per account, so two quick clicks cannot pass the limit together.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select value into v_setting
  from public.settings
  where key = 'entitlement.' || private.account_plan(v_user) || '.projects';

  -- "unlimited" lifts the rule; otherwise only projects without a package of their own count.
  if v_setting is distinct from '"unlimited"'::jsonb then
    select value into v_setting from public.settings where key = 'entitlement.free.projects';
    v_limit := case when jsonb_typeof(v_setting) = 'number' then (v_setting #>> '{}')::integer end;
    select count(*)::integer into v_unpaid
    from public.projects p
    where p.user_id = v_user
      and not exists (
        select 1 from public.subscriptions s
        where s.project_id = p.id
          and s.status <> 'ended'
          and s.starts_at <= now()
          and case when s.ends_at is null then s.status <> 'canceled' else s.ends_at > now() end
      );
    -- A missing or unreadable limit closes the door.
    if v_unpaid >= coalesce(v_limit, 0) then
      raise exception 'create_project: project limit reached' using errcode = 'SB001';
    end if;
  end if;

  insert into public.projects (user_id, title, country_code, currency, mode)
  values (v_user, btrim(p_title), p_country_code, p_currency, coalesce(p_mode, 'quick'))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.start_checkout(
  p_plan_id text,
  p_project_id uuid,
  p_adult_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_today integer;
  v_ref uuid;
begin
  if v_user is null then
    raise exception 'start_checkout: not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where user_id = v_user) then
    raise exception 'start_checkout: onboarding is not complete' using errcode = '42501';
  end if;
  if p_adult_confirmed is distinct from true then
    raise exception 'start_checkout: the buyer must confirm being 18 or older' using errcode = '22023';
  end if;
  -- The two packages a founder can buy (D-318); the old ids until the contract step.
  if p_plan_id is null or p_plan_id not in ('strategist', 'commander', 'standard', 'adventurer') then
    raise exception 'start_checkout: the plan is not on sale' using errcode = '22023';
  end if;
  -- One purchase, one project (D-320).
  if p_project_id is null then
    raise exception 'start_checkout: a package is bought for a project' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.projects where id = p_project_id and user_id = v_user
  ) then
    raise exception 'start_checkout: not your project' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('start_checkout:' || v_user::text, 0));
  select (value #>> '{}')::integer into v_limit
  from public.settings where key = 'payments.checkouts_per_day';
  select count(*)::integer into v_today
  from public.checkout_refs
  where user_id = v_user
    and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
  if coalesce(v_limit, 0) <= 0 or v_today >= v_limit then
    raise exception 'start_checkout: the daily limit is reached' using errcode = '54000';
  end if;

  insert into public.checkout_refs (user_id, plan_id, project_id, adult_confirmed_at)
  values (v_user, p_plan_id, p_project_id, now())
  returning ref into v_ref;
  return v_ref;
end;
$$;
