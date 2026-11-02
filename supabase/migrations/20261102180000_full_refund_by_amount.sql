-- A refund of the whole payment is a full refund, whatever type the provider names (D-330).
--
-- Paddle sent "type": "partial" for an approved refund of the full 10.00 USD when the refund
-- names the transaction's items, so the access it bought stayed active. The webhook now passes
-- "refunded_minor" (the adjustment's total, in cents) and a partial refund that covers the whole
-- payment is applied as a full one. The rest of the function is as in 20261027053000_mentor_pack.sql.

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
    -- A refund that covers the whole payment is a full refund, whatever type the provider names.
    if v_status = 'partially_refunded' and (p_change ->> 'refunded_minor') is not null
       and (p_change ->> 'refunded_minor')::bigint >= coalesce((
         select amount_minor from public.payments
         where provider_transaction_id = p_change ->> 'transaction_id'
       ), 9223372036854775807) then
      v_status := 'refunded';
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
