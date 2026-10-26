-- M7 step 6c: report versions and the final version of a paid project (D-321).
--
-- A paid project (its own running package, or a running package that covers the account) keeps
-- the versions of its report: each one the verdict, the input hash and a copy of the answers it
-- was made from. At most versions.max (10); once a version says «امضِ» (go), at most
-- versions.after_go (5) more. The founder then chooses one version as final: the project's answers
-- become that version's again, and they are closed to edits. After the purchase the answers that
-- define the project are locked (core_questions: the idea, who pays, the sector; the country is a
-- project column already fixed at creation), so one purchase cannot become another project.
--
-- Errors the app maps to messages: SB002 no version left, SB003 the project is closed (a final
-- version is chosen), SB004 a core answer of a paid project.
--
-- Expand only: a new column, a new table, new functions, a trigger, new settings.

insert into public.settings (key, value) values
  ('versions.max', '10'),
  ('versions.after_go', '5'),
  ('versions.core_questions', '["B1", "C1", "D2"]')
on conflict (key) do nothing;

alter table public.projects add column final_version integer check (final_version between 1 and 99);

comment on column public.projects.final_version is
  'The report version the founder chose as final (D-321); the answers are closed to edits once set. Set only by choose_final_version().';

-- ---------------------------------------------------------------------------------------------
-- Versions
-- ---------------------------------------------------------------------------------------------

create table public.report_versions (
  project_id uuid not null references public.projects (id) on delete cascade,
  number integer not null check (number between 1 and 99),
  verdict text not null check (verdict in ('go', 'revise', 'stop')),
  -- sha256 of the answers, parameters and engine version the report was made from (rule 4).
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  -- The project's answer rows when the version was made, without project_id.
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  created_at timestamptz not null default now(),
  primary key (project_id, number),
  unique (project_id, input_hash)
);

comment on table public.report_versions is
  'The report versions of a paid project (D-321): verdict, input hash and the answers each was made from. Written only by record_report_version(); deleted with the project.';

alter table public.report_versions enable row level security;

revoke all on table public.report_versions from anon, authenticated;
grant select on table public.report_versions to authenticated;

create policy "report_versions: owner reads" on public.report_versions
  for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------------------------
-- Whether a project is paid
-- ---------------------------------------------------------------------------------------------

-- A running package bought for the project, or a running package other than free that covers the
-- owner's account (a course voucher). Running means as the app reads it (lib/payments/plan-of.ts).
create function private.project_is_paid(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.subscriptions s
      on s.project_id = p.id or (s.project_id is null and s.user_id = p.user_id)
    where p.id = p_project
      and s.plan_id <> 'free'
      and s.status <> 'ended'
      and s.starts_at <= now()
      and case when s.ends_at is null then s.status <> 'canceled' else s.ends_at > now() end
  );
$$;

comment on function private.project_is_paid(uuid) is
  'True when a running package covers the project, bought for it or covering the account (D-320, D-321).';

revoke all on function private.project_is_paid(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Recording a version
-- ---------------------------------------------------------------------------------------------

-- Records the report the app just built from the project's current answers as a version, and
-- returns its number. The same answers (input hash) give back the version already recorded. A
-- missing or unreadable limit closes the door.
create function public.record_report_version(
  p_project_id uuid,
  p_input_hash text,
  p_verdict text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_final integer;
  v_number integer;
  v_last integer;
  v_first_go integer;
  v_max integer;
  v_after_go integer;
begin
  if v_user is null then
    raise exception 'record_report_version: not signed in' using errcode = '42501';
  end if;
  select final_version into v_final
  from public.projects where id = p_project_id and user_id = v_user;
  if not found then
    raise exception 'record_report_version: not your project' using errcode = '42501';
  end if;
  if not private.project_is_paid(p_project_id) then
    raise exception 'record_report_version: the project has no package' using errcode = '42501';
  end if;
  if v_final is not null then
    raise exception 'record_report_version: the project is closed' using errcode = 'SB003';
  end if;
  if p_verdict is null or p_verdict not in ('go', 'revise', 'stop') then
    raise exception 'record_report_version: unknown verdict' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('record_report_version:' || p_project_id::text, 0));

  select number into v_number
  from public.report_versions where project_id = p_project_id and input_hash = p_input_hash;
  if found then
    return v_number;
  end if;

  select coalesce(max(number), 0), min(number) filter (where verdict = 'go')
  into v_last, v_first_go
  from public.report_versions where project_id = p_project_id;
  select (value #>> '{}')::integer into v_max from public.settings where key = 'versions.max';
  select (value #>> '{}')::integer into v_after_go from public.settings where key = 'versions.after_go';
  if v_last >= coalesce(v_max, 0)
    or (v_first_go is not null and v_last - v_first_go >= coalesce(v_after_go, 0))
  then
    raise exception 'record_report_version: no version left' using errcode = 'SB002';
  end if;

  insert into public.report_versions (project_id, number, verdict, input_hash, answers)
  values (
    p_project_id,
    v_last + 1,
    p_verdict,
    p_input_hash,
    coalesce((
      select jsonb_agg(to_jsonb(a) - 'project_id' order by a.question_id)
      from public.answers a where a.project_id = p_project_id
    ), '[]'::jsonb)
  );
  return v_last + 1;
end;
$$;

comment on function public.record_report_version(uuid, text, text) is
  'Records a report version of a paid project of the signed-in user and returns its number, within versions.max and versions.after_go (D-321).';

revoke all on function public.record_report_version(uuid, text, text) from public, anon;
grant execute on function public.record_report_version(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Choosing the final version
-- ---------------------------------------------------------------------------------------------

-- Makes one recorded version the project's final report: the answers become that version's again,
-- and the project is closed to edits. Once only.
create function public.choose_final_version(p_project_id uuid, p_number integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_final integer;
  v_answers jsonb;
begin
  if v_user is null then
    raise exception 'choose_final_version: not signed in' using errcode = '42501';
  end if;
  select final_version into v_final
  from public.projects where id = p_project_id and user_id = v_user
  for update;
  if not found then
    raise exception 'choose_final_version: not your project' using errcode = '42501';
  end if;
  if v_final is not null then
    raise exception 'choose_final_version: the project is closed' using errcode = 'SB003';
  end if;
  select answers into v_answers
  from public.report_versions where project_id = p_project_id and number = p_number;
  if not found then
    raise exception 'choose_final_version: no such version' using errcode = '22023';
  end if;

  -- The guard on answers lets this one restore through; the flag ends with the transaction.
  perform set_config('sbn.restoring_answers', p_project_id::text, true);
  delete from public.answers where project_id = p_project_id;
  insert into public.answers
  select * from jsonb_populate_recordset(
    null::public.answers,
    (select coalesce(jsonb_agg(e || jsonb_build_object('project_id', p_project_id)), '[]'::jsonb)
     from jsonb_array_elements(v_answers) as e)
  );
  perform set_config('sbn.restoring_answers', '', true);

  update public.projects set final_version = p_number where id = p_project_id;
end;
$$;

comment on function public.choose_final_version(uuid, integer) is
  'Restores the answers of a recorded version, sets it as the final version and closes the project to edits (D-321). Once only.';

revoke all on function public.choose_final_version(uuid, integer) from public, anon;
grant execute on function public.choose_final_version(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Guard on answers
-- ---------------------------------------------------------------------------------------------

-- Refuses a change to the answers of a closed project (SB003), and a change to a core answer of a
-- paid project (SB004). A deletion that comes with the project's own deletion passes, as does the
-- restore of choose_final_version().
create function private.guard_answers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_question text;
  v_final integer;
  v_core jsonb;
begin
  if tg_op = 'DELETE' then
    v_project := old.project_id;
    v_question := old.question_id;
  else
    v_project := new.project_id;
    v_question := new.question_id;
  end if;
  -- The restore of choose_final_version(), and a deletion that comes with the project's own.
  if current_setting('sbn.restoring_answers', true) = v_project::text
    or not exists (select 1 from public.projects where id = v_project)
  then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  select final_version into v_final from public.projects where id = v_project;
  if v_final is not null then
    raise exception 'answers: the project is closed' using errcode = 'SB003';
  end if;

  -- A first answer to a core question is welcome; changing or removing one is not, once paid.
  if tg_op = 'INSERT' then
    return new;
  end if;
  select value into v_core from public.settings where key = 'versions.core_questions';
  if coalesce(v_core ? v_question, false) and private.project_is_paid(v_project) then
    if tg_op = 'DELETE' then
      raise exception 'answers: a core answer of a paid project' using errcode = 'SB004';
    end if;
    if new.normalized_value is distinct from old.normalized_value then
      raise exception 'answers: a core answer of a paid project' using errcode = 'SB004';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_answers() from public, anon, authenticated;

create trigger answers_guard
  before insert or update or delete on public.answers
  for each row execute function private.guard_answers();
