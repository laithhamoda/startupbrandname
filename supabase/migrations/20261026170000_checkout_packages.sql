-- M7 step 5: a checkout is started for a package, priced from the environment (D-317).
--
-- The provider's prices differ between the sandbox (staging) and the live account (production), so
-- they live in each environment's settings, not in a migration: billing_products stays empty and is
-- dropped in a later contract step. start_checkout() now accepts the two packages a founder can buy
-- (D-313) instead of looking a plan up in billing_products; the app picks the price, the upgrade
-- included. Everything else is unchanged: sign-in, onboarding, the 18+ confirmation (D-086), the
-- user's own project, and the daily limit.
--
-- Expand only: the function keeps its signature; only its body changes.

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
  if p_plan_id is null or p_plan_id not in ('standard', 'adventurer') then
    raise exception 'start_checkout: the plan is not on sale' using errcode = '22023';
  end if;
  if p_project_id is not null and not exists (
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
