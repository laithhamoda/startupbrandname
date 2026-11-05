-- The launch window without the phone step (D-334).
--
-- The phone check of D-332 stays, behind a setting: launch.require_phone. Off at launch, an account
-- takes its spot with a confirmed email; the owner turns the setting on, with no deployment, when
-- abuse shows and a text-message provider is set up. A missing value requires the phone, so a
-- missing setting never opens the door wider.
--
-- Expand only: a new setting, a looser check, a replaced function (same name and signature).

insert into public.settings (key, value) values ('launch.require_phone', 'false')
on conflict (key) do nothing;

alter table public.launch_spots
  drop constraint launch_spots_source_check,
  drop constraint launch_spots_check;

alter table public.launch_spots
  add constraint launch_spots_source_check check (source in ('phone', 'email', 'admin')),
  add constraint launch_spots_check check ((source = 'phone') = (phone_hash is not null));

-- Takes a spot for the signed-in account. With launch.require_phone on, the account's phone must be
-- confirmed and backs the spot (one number, one spot); otherwise its email must be confirmed.
-- Answers: granted, already, closed, phone_unverified, phone_used, email_unverified, admin.
create or replace function public.claim_launch_spot()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_phone text;
  v_phone_confirmed timestamptz;
  v_email_confirmed timestamptz;
  v_require_phone boolean;
  v_hash text;
begin
  if v_user is null then
    raise exception 'claim_launch_spot: not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.admins where user_id = v_user) then
    return 'admin';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('claim_launch_spot', 0));

  if exists (select 1 from public.launch_spots where user_id = v_user) then
    return 'already';
  end if;
  if not private.launch_open() then
    return 'closed';
  end if;

  select coalesce((select (value #>> '{}')::boolean from public.settings where key = 'launch.require_phone'), true)
  into v_require_phone;
  select u.phone, u.phone_confirmed_at, u.email_confirmed_at
  into v_phone, v_phone_confirmed, v_email_confirmed
  from auth.users u where u.id = v_user;

  if not v_require_phone then
    if v_email_confirmed is null then
      return 'email_unverified';
    end if;
    insert into public.launch_spots (user_id, source) values (v_user, 'email');
    return 'granted';
  end if;

  if v_phone is null or v_phone = '' or v_phone_confirmed is null then
    return 'phone_unverified';
  end if;
  v_hash := encode(sha256(convert_to(v_phone, 'utf8')), 'hex');
  if exists (select 1 from public.launch_spots where phone_hash = v_hash) then
    return 'phone_used';
  end if;
  insert into public.launch_spots (user_id, phone_hash, source) values (v_user, v_hash, 'phone');
  return 'granted';
end;
$$;

comment on function public.claim_launch_spot() is
  'Takes a launch spot for the signed-in account (D-332, D-334): with launch.require_phone on a confirmed phone backs it (one number, one spot), otherwise a confirmed email does.';
