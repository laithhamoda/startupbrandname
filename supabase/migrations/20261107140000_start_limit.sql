-- The first visit without signup (D-350), step 2: a limit on starts per network.
--
-- A visitor who starts without an account is signed in anonymously; the app asks this check first, so one
-- address cannot make anonymous identities without end. The network limit is wide on purpose: schools,
-- offices and mobile carriers put many people behind one address. Supabase's own anonymous limit stays
-- behind it.

insert into public.settings (key, value) values
  ('auth.limit.start_ip', '60')
on conflict (key) do nothing;

alter table private.auth_attempts drop constraint auth_attempts_kind_check;
alter table private.auth_attempts
  add constraint auth_attempts_kind_check check (kind in ('code', 'verify', 'claim', 'start'));

create or replace function public.check_auth_attempt(p_kind text, p_ip_hash text, p_subject_hash text)
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
  elsif p_kind = 'start' then
    -- A first visit without signup: counted per network only, the subject is a fresh value each time.
    v_window := interval '1 hour';
    v_subject_max := null;
    v_ip_max := coalesce((select (value #>> '{}')::integer from public.settings where key = 'auth.limit.start_ip'), 60);
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

comment on function public.check_auth_attempt(text, text, text) is
  'The auth limit (D-340, D-350): true and a record, or false when the mailbox/account or the network is over its limit. Limits are in settings (auth.limit.*). Secret key only.';
