-- M3a: projects and answers (docs/SPEC.md §8; D-102 to D-113).
--
-- A project belongs to one account and cascades from it: deleting an account deletes its projects
-- and answers. Completeness and validation tasks are not stored; the app computes them from the
-- answers with the question bank (CLAUDE.md rule 3, one source of truth).
-- The app validates every answer against the question bank before saving it. The checks below
-- only keep each row's shape sane; a value that fails the question bank on read counts as missing.

-- ---------------------------------------------------------------------------------------------
-- Settings: entitlement values now; model prices and fair-use limits from M3c (SPEC §10).
-- ---------------------------------------------------------------------------------------------

create table public.settings (
  key text primary key check (key ~ '^[a-z0-9_.]{1,80}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.settings is
  'Configuration read by the app: entitlement values, model prices, fair-use limits. Written by migrations or the admin (M7), never by users.';

alter table public.settings enable row level security;

revoke all on table public.settings from anon, authenticated;
grant select on table public.settings to authenticated;

create policy "settings: signed-in users read" on public.settings
  for select to authenticated
  using (true);

create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function private.touch_updated_at();

-- Every account has the free plan's project limit until paid plans exist (D-109). Must equal
-- PLANS.free.entitlements.projects in apps/web/src/config/plans.ts (checked by a unit test).
insert into public.settings (key, value) values ('entitlement.free.projects', '1');

-- ---------------------------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  -- ISO 3166-1 alpha-2: the country of the analysis (A1 may name the same or another one).
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  -- ISO 4217, always chosen by the founder, never inferred (CLAUDE.md §3, D-111).
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  mode text not null default 'quick' check (mode in ('quick', 'full')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is
  'A founder''s project. Created only through create_project(), which enforces the project limit.';

create index projects_user_created_idx on public.projects (user_id, created_at desc);

alter table public.projects enable row level security;

revoke all on table public.projects from anon, authenticated;
grant select, delete on table public.projects to authenticated;
-- Country and currency stay fixed once answers exist; only the name and the mode change.
grant update (title, mode) on table public.projects to authenticated;

create policy "projects: owner reads" on public.projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "projects: owner renames or switches mode" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "projects: owner deletes" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function private.touch_updated_at();

-- Creates a project for the signed-in, onboarded account. Raises SQLSTATE 'SB001' when the
-- account already has as many projects as its plan allows (D-109).
create function public.create_project(
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
  v_limit integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'create_project: not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where user_id = v_user) then
    raise exception 'create_project: onboarding is not complete' using errcode = '42501';
  end if;

  select (value #>> '{}')::integer into v_limit
  from public.settings
  where key = 'entitlement.free.projects';

  -- One creation at a time per account, so two quick clicks cannot pass the limit together.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  if (select count(*) from public.projects where user_id = v_user) >= coalesce(v_limit, 0) then
    raise exception 'create_project: project limit reached' using errcode = 'SB001';
  end if;

  insert into public.projects (user_id, title, country_code, currency, mode)
  values (v_user, btrim(p_title), p_country_code, p_currency, coalesce(p_mode, 'quick'))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_project(text, text, text, text) from public, anon;
grant execute on function public.create_project(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Answers
-- ---------------------------------------------------------------------------------------------

create table public.answers (
  project_id uuid not null references public.projects (id) on delete cascade,
  -- A core question ("F3") or a follow-up ("F6.1").
  question_id text not null check (question_id ~ '^[A-H][1-8](\.[1-9][0-9]?)?$'),
  -- What the founder typed, kept as written (CLAUDE.md §3). Null for choices and amounts.
  raw_text text check (raw_text is null or char_length(raw_text) <= 8000),
  -- The question bank's Answer: {"status": "answered", "value": …} or {"status": "unknown"}.
  normalized_value jsonb not null check (
    jsonb_typeof(normalized_value) = 'object'
    and normalized_value ->> 'status' in ('answered', 'unknown')
  ),
  -- Provenance on every fact (CLAUDE.md rule 2).
  source text not null check (source in ('user', 'assumption', 'external')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  validated boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (project_id, question_id),
  -- «لا أعرف» is always a low-confidence, unvalidated assumption (D-104).
  constraint answers_unknown_is_assumption check (
    normalized_value ->> 'status' <> 'unknown'
    or (source = 'assumption' and confidence = 'low' and not validated)
  )
);

comment on table public.answers is
  'One row per answered question or follow-up, with provenance. Validated by the app against @sbn/question-bank.';

alter table public.answers enable row level security;

revoke all on table public.answers from anon, authenticated;
grant select, insert, update, delete on table public.answers to authenticated;

create policy "answers: owner reads" on public.answers
  for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = (select auth.uid())
  ));

create policy "answers: owner writes" on public.answers
  for insert to authenticated
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = (select auth.uid())
  ));

create policy "answers: owner changes" on public.answers
  for update to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = (select auth.uid())
  ));

create policy "answers: owner deletes" on public.answers
  for delete to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = (select auth.uid())
  ));

create trigger answers_touch_updated_at
  before update on public.answers
  for each row execute function private.touch_updated_at();
