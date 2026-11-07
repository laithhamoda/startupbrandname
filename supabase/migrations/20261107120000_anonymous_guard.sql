-- The first visit without signup (D-335, D-350), step 1: the database knows an anonymous visitor.
--
-- Supabase gives an anonymous visitor the role `authenticated` and a token with `is_anonymous` true, so
-- row level security treats them as an account that owns their rows. What must not follow from that is a
-- launch spot: it goes to a confirmed mailbox only.

create function private.is_anonymous()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

comment on function private.is_anonymous() is
  'Whether the request comes from an anonymous visitor (D-350): the token claim is_anonymous.';

revoke all on function private.is_anonymous() from public, anon, authenticated;

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
  v_email text;
  v_email_confirmed timestamptz;
  v_require_phone boolean;
  v_hash text;
  v_canonical text;
begin
  if v_user is null then
    raise exception 'claim_launch_spot: not signed in' using errcode = '42501';
  end if;
  -- A visitor without an account holds no spot (D-350); the spot comes when the email is confirmed.
  if private.is_anonymous() then
    return 'email_unverified';
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
  select u.phone, u.phone_confirmed_at, u.email, u.email_confirmed_at
  into v_phone, v_phone_confirmed, v_email, v_email_confirmed
  from auth.users u where u.id = v_user;

  if not v_require_phone then
    if v_email_confirmed is null then
      return 'email_unverified';
    end if;
    if private.email_blocked(v_email) then
      return 'email_blocked';
    end if;
    v_canonical := private.canonical_email(v_email);
    if exists (select 1 from public.launch_spots where email_canonical = v_canonical) then
      return 'email_used';
    end if;
    insert into public.launch_spots (user_id, source, email_canonical)
    values (v_user, 'email', v_canonical);
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
  'Takes a launch spot for the signed-in account (D-332, D-334, D-338, D-350): with launch.require_phone on a confirmed phone backs it (one number, one spot); otherwise a confirmed email does, one spot per mailbox (+tag and Gmail dots ignored) and none for a throwaway domain. An anonymous visitor takes none.';
