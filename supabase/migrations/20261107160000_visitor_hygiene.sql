-- Visitor hygiene (D-352): the settings table shows a signed-in user only what the app reads for them, and old
-- anonymous visitors are deleted.
--
-- 1. Settings. "settings: signed-in users read" let every signed-in user, and now every anonymous visitor,
--    read every setting: spend caps, request limits, launch numbers. The app reads only three through a user's
--    own session (the AI model and its prices, and the daily PDF limit); everything else is read by security
--    definer functions or the server's secret key. The policy becomes those three keys.
-- 2. Anonymous visitors (D-350, D-335). A visit without signup keeps its answers 30 days (setting
--    anonymous.keep_days); then the identity and, by cascade, everything under it is deleted. A visitor who
--    signed in with an email is no longer anonymous and is never touched. One who somehow paid or holds a
--    subscription is kept for the records.

insert into public.settings (key, value) values
  ('anonymous.keep_days', '30')
on conflict (key) do nothing;

drop policy "settings: signed-in users read" on public.settings;

create policy "settings: signed-in users read the few the app reads for them" on public.settings
  for select to authenticated
  using (key in ('ai.model.fast', 'ai.prices', 'report.pdf_per_day'));

create function private.purge_anonymous_visitors()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_days integer;
  v_deleted integer;
begin
  select coalesce((select (value #>> '{}')::integer from public.settings where key = 'anonymous.keep_days'), 30)
  into v_days;

  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - make_interval(days => v_days)
    and not exists (select 1 from public.subscriptions s where s.user_id = u.id)
    and not exists (select 1 from public.payments p where p.user_id = u.id);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function private.purge_anonymous_visitors() from public, anon, authenticated;

comment on function private.purge_anonymous_visitors() is
  'Deletes anonymous visitors older than anonymous.keep_days (default 30) that hold no payment or subscription, with everything under them by cascade (D-352). Returns the number deleted.';

select cron.schedule(
  'purge-anonymous-visitors',
  '41 3 * * *',
  $$select private.purge_anonymous_visitors()$$
);
