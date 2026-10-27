-- M7 step 6: VIVA vouchers (docs/M7-PLAN.md, CLAUDE.md §3, D-038, D-060, D-319, D-325).
--
-- A voucher is a code of VIVA plus 8 uppercase hex characters that carries no meaning: its type,
-- batch, affiliate and expiry live here. Activating one writes a subscriptions row with source
-- 'voucher' for the plan its type names; Paddle is never involved. The commission of an affiliate
-- is recorded on activation, never on issue: step 7 hooks into activate_voucher().
--
-- Expand only: new tables, settings rows and functions. Nothing is written by the client; the
-- server calls both functions with the service role, which is how the address of the request
-- (hashed in the app) reaches the lock that stops one network from guessing across accounts.

-- ---------------------------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------------------------

-- Five failed attempts lock an account, and a network, for 15 minutes (CLAUDE.md §3). Open question
-- #11 left the window to us; the admin can change both numbers (step 8).
insert into public.settings (key, value) values
  ('vouchers.max_failures', '5'),
  ('vouchers.lock_minutes', '15')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Voucher types
-- ---------------------------------------------------------------------------------------------

-- What a type gives and how long a code stays activatable. The old weekly, monthly and annual
-- types do not exist any more (the packages replaced those plans, D-313, D-318); a package voucher
-- is a row here once the owner decides one.
create table public.voucher_types (
  type text primary key check (type ~ '^[a-z][a-z0-9_]{0,39}$'),
  plan_id text not null check (plan_id ~ '^[a-z][a-z0-9_]{0,39}$'),
  -- How long the access lasts, counted from activation.
  access_interval interval not null check (access_interval > interval '0'),
  -- How long after issue the code can still be activated.
  window_interval interval not null check (window_interval > interval '0')
);

comment on table public.voucher_types is
  'What each voucher type gives (plan, access length) and how long a code can be activated after issue (D-060: 60 days, 12 months for course codes).';

insert into public.voucher_types (type, plan_id, access_interval, window_interval) values
  ('course_12m', 'course', interval '12 months', interval '12 months');

alter table public.voucher_types enable row level security;
revoke all on table public.voucher_types from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Batches and vouchers
-- ---------------------------------------------------------------------------------------------

create table public.voucher_batches (
  id uuid primary key default gen_random_uuid(),
  type text not null references public.voucher_types (type),
  -- The affiliate the batch belongs to; the table and the key come with step 7.
  affiliate_id uuid,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

comment on table public.voucher_batches is
  'A group of vouchers issued together: one type, one affiliate (step 7), one note.';

create table public.vouchers (
  code text primary key check (code ~ '^VIVA[0-9A-F]{8}$'),
  batch_id uuid not null references public.voucher_batches (id),
  type text not null references public.voucher_types (type),
  status text not null default 'issued' check (status in ('issued', 'activated', 'revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Who activated it; null after that account is deleted.
  activated_by uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  -- When the buyer confirmed being 18 or older at activation (D-086, OQ #80).
  adult_confirmed_at timestamptz,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  constraint vouchers_activation check ((status = 'activated') = (activated_at is not null)),
  constraint vouchers_period check (expires_at > issued_at)
);

comment on table public.vouchers is
  'VIVA codes. The code carries no meaning; type, affiliate (through the batch) and expiry live here. Written only by issue_voucher_batch() and activate_voucher().';

create index vouchers_batch_idx on public.vouchers (batch_id);
create index vouchers_activated_by_idx on public.vouchers (activated_by) where activated_by is not null;

-- Attempts, kept to count failures per account and per network. The address is a keyed hash made
-- by the app; the table holds no readable address.
create table public.voucher_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ip_hash text not null check (char_length(ip_hash) between 16 and 128),
  ok boolean not null,
  at timestamptz not null default now()
);

comment on table public.voucher_attempts is
  'Every activation attempt: who (deleted with the account), a keyed hash of the network, the outcome. Counts the failures behind the 5-attempt lock.';

create index voucher_attempts_user_idx on public.voucher_attempts (user_id, at desc);
create index voucher_attempts_ip_idx on public.voucher_attempts (ip_hash, at desc);

alter table public.voucher_batches enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_attempts enable row level security;
revoke all on table public.voucher_batches, public.vouchers, public.voucher_attempts
  from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Issuing
-- ---------------------------------------------------------------------------------------------

-- Creates a batch and returns its codes, once: the owner's script writes them to a file. The codes
-- come from gen_random_uuid(), which is random enough for 32 bits that carry no meaning.
create function public.issue_voucher_batch(
  p_type text,
  p_count integer,
  p_affiliate uuid default null,
  p_note text default null
)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch uuid;
  v_window interval;
  v_code text;
  v_made integer := 0;
begin
  if p_count is null or p_count not between 1 and 1000 then
    raise exception 'issue_voucher_batch: count must be between 1 and 1000' using errcode = '22023';
  end if;
  select window_interval into v_window from public.voucher_types where type = p_type;
  if v_window is null then
    raise exception 'issue_voucher_batch: unknown type' using errcode = '22023';
  end if;

  insert into public.voucher_batches (type, affiliate_id, note)
  values (p_type, p_affiliate, p_note)
  returning id into v_batch;

  while v_made < p_count loop
    v_code := 'VIVA' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into public.vouchers (code, batch_id, type, expires_at)
    values (v_code, v_batch, p_type, now() + v_window)
    on conflict (code) do nothing;
    if found then
      v_made := v_made + 1;
      return next v_code;
    end if;
  end loop;
end;
$$;

revoke all on function public.issue_voucher_batch(text, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.issue_voucher_batch(text, integer, uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Activating
-- ---------------------------------------------------------------------------------------------

-- Answers one word: 'activated', 'invalid' (unknown, used, revoked, expired and malformed codes
-- all look the same), 'locked' (too many failures for this account or network) or 'in_use' (the
-- account already has this plan running, and the code is kept). Only 'invalid' counts as a
-- failure. The caller is the server, which knows the signed-in user (p_user) and hashes the network
-- address (p_ip_hash); the buyer must have confirmed being an adult (D-086).
create function public.activate_voucher(
  p_user uuid,
  p_ip_hash text,
  p_code text,
  p_adult_confirmed boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_lock interval;
  v_code text;
  v_voucher public.vouchers;
  v_type public.voucher_types;
  v_subscription uuid;
begin
  if p_user is null or p_ip_hash is null then
    raise exception 'activate_voucher: user and network are required' using errcode = '22023';
  end if;
  if p_adult_confirmed is distinct from true then
    raise exception 'activate_voucher: the buyer must confirm being 18 or older' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where user_id = p_user) then
    raise exception 'activate_voucher: onboarding is not complete' using errcode = '42501';
  end if;

  select coalesce((select (value #>> '{}')::integer from public.settings where key = 'vouchers.max_failures'), 5)
    into v_max;
  select make_interval(mins => coalesce(
    (select (value #>> '{}')::integer from public.settings where key = 'vouchers.lock_minutes'), 15))
    into v_lock;

  -- One activation of an account at a time, so parallel guesses cannot slip under the count.
  perform pg_advisory_xact_lock(hashtextextended('voucher:' || p_user::text, 0));

  if (select count(*) from public.voucher_attempts
        where user_id = p_user and not ok and at > now() - v_lock) >= v_max
     or (select count(*) from public.voucher_attempts
           where ip_hash = p_ip_hash and not ok and at > now() - v_lock) >= v_max then
    return 'locked';
  end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));

  if v_code ~ '^VIVA[0-9A-F]{8}$' then
    select * into v_voucher from public.vouchers where code = v_code for update;
  end if;

  if v_voucher.code is null
     or v_voucher.status <> 'issued'
     or v_voucher.expires_at <= now() then
    insert into public.voucher_attempts (user_id, ip_hash, ok) values (p_user, p_ip_hash, false);
    return 'invalid';
  end if;

  select * into v_type from public.voucher_types where type = v_voucher.type;

  if exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user
      and s.source = 'voucher'
      and s.plan_id = v_type.plan_id
      and s.project_id is null
      and s.status = 'active'
      and (s.ends_at is null or s.ends_at > now())
  ) then
    return 'in_use';
  end if;

  insert into public.subscriptions (user_id, plan_id, source, status, starts_at, ends_at)
  values (p_user, v_type.plan_id, 'voucher', 'active', now(), now() + v_type.access_interval)
  returning id into v_subscription;

  update public.vouchers
  set status = 'activated',
      activated_by = p_user,
      activated_at = now(),
      adult_confirmed_at = now(),
      subscription_id = v_subscription
  where code = v_voucher.code;

  insert into public.voucher_attempts (user_id, ip_hash, ok) values (p_user, p_ip_hash, true);
  -- Step 7 records the affiliate's commission here, on activation.
  return 'activated';
end;
$$;

comment on function public.activate_voucher(uuid, text, text, boolean) is
  'Activates a VIVA code for a user: activated, invalid, locked or in_use. Service role only (D-325).';

revoke all on function public.activate_voucher(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.activate_voucher(uuid, text, text, boolean) to service_role;
