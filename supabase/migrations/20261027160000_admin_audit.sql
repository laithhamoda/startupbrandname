-- M7 step 8, part 1: who is an admin, and the audit log (docs/M7-PLAN.md, D-327).
--
-- An admin is an account listed in `admins` whose session is at assurance level aal2, which
-- Supabase gives only after a TOTP code. A session at aal1 (email code, Google) is never enough.
-- Every admin action writes one row of `audit_log`, in the same transaction as the action, and the
-- log can be neither changed nor emptied. The admin functions of part 2 call
-- private.require_admin() and private.write_audit().
--
-- Expand only: new tables and functions.

-- ---------------------------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is
  'Accounts allowed into the admin area, with a TOTP code (aal2). Written only by scripts/add-admin.mjs with the service role (D-327).';

alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

-- The session's assurance level, as Supabase puts it in the token.
create function private.session_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1');
$$;

revoke all on function private.session_aal() from public, anon, authenticated;

-- True for an admin whose session passed the second step. The check every admin function starts
-- with: nobody else gets past it, and the answer is not an error message that names admins.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
    and private.session_aal() = 'aal2';
$$;

revoke all on function private.is_admin() from public, anon, authenticated;

create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.require_admin() from public, anon, authenticated;

-- What the app does with the signed-in account: 'none' (not an admin: the app answers 404),
-- 'needs_mfa' (an admin whose session is not at aal2: the app asks for the code) or 'admin'.
create function public.admin_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from public.admins where user_id = auth.uid()) then 'none'
    when private.session_aal() <> 'aal2' then 'needs_mfa'
    else 'admin'
  end;
$$;

comment on function public.admin_status() is
  'none, needs_mfa or admin for the signed-in account; the admin pages guard on it (D-327).';

revoke all on function public.admin_status() from public, anon;
grant execute on function public.admin_status() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- Who acted; null after that account is deleted, the row stays.
  actor uuid references auth.users (id) on delete set null,
  action text not null check (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  target_type text check (target_type ~ '^[a-z][a-z0-9_]{0,39}$'),
  target_id text check (char_length(target_id) <= 100),
  -- Ids, counts and plan names only: never an answer, an email or a code.
  detail jsonb not null default '{}' check (jsonb_typeof(detail) = 'object')
);

comment on table public.audit_log is
  'Every admin action: who, what, on which object (D-327). Append only; written by private.write_audit() inside the action.';

create index audit_log_at_idx on public.audit_log (at desc);

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;

create function private.audit_log_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'the audit log is append only' using errcode = '42501';
end;
$$;

revoke all on function private.audit_log_is_append_only() from public, anon, authenticated;

create trigger audit_log_no_change
  before update or delete on public.audit_log
  for each row execute function private.audit_log_is_append_only();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.audit_log_is_append_only();

-- Writes one row for the signed-in admin; refuses anyone else.
create function private.write_audit(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_detail jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  insert into public.audit_log (actor, action, target_type, target_id, detail)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_detail, '{}'));
end;
$$;

revoke all on function private.write_audit(text, text, text, jsonb) from public, anon, authenticated;

-- The admin passed the second step: the first row of the log, and the proof the area was entered.
create function public.admin_enter()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit('admin.enter');
end;
$$;

comment on function public.admin_enter() is
  'Records that an admin entered the admin area with a verified code. Refuses anyone else (D-327).';

revoke all on function public.admin_enter() from public, anon;
grant execute on function public.admin_enter() to authenticated;
