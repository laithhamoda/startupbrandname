-- Report versions without a limit (D-343): the 10-version cap and the 5 after "go" are lifted.
--
-- The owner wants a founder to edit and make new report versions without a limit. The cap lived in two
-- settings, versions.max and versions.after_go. A setting that is JSON null (or missing) now means no
-- limit, and the two settings are set to null; set them to numbers again and the cap returns, nothing
-- else to change. The lock on the core answers of a paid project, and the optional choice of a final
-- version, stay as they are.
--
-- Replaces record_report_version(); the body is the one of 20261026203000_report_versions.sql, with
-- the limit check changed.

create or replace function public.record_report_version(
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
  -- A limit that is null (or missing) is no limit.
  if (v_max is not null and v_last >= v_max)
    or (v_first_go is not null and v_after_go is not null and v_last - v_first_go >= v_after_go)
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
  'Records a report version of a paid project of the signed-in user and returns its number, within versions.max and versions.after_go when they are numbers (D-321); null means no limit (D-343).';

update public.settings set value = 'null'::jsonb where key in ('versions.max', 'versions.after_go');
