-- D-086 (owner decision, 2026-09-26): signup no longer asks about secondary school or age. The age
-- check moves to payment (M7). Onboarding now records the country, whether the person has a
-- project or a project idea (information only), and the consents. Nothing refuses an account here
-- any more; an account still counts as complete only once its profile exists (D-079).

drop function public.complete_onboarding(text, text, boolean, boolean, text, boolean, text);

alter table public.profiles
  drop column secondary_declared_at,
  drop column adult_declared_at,
  add column has_project boolean;

comment on column public.profiles.has_project is
  'Answer to "Do you have a project or a project idea?". Null only for accounts created before the question existed.';

comment on table public.profiles is
  'One row per account that completed onboarding. Written by complete_onboarding().';

-- Records the onboarding answers and consents in one step. Returns 'completed' or
-- 'already_complete'.
create function public.complete_onboarding(
  p_country_code text,
  p_locale text,
  p_has_project boolean,
  p_terms_version text,
  p_crossborder_consent boolean,
  p_crossborder_version text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'complete_onboarding: not signed in' using errcode = '42501';
  end if;

  if p_has_project is null or p_crossborder_consent is null then
    raise exception 'complete_onboarding: every question needs an answer' using errcode = '22023';
  end if;

  if exists (select 1 from public.profiles where user_id = v_user) then
    return 'already_complete';
  end if;

  insert into public.profiles (user_id, country_code, locale, has_project)
  values (v_user, p_country_code, p_locale, p_has_project);

  insert into public.consent_events (user_id, kind, action, text_version, locale)
  values (v_user, 'terms', 'given', p_terms_version, p_locale);

  if p_crossborder_consent then
    insert into public.consent_events (user_id, kind, action, text_version, locale)
    values (v_user, 'crossborder', 'given', p_crossborder_version, p_locale);
  end if;

  return 'completed';
end;
$$;

revoke all on function public.complete_onboarding(text, text, boolean, text, boolean, text)
  from public, anon;
grant execute on function public.complete_onboarding(text, text, boolean, text, boolean, text)
  to authenticated;
