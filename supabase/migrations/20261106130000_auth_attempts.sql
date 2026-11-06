-- A limit on sign-in code requests, code checks and spot claims (D-340).
--
-- Supabase Auth counts requests per network address, and every call from the app leaves from
-- Vercel's addresses, so its limits are shared by all visitors: one abuser can use them up for
-- everyone, and nothing stops a script from filling one mailbox with codes. The app asks this
-- function first, with keyed hashes of the visitor's network and of the mailbox (or the account),
-- and refuses a request over the limit before Supabase sees it.
--
-- Expand only: settings, a private table, one function for the server's secret key, a cleanup job.

insert into public.settings (key, value) values
  -- Sign-in codes, per mailbox and per network, in one hour. The network limit is wide: schools,
  -- offices and mobile carriers put many people behind one address.
  ('auth.limit.code_email', '5'),
  ('auth.limit.code_ip', '30'),
  -- Code checks, per mailbox and per network, in ten minutes.
  ('auth.limit.verify_email', '10'),
  ('auth.limit.verify_ip', '100'),
  -- Launch spot claims, per account, in ten minutes.
  ('auth.limit.claim_user', '10')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Attempts
-- ---------------------------------------------------------------------------------------------

-- Only keyed hashes: no readable address, email or account id. Not exposed to the API.
create table private.auth_attempts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('code', 'verify', 'claim')),
  ip_hash text not null,
  subject_hash text not null,
  at timestamptz not null default now()
);

revoke all on table private.auth_attempts from public, anon, authenticated;

create index auth_attempts_subject_idx on private.auth_attempts (kind, subject_hash, at);
create index auth_attempts_ip_idx on private.auth_attempts (kind, ip_hash, at);
create index auth_attempts_at_idx on private.auth_attempts (at);

comment on table private.auth_attempts is
  'Requests that passed the auth limit (D-340): the kind, keyed hashes of the network and of the mailbox or account, and when. Refused requests are not recorded. Purged after a day.';

-- ---------------------------------------------------------------------------------------------
-- The check
-- ---------------------------------------------------------------------------------------------

-- Answers true and records the attempt, or false when the mailbox (or account) or the network is
-- over its limit in the window. The server calls it with the secret key (service_role) only.
create function public.check_auth_attempt(p_kind text, p_ip_hash text, p_subject_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval;
  v_subject_max integer;
  v_ip_max integer;
begin
  if p_kind = 'code' then
    v_window := interval '1 hour';
    v_subject_max := coalesce((select (value #>> '{}')::integer from public.settings where key = 'auth.limit.code_email'), 5);
    v_ip_max := coalesce((select (value #>> '{}')::integer from public.settings where key = 'auth.limit.code_ip'), 30);
  elsif p_kind = 'verify' then
    v_window := interval '10 minutes';
    v_subject_max := coalesce((select (value #>> '{}')::integer from public.settings where key = 'auth.limit.verify_email'), 10);
    v_ip_max := coalesce((select (value #>> '{}')::integer from public.settings where key = 'auth.limit.verify_ip'), 100);
  elsif p_kind = 'claim' then
    v_window := interval '10 minutes';
    v_subject_max := coalesce((select (value #>> '{}')::integer from public.settings where key = 'auth.limit.claim_user'), 10);
    v_ip_max := null;
  else
    raise exception 'check_auth_attempt: unknown kind' using errcode = '22023';
  end if;

  if (
    select count(*) from private.auth_attempts a
    where a.kind = p_kind and a.subject_hash = p_subject_hash and a.at > now() - v_window
  ) >= v_subject_max then
    return false;
  end if;

  if v_ip_max is not null and (
    select count(*) from private.auth_attempts a
    where a.kind = p_kind and a.ip_hash = p_ip_hash and a.at > now() - v_window
  ) >= v_ip_max then
    return false;
  end if;

  insert into private.auth_attempts (kind, ip_hash, subject_hash)
  values (p_kind, p_ip_hash, p_subject_hash);
  return true;
end;
$$;

revoke all on function public.check_auth_attempt(text, text, text) from public, anon, authenticated;
grant execute on function public.check_auth_attempt(text, text, text) to service_role;

comment on function public.check_auth_attempt(text, text, text) is
  'The auth limit (D-340): true and a record, or false when the mailbox/account or the network is over its limit. Limits are in settings (auth.limit.*). Secret key only.';

-- ---------------------------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------------------------

select cron.schedule(
  'purge-auth-attempts',
  '23 * * * *',
  $$delete from private.auth_attempts where at < now() - interval '1 day'$$
);
