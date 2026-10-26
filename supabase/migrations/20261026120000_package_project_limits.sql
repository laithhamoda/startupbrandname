-- M7 step 4: the project limit follows the account's package (D-313).
--
-- Free accounts keep entitlement.free.projects (1). A running package that covers the account
-- raises the limit to its own setting: 3 for «متردد» and «المغامر», no limit for the course
-- voucher ("unlimited"). Each value must equal PLANS[...].entitlements.projects in
-- apps/web/src/config/plans.ts (checked by a unit test). Running means as the app reads it
-- (lib/payments/plan-of.ts): started, not ended by a refund, before its end date; a cancelled one
-- without an end date has stopped.
--
-- Expand only: new settings rows, and create_project() keeps its signature; only its body changes.

insert into public.settings (key, value) values
  ('entitlement.standard.projects', '3'),
  ('entitlement.adventurer.projects', '3'),
  ('entitlement.course.projects', '"unlimited"')
on conflict (key) do nothing;

-- The best running package of an account that covers the whole account, or 'free'. The order is
-- PLAN_ORDER in config/plans.ts; a plan the list does not know is ignored.
create function private.account_plan(p_user uuid)
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
      and s.plan_id = any (array['free', 'standard', 'adventurer', 'course'])
    order by array_position(array['free', 'standard', 'adventurer', 'course'], s.plan_id) desc
    limit 1
  ), 'free');
$$;

comment on function private.account_plan(uuid) is
  'The best running package that covers the account, or free (D-313). Read by create_project().';

revoke all on function private.account_plan(uuid) from public, anon, authenticated;

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

  -- "unlimited" lifts the limit; a missing or unreadable value closes the door.
  if v_setting is distinct from '"unlimited"'::jsonb then
    v_limit := case when jsonb_typeof(v_setting) = 'number' then (v_setting #>> '{}')::integer end;
    if (select count(*) from public.projects where user_id = v_user) >= coalesce(v_limit, 0) then
      raise exception 'create_project: project limit reached' using errcode = 'SB001';
    end if;
  end if;

  insert into public.projects (user_id, title, country_code, currency, mode)
  values (v_user, btrim(p_title), p_country_code, p_currency, coalesce(p_mode, 'quick'))
  returning id into v_id;

  return v_id;
end;
$$;
