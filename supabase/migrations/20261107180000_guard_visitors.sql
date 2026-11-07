-- A visitor who began without an account (D-350) holds the role `authenticated` with an `is_anonymous`
-- claim, so every function granted to `authenticated` is open to them. Only claim_launch_spot() had a guard.
-- Payment, rating and report records belong to an account (D-355).
--
-- Each function is moved, unchanged, to the private schema and the public name becomes a thin wrapper with the
-- same signature that refuses a visitor first. The app and its types see no difference, and the original bodies
-- are not copied, so they cannot drift.
--
-- contract: the public names keep working through the whole migration (it runs in one transaction and creates
-- the wrappers before it ends), so no deployed app sees a missing function.

alter function public.start_checkout(text, uuid, boolean) set schema private;
alter function private.start_checkout(text, uuid, boolean) rename to start_checkout_impl;
alter function public.rate_report(uuid, integer, smallint, text) set schema private;
alter function private.rate_report(uuid, integer, smallint, text) rename to rate_report_impl;
alter function public.has_report_rating(uuid, integer) set schema private;
alter function private.has_report_rating(uuid, integer) rename to has_report_rating_impl;
alter function public.record_report(uuid, uuid, text, text, text, text, text, text, integer) set schema private;
alter function private.record_report(uuid, uuid, text, text, text, text, text, text, integer)
  rename to record_report_impl;
alter function public.record_report_version(uuid, text, text) set schema private;
alter function private.record_report_version(uuid, text, text) rename to record_report_version_impl;
alter function public.choose_final_version(uuid, integer) set schema private;
alter function private.choose_final_version(uuid, integer) rename to choose_final_version_impl;

revoke all on function private.start_checkout_impl(text, uuid, boolean) from public, anon, authenticated;
revoke all on function private.rate_report_impl(uuid, integer, smallint, text) from public, anon, authenticated;
revoke all on function private.has_report_rating_impl(uuid, integer) from public, anon, authenticated;
revoke all on function private.record_report_impl(uuid, uuid, text, text, text, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function private.record_report_version_impl(uuid, text, text) from public, anon, authenticated;
revoke all on function private.choose_final_version_impl(uuid, integer) from public, anon, authenticated;

create function public.start_checkout(p_plan_id text, p_project_id uuid, p_adult_confirmed boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_anonymous() then
    raise exception 'start_checkout: save the visit with an account first' using errcode = '42501';
  end if;
  return private.start_checkout_impl(p_plan_id, p_project_id, p_adult_confirmed);
end;
$$;

create function public.rate_report(p_project_id uuid, p_version integer, p_stars smallint, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_anonymous() then
    raise exception 'rate_report: save the visit with an account first' using errcode = '42501';
  end if;
  perform private.rate_report_impl(p_project_id, p_version, p_stars, p_comment);
end;
$$;

create function public.has_report_rating(p_project_id uuid, p_version integer)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.is_anonymous() then
    return false;
  end if;
  return private.has_report_rating_impl(p_project_id, p_version);
end;
$$;

create function public.record_report(
  p_report_id uuid,
  p_project_id uuid,
  p_kind text,
  p_locale text,
  p_audience text,
  p_input_hash text,
  p_engine_version text,
  p_pdf_path text,
  p_pdf_bytes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_anonymous() then
    raise exception 'record_report: save the visit with an account first' using errcode = '42501';
  end if;
  return private.record_report_impl(
    p_report_id, p_project_id, p_kind, p_locale, p_audience, p_input_hash, p_engine_version, p_pdf_path,
    p_pdf_bytes
  );
end;
$$;

create function public.record_report_version(p_project_id uuid, p_input_hash text, p_verdict text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_anonymous() then
    raise exception 'record_report_version: save the visit with an account first' using errcode = '42501';
  end if;
  return private.record_report_version_impl(p_project_id, p_input_hash, p_verdict);
end;
$$;

create function public.choose_final_version(p_project_id uuid, p_number integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_anonymous() then
    raise exception 'choose_final_version: save the visit with an account first' using errcode = '42501';
  end if;
  perform private.choose_final_version_impl(p_project_id, p_number);
end;
$$;

revoke all on function public.start_checkout(text, uuid, boolean) from public, anon;
revoke all on function public.rate_report(uuid, integer, smallint, text) from public, anon;
revoke all on function public.has_report_rating(uuid, integer) from public, anon;
revoke all on function public.record_report(uuid, uuid, text, text, text, text, text, text, integer)
  from public, anon;
revoke all on function public.record_report_version(uuid, text, text) from public, anon;
revoke all on function public.choose_final_version(uuid, integer) from public, anon;
grant execute on function public.start_checkout(text, uuid, boolean) to authenticated;
grant execute on function public.rate_report(uuid, integer, smallint, text) to authenticated;
grant execute on function public.has_report_rating(uuid, integer) to authenticated;
grant execute on function public.record_report(uuid, uuid, text, text, text, text, text, text, integer)
  to authenticated;
grant execute on function public.record_report_version(uuid, text, text) to authenticated;
grant execute on function public.choose_final_version(uuid, integer) to authenticated;
