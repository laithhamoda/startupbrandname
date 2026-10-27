-- M7 step 6d: the mentor pack (D-322).
--
-- Ten more AI mentor messages for one project, bought once for $7, on any project of the buyer,
-- free ones included. A purchase adds a row to mentor_credits; the mentor (M6) reads a project's
-- quota as its package's messages plus the credits that are not revoked. A full refund or a
-- chargeback revokes the credits that payment bought (the messages already sent stay sent).
--
-- start_checkout() accepts 'mentor_pack' beside the packages; apply_payment_event() reads a
-- "credit" in a payment change ({"messages": n}) the way it reads a "grant", and writes the
-- credit for the project the checkout named. The checkout reference is kept on the credit, so
-- the page the buyer returns to can tell when this purchase arrived.
--
-- Expand only: a new table; both functions keep their signatures and only their bodies change.

-- ---------------------------------------------------------------------------------------------
-- Mentor credits
-- ---------------------------------------------------------------------------------------------

create table public.mentor_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  messages integer not null check (messages between 1 and 1000),
  source text not null check (source in ('paddle', 'admin')),
  -- The payment that bought the credit; null for an admin grant.
  payment_id uuid unique references public.payments (id) on delete cascade,
  -- The checkout the buyer started, so the return page finds this purchase.
  checkout_ref uuid unique,
  -- Set by a full refund or a chargeback of the payment: the credit no longer counts.
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mentor_credits_payment_by_source check ((source = 'paddle') = (payment_id is not null))
);

comment on table public.mentor_credits is
  'Extra AI mentor messages for one project: a mentor pack purchase or an admin grant (D-322). Paddle rows are written only by apply_payment_event(); deleted with the project or the account.';

create index mentor_credits_project_idx on public.mentor_credits (project_id);
create index mentor_credits_user_idx on public.mentor_credits (user_id);

alter table public.mentor_credits enable row level security;

revoke all on table public.mentor_credits from anon, authenticated;
grant select on table public.mentor_credits to authenticated;

create policy "mentor_credits: owner reads" on public.mentor_credits
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Starting a checkout
-- ---------------------------------------------------------------------------------------------

create or replace function public.start_checkout(
  p_plan_id text,
  p_project_id uuid,
  p_adult_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_today integer;
  v_ref uuid;
begin
  if v_user is null then
    raise exception 'start_checkout: not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where user_id = v_user) then
    raise exception 'start_checkout: onboarding is not complete' using errcode = '42501';
  end if;
  if p_adult_confirmed is distinct from true then
    raise exception 'start_checkout: the buyer must confirm being 18 or older' using errcode = '22023';
  end if;
  -- The two packages (D-318), the mentor pack (D-322); the old ids until the contract step.
  if p_plan_id is null
    or p_plan_id not in ('strategist', 'commander', 'mentor_pack', 'standard', 'adventurer') then
    raise exception 'start_checkout: the plan is not on sale' using errcode = '22023';
  end if;
  -- One purchase, one project (D-320, D-322).
  if p_project_id is null then
    raise exception 'start_checkout: a package is bought for a project' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.projects where id = p_project_id and user_id = v_user
  ) then
    raise exception 'start_checkout: not your project' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('start_checkout:' || v_user::text, 0));
  select (value #>> '{}')::integer into v_limit
  from public.settings where key = 'payments.checkouts_per_day';
  select count(*)::integer into v_today
  from public.checkout_refs
  where user_id = v_user
    and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
  if coalesce(v_limit, 0) <= 0 or v_today >= v_limit then
    raise exception 'start_checkout: the daily limit is reached' using errcode = '54000';
  end if;

  insert into public.checkout_refs (user_id, plan_id, project_id, adult_confirmed_at)
  values (v_user, p_plan_id, p_project_id, now())
  returning ref into v_ref;
  return v_ref;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Applying a provider event
-- ---------------------------------------------------------------------------------------------

-- As before (20261025120000_m7_payments.sql), with two additions: a payment change may carry
-- "credit" ({"messages": n}) for a mentor pack, written to mentor_credits for the checkout's
-- project; and a full refund or a chargeback revokes the credit its payment bought.
create or replace function public.apply_payment_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_change jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind text := p_change ->> 'kind';
  v_outcome text;
  v_user uuid;
  v_project uuid;
  v_ref uuid;
  v_sub public.subscriptions%rowtype;
  v_sub_id uuid;
  v_payment uuid;
  v_status text;
  v_credit boolean := jsonb_typeof(p_change -> 'credit') = 'object';
begin
  if p_provider is null or p_event_id is null or p_event_type is null or p_occurred_at is null then
    raise exception 'apply_payment_event: missing event fields' using errcode = '22023';
  end if;

  -- One event at a time per id, so two deliveries of the same event cannot both apply.
  perform pg_advisory_xact_lock(hashtextextended('apply_payment_event:' || p_provider || ':' || p_event_id, 0));
  if exists (
    select 1 from public.payment_events where provider = p_provider and event_id = p_event_id
  ) then
    return 'duplicate';
  end if;

  if v_kind = 'ignore' then
    v_outcome := 'ignored';

  elsif v_kind = 'subscription' then
    select * into v_sub from public.subscriptions where provider_ref = p_change ->> 'provider_ref' for update;
    if found then
      if v_sub.provider_event_at is not null and v_sub.provider_event_at > p_occurred_at then
        v_outcome := 'stale';
      else
        update public.subscriptions set
          plan_id = p_change ->> 'plan_id',
          status = p_change ->> 'status',
          starts_at = (p_change ->> 'starts_at')::timestamptz,
          ends_at = (p_change ->> 'ends_at')::timestamptz,
          provider_customer_id = coalesce(p_change ->> 'customer_id', provider_customer_id),
          provider_event_at = p_occurred_at,
          updated_at = now()
        where id = v_sub.id;
        v_outcome := 'applied';
      end if;
    else
      select user_id, project_id into v_user, v_project from public.checkout_refs
      where ref = (nullif(p_change ->> 'checkout_ref', ''))::uuid;
      if v_user is null then
        v_outcome := 'unmatched';
      else
        insert into public.subscriptions (
          user_id, project_id, plan_id, source, status, starts_at, ends_at, provider_ref, provider_customer_id,
          provider_event_at
        )
        values (
          v_user, v_project, p_change ->> 'plan_id', p_provider, p_change ->> 'status',
          (p_change ->> 'starts_at')::timestamptz, (p_change ->> 'ends_at')::timestamptz,
          p_change ->> 'provider_ref', p_change ->> 'customer_id', p_occurred_at
        )
        returning id into v_sub_id;
        -- A payment that arrived before its subscription is linked now.
        update public.payments set subscription_id = v_sub_id, updated_at = now()
        where provider_ref = p_change ->> 'provider_ref' and subscription_id is null;
        v_outcome := 'applied';
      end if;
    end if;

  elsif v_kind = 'payment' then
    -- provider_ref names the subscription; for a one-time purchase it is the transaction id, and
    -- "grant" carries the period that purchase gives (plan_id, starts_at, ends_at), or "credit"
    -- the mentor messages a pack adds (messages).
    select id, user_id into v_sub_id, v_user from public.subscriptions
    where provider_ref = p_change ->> 'provider_ref';
    if v_user is null then
      select user_id, project_id, ref into v_user, v_project, v_ref from public.checkout_refs
      where ref = (nullif(p_change ->> 'checkout_ref', ''))::uuid;
    end if;
    -- A credit is for a project: without the checkout's project nothing is written.
    if v_user is null or (v_credit and v_project is null) then
      v_outcome := 'unmatched';
    else
      if v_sub_id is null and jsonb_typeof(p_change -> 'grant') = 'object' then
        insert into public.subscriptions (
          user_id, project_id, plan_id, source, status, starts_at, ends_at, provider_ref,
          provider_customer_id, provider_event_at
        )
        values (
          v_user, v_project, p_change #>> '{grant,plan_id}', p_provider, 'active',
          (p_change #>> '{grant,starts_at}')::timestamptz, (p_change #>> '{grant,ends_at}')::timestamptz,
          p_change ->> 'provider_ref', p_change ->> 'customer_id', p_occurred_at
        )
        returning id into v_sub_id;
      end if;
      insert into public.payments (
        user_id, subscription_id, provider, provider_transaction_id, provider_ref, amount_minor,
        currency, status, occurred_at
      )
      values (
        v_user, v_sub_id, p_provider, p_change ->> 'transaction_id', p_change ->> 'provider_ref',
        (p_change ->> 'amount_minor')::bigint, p_change ->> 'currency', 'completed', p_occurred_at
      )
      on conflict (provider_transaction_id) do update
        set subscription_id = coalesce(public.payments.subscription_id, excluded.subscription_id),
            updated_at = now()
      returning id into v_payment;
      if v_credit then
        insert into public.mentor_credits (user_id, project_id, messages, source, payment_id, checkout_ref)
        values (
          v_user, v_project, (p_change #>> '{credit,messages}')::integer, p_provider, v_payment, v_ref
        )
        on conflict (payment_id) do nothing;
      end if;
      v_outcome := 'applied';
    end if;

  elsif v_kind = 'payment_status' then
    v_status := p_change ->> 'status';
    if v_status is null or v_status not in ('refunded', 'partially_refunded', 'chargeback') then
      raise exception 'apply_payment_event: unknown payment status %', v_status using errcode = '22023';
    end if;
    update public.payments set status = v_status, updated_at = now()
    where provider_transaction_id = p_change ->> 'transaction_id'
    returning id, subscription_id into v_payment, v_sub_id;
    if not found then
      v_outcome := 'unmatched';
    else
      -- A full refund or a chargeback ends the access that payment bought, and revokes the mentor
      -- credit it bought; a partial refund does neither.
      if v_status in ('refunded', 'chargeback') then
        if v_sub_id is not null then
          update public.subscriptions set
            status = 'ended',
            ends_at = greatest(starts_at + interval '1 second', least(coalesce(ends_at, now()), now())),
            updated_at = now()
          where id = v_sub_id;
        end if;
        update public.mentor_credits set revoked_at = now()
        where payment_id = v_payment and revoked_at is null;
      end if;
      v_outcome := 'applied';
    end if;

  else
    raise exception 'apply_payment_event: unknown change kind %', coalesce(v_kind, 'null') using errcode = '22023';
  end if;

  insert into public.payment_events (provider, event_id, event_type, occurred_at, outcome)
  values (p_provider, p_event_id, p_event_type, p_occurred_at, v_outcome);
  return v_outcome;
end;
$$;
