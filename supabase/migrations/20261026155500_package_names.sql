-- M7 step 6a: the packages are renamed «استراتيجي» (strategist) and «قائد» (commander) (D-318),
-- and the course voucher gives «استراتيجي» (D-319), which puts it below «قائد» in the order.
--
-- Expand only: new settings rows; account_plan() and start_checkout() keep their signatures and
-- accept the new ids next to the old ones ('standard', 'adventurer'), which no real purchase uses.
-- A later contract step removes the old ids and their settings.

insert into public.settings (key, value) values
  ('entitlement.strategist.projects', '3'),
  ('entitlement.commander.projects', '3')
on conflict (key) do nothing;

-- The best running package of an account that covers the whole account, or 'free'. The order is
-- PLAN_ORDER in config/plans.ts, each old id next to its new one; an unknown plan is ignored.
create or replace function private.account_plan(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.plan_id
    from public.subscriptions s
    where s.user_id = p_user
      and s.project_id is null
      and s.status <> 'ended'
      and s.starts_at <= now()
      and case when s.ends_at is null then s.status <> 'canceled' else s.ends_at > now() end
      and s.plan_id = any (array['free', 'standard', 'strategist', 'course', 'adventurer', 'commander'])
    order by array_position(
      array['free', 'standard', 'strategist', 'course', 'adventurer', 'commander'], s.plan_id
    ) desc
    limit 1
  ), 'free');
$$;

comment on function private.account_plan(uuid) is
  'The best running package that covers the account, or free (D-313, D-318). Read by create_project().';

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
