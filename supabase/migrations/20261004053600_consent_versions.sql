-- Audit fixes, PR B: a cross-border consent counts only for a version of its text listed in
-- settings, so changing the wording asks every user to agree again (D-147; PRIV-1, PRIV-4; GDPR
-- Art. 7). The text now names the review of typed answers, which already went to Anthropic under
-- a consent that named only the mentor; consents given to that earlier text no longer count.
--
-- Expand only: crossborder_consent_state() is new, and has_crossborder_consent() and
-- set_crossborder_consent() keep their signatures.

-- The versions of the consent text a consent may have been given to. Must contain
-- CROSSBORDER_VERSION in apps/web/src/config/legal.ts (checked by a unit test). A version is
-- added here only when its wording describes the same processing as the current one.
insert into public.settings (key, value)
values ('consent.crossborder.accepted_versions', '["2026-10-draft-2"]');

-- The signed-in user's cross-border consent: 'current' when the latest event gives it to a listed
-- version of the text, 'outdated' when it gives it to an earlier version (the user is asked to
-- renew it), 'none' when it was never given or was withdrawn.
create function public.crossborder_consent_state()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when e.action <> 'given' then 'none'
        when (
          select s.value @> to_jsonb(e.text_version)
          from public.settings s
          where s.key = 'consent.crossborder.accepted_versions'
        ) then 'current'
        else 'outdated'
      end
      from public.consent_events e
      where e.user_id = (select auth.uid()) and e.kind = 'crossborder'
      order by e.created_at desc, e.id desc
      limit 1
    ),
    'none'
  );
$$;

revoke all on function public.crossborder_consent_state() from public, anon;
grant execute on function public.crossborder_consent_state() to authenticated;

-- True only for a consent to a listed version of the text. Kept for apps deployed before this
-- migration, which call it; it is dropped in a later contract migration.
create or replace function public.has_crossborder_consent()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.crossborder_consent_state() = 'current';
$$;

-- Gives or withdraws the optional cross-border consent (D-062). Repeating the current state
-- records nothing; giving it again to a new version of the text records the renewal.
create or replace function public.set_crossborder_consent(p_given boolean, p_text_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_locale text;
  v_current boolean;
  v_version text;
begin
  if v_user is null then
    raise exception 'set_crossborder_consent: not signed in' using errcode = '42501';
  end if;
  if p_given is null then
    raise exception 'set_crossborder_consent: an answer is required' using errcode = '22023';
  end if;

  select locale into v_locale from public.profiles where user_id = v_user;
  if v_locale is null then
    raise exception 'set_crossborder_consent: onboarding is not complete' using errcode = '42501';
  end if;

  select action = 'given', text_version into v_current, v_version
  from public.consent_events
  where user_id = v_user and kind = 'crossborder'
  order by created_at desc, id desc
  limit 1;

  if coalesce(v_current, false) = p_given and (not p_given or v_version = p_text_version) then
    return;
  end if;

  insert into public.consent_events (user_id, kind, action, text_version, locale)
  values (
    v_user,
    'crossborder',
    case when p_given then 'given' else 'withdrawn' end,
    p_text_version,
    v_locale
  );
end;
$$;
