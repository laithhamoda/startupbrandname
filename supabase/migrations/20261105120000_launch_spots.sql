-- The free launch window (D-332, D-333): 500 account spots, each taken with a verified phone.
--
-- The window ends at the first of two: the spots are taken, or launch.ends_at passes. An account
-- holds at most one spot, and one phone number backs at most one spot (its sha256 is kept, never the
-- number). A holder keeps the free window until launch.ends_at, and the project for launch.kept_months
-- more. The app reads the window through launch_window() (public, it feeds the counter) and
-- my_launch_spot(); claim_launch_spot() takes a spot once the account's phone is confirmed.
--
-- Expand only: new settings, a new table, new functions.

insert into public.settings (key, value) values
  ('launch.spots_total', '500'),
  ('launch.ends_at', '"2027-02-03T23:59:59+03:00"'),
  ('launch.kept_months', '6')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Spots
-- ---------------------------------------------------------------------------------------------

create table public.launch_spots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- sha256 of the verified phone number; null for a spot an admin gave by hand.
  phone_hash text unique check (phone_hash ~ '^[0-9a-f]{64}$'),
  source text not null default 'phone' check (source in ('phone', 'admin')),
  claimed_at timestamptz not null default now(),
  check ((source = 'phone') = (phone_hash is not null))
);

comment on table public.launch_spots is
  'The accounts that hold a launch spot (D-332): one per account, one per phone number. Written only by claim_launch_spot() and the admin functions; deleted with the account.';

alter table public.launch_spots enable row level security;

revoke all on table public.launch_spots from anon, authenticated;
grant select on table public.launch_spots to authenticated;

create policy "launch_spots: owner reads" on public.launch_spots
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- The window
-- ---------------------------------------------------------------------------------------------

-- The limits from settings. A missing spot count is 0 and a missing end date is null: both close
-- the window.
create function private.launch_limits()
returns table (spots_total integer, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select (value #>> '{}')::integer from public.settings where key = 'launch.spots_total'), 0),
    (select (value #>> '{}')::timestamptz from public.settings where key = 'launch.ends_at');
$$;

revoke all on function private.launch_limits() from public, anon, authenticated;

-- Whether a new account may still take a spot: the date has not passed and a spot is left.
create function private.launch_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(l.ends_at >= now(), false)
    and (select count(*) from public.launch_spots) < l.spots_total
  from private.launch_limits() l;
$$;

revoke all on function private.launch_open() from public, anon, authenticated;

-- What the counter shows. Open to visitors on purpose: it holds counts and a date, nothing else.
create function public.launch_window()
returns table (
  spots_total integer,
  spots_taken integer,
  spots_left integer,
  ends_at timestamptz,
  open boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.spots_total,
    t.n,
    greatest(l.spots_total - t.n, 0),
    l.ends_at,
    private.launch_open()
  from private.launch_limits() l,
    (select count(*)::integer as n from public.launch_spots) t;
$$;

comment on function public.launch_window() is
  'The launch window as the counter shows it (D-332): spots total, taken and left, the end date and whether new accounts may still take a spot. Counts only.';

revoke all on function public.launch_window() from public;
grant execute on function public.launch_window() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Taking a spot
-- ---------------------------------------------------------------------------------------------

-- Takes a spot for the signed-in account once its phone is confirmed. Answers: granted, already
-- (it holds one), closed (no spot left or the date passed), phone_unverified, phone_used (another
-- account holds a spot with this number), admin (admins take none).
create function public.claim_launch_spot()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_phone text;
  v_confirmed timestamptz;
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
  select u.phone, u.phone_confirmed_at into v_phone, v_confirmed
  from auth.users u where u.id = v_user;
  if v_phone is null or v_phone = '' or v_confirmed is null then
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
  'Takes a launch spot for the signed-in account when its phone is confirmed and a spot is left (D-332). One spot per account, one per phone number.';

revoke all on function public.claim_launch_spot() from public, anon;
grant execute on function public.claim_launch_spot() to authenticated;

-- What the signed-in account holds: active (a spot, before the end date), kept (the end date passed,
-- within launch.kept_months: the project is kept), or none.
create function public.my_launch_spot()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.user_id is null or l.ends_at is null then 'none'
    when now() <= l.ends_at then 'active'
    when now() <= l.ends_at + make_interval(months => k.months) then 'kept'
    else 'none'
  end
  from private.launch_limits() l
  left join public.launch_spots s on s.user_id = auth.uid()
  cross join (
    select coalesce((select (value #>> '{}')::integer from public.settings where key = 'launch.kept_months'), 0) as months
  ) k;
$$;

comment on function public.my_launch_spot() is
  'active, kept or none: what the signed-in account holds of the launch window (D-332, D-333).';

revoke all on function public.my_launch_spot() from public, anon;
grant execute on function public.my_launch_spot() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------------------------

-- Gives an account a spot by hand (a promise, a family that shares a phone). It takes one of the
-- spots but needs no phone, and it ignores the window.
create function public.admin_grant_launch_spot(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform private.require_admin();
  select u.id into v_user from auth.users u where lower(u.email) = lower(p_email);
  if v_user is null then
    raise exception 'admin_grant_launch_spot: no such account' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('claim_launch_spot', 0));
  if exists (select 1 from public.launch_spots where user_id = v_user) then
    raise exception 'admin_grant_launch_spot: the account holds a spot' using errcode = '22023';
  end if;
  insert into public.launch_spots (user_id, source) values (v_user, 'admin');
  perform private.write_audit(
    'admin.grant_launch_spot', 'account', v_user::text, jsonb_build_object('user', v_user)
  );
end;
$$;

-- Takes a spot back (an abuse, a mistake): the spot is free for another account again.
create function public.admin_free_launch_spot(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_source text;
begin
  perform private.require_admin();
  select u.id into v_user from auth.users u where lower(u.email) = lower(p_email);
  if v_user is null then
    raise exception 'admin_free_launch_spot: no such account' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('claim_launch_spot', 0));
  delete from public.launch_spots where user_id = v_user returning source into v_source;
  if v_source is null then
    raise exception 'admin_free_launch_spot: the account holds no spot' using errcode = '22023';
  end if;
  perform private.write_audit(
    'admin.free_launch_spot', 'account', v_user::text,
    jsonb_build_object('user', v_user, 'source', v_source)
  );
end;
$$;

revoke all on function public.admin_grant_launch_spot(text) from public, anon;
revoke all on function public.admin_free_launch_spot(text) from public, anon;
grant execute on function public.admin_grant_launch_spot(text) to authenticated;
grant execute on function public.admin_free_launch_spot(text) to authenticated;
