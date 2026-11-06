-- Launch spots, abuse guard (D-338): one mailbox takes one spot, and throwaway mailboxes take none.
--
-- With the phone check off (D-334) a confirmed email is all a spot needs, and one mailbox is many
-- addresses: a.b@gmail.com, ab+1@gmail.com and ab@googlemail.com all reach ab@gmail.com. So a spot
-- is also keyed by the canonical address, and a throwaway-mail domain cannot take one.
--
-- Expand only: a column and a unique index on launch_spots, a small table, two private functions,
-- and claim_launch_spot() replaced. Existing spots keep working.

-- ---------------------------------------------------------------------------------------------
-- The canonical mailbox
-- ---------------------------------------------------------------------------------------------

-- Lower case; "+tag" dropped for every domain; dots dropped and googlemail.com read as gmail.com
-- for Gmail, the one provider where dots never matter. An address that cannot be read returns as it
-- came, in lower case.
create function private.canonical_email(p_email text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_plain text := lower(btrim(p_email));
  v_local text;
  v_domain text;
begin
  if p_email is null then
    return null;
  end if;
  v_local := substring(v_plain from '^(.*)@[^@]*$');
  v_domain := substring(v_plain from '@([^@]*)$');
  if v_local is null or v_domain is null or v_domain = '' then
    return v_plain;
  end if;
  if v_domain = 'googlemail.com' then
    v_domain := 'gmail.com';
  end if;
  v_local := split_part(v_local, '+', 1);
  if v_local = '' then
    return v_plain;
  end if;
  if v_domain = 'gmail.com' then
    v_local := replace(v_local, '.', '');
  end if;
  return v_local || '@' || v_domain;
end;
$$;

revoke all on function private.canonical_email(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Throwaway-mail domains
-- ---------------------------------------------------------------------------------------------

create table public.blocked_email_domains (
  domain text primary key check (domain = lower(domain) and domain !~ '\s' and domain like '%.%'),
  added_at timestamptz not null default now()
);

comment on table public.blocked_email_domains is
  'Throwaway-mail domains that cannot take a launch spot (D-338). A short seed of well-known services; the admin adds more. Read only inside claim_launch_spot().';

alter table public.blocked_email_domains enable row level security;
revoke all on table public.blocked_email_domains from anon, authenticated;

insert into public.blocked_email_domains (domain) values
  ('mailinator.com'),
  ('yopmail.com'),
  ('guerrillamail.com'),
  ('sharklasers.com'),
  ('10minutemail.com'),
  ('trashmail.com'),
  ('getnada.com'),
  ('temp-mail.org')
on conflict (domain) do nothing;

create function private.email_blocked(p_email text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.blocked_email_domains b
    where b.domain = lower(substring(btrim(p_email) from '@([^@]*)$'))
  );
$$;

revoke all on function private.email_blocked(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Spots keyed by mailbox
-- ---------------------------------------------------------------------------------------------

alter table public.launch_spots add column email_canonical text;

-- Spots already taken by email: the earliest of each mailbox keeps the key; a later duplicate keeps
-- its spot and has no key, for an admin to look at. Nothing is revoked here.
update public.launch_spots s
set email_canonical = c.canonical
from (
  select
    s2.user_id,
    private.canonical_email(u.email) as canonical,
    row_number() over (
      partition by private.canonical_email(u.email) order by s2.claimed_at, s2.user_id
    ) as rank
  from public.launch_spots s2
  join auth.users u on u.id = s2.user_id
  where s2.source = 'email' and u.email is not null
) c
where c.user_id = s.user_id and c.rank = 1;

create unique index launch_spots_email_canonical_key
  on public.launch_spots (email_canonical)
  where email_canonical is not null;

-- ---------------------------------------------------------------------------------------------
-- Taking a spot
-- ---------------------------------------------------------------------------------------------

-- As before (D-334), plus: with the phone step off, a throwaway domain answers 'email_blocked' and a
-- mailbox that already holds a spot answers 'email_used'.
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
  'Takes a launch spot for the signed-in account (D-332, D-334, D-338): with launch.require_phone on a confirmed phone backs it (one number, one spot); otherwise a confirmed email does, one spot per mailbox (+tag and Gmail dots ignored) and none for a throwaway domain.';
