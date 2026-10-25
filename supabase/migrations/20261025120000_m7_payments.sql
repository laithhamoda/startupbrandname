-- M7 step 1: the payment data (docs/M7-PLAN.md, D-309).
--
-- Paddle sells as merchant of record, so Paddle keeps the tax and accounting records of every
-- sale. What we keep is what access needs: the prices that are on sale (billing_products), the
-- access a purchase or a voucher gives (subscriptions), the payments behind it (payments), the
-- provider events already applied (payment_events, for idempotency), and the reference a checkout
-- carries to Paddle instead of the user id, with the age confirmation made before it
-- (checkout_refs, D-086). A purchase may be bound to one project (pay per project, D-312): the
-- checkout names it and the access it gives carries it; a purchase without a project covers the
-- account. Everything that names a user is deleted with the account, and a project's purchase with
-- the project: Paddle, not us, holds the records a tax authority may ask for.
--
-- Users read their own subscriptions and payments. Nobody writes them from the client: the
-- webhook writes through apply_payment_event(), which only the service role may run, and the
-- client starts a checkout through start_checkout().
--
-- Expand only: new tables, new functions, a new settings key.

-- ---------------------------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------------------------

-- The checkouts one user may start per UTC day: enough for retries, too few to flood the table.
insert into public.settings (key, value) values ('payments.checkouts_per_day', '20')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Billing products
-- ---------------------------------------------------------------------------------------------

-- Which provider price sells which plan. The plan table in the app (config/plans.ts) owns the
-- amount, the billing and the entitlements; this table only links a plan to the provider's price,
-- so no amount is stored twice.
create table public.billing_products (
  provider text not null check (provider in ('paddle')),
  plan_id text not null check (plan_id ~ '^[a-z][a-z0-9_]{0,39}$'),
  provider_price_id text not null unique check (char_length(provider_price_id) between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (provider, plan_id)
);

comment on table public.billing_products is
  'Links a plan of config/plans.ts to the provider price that sells it (D-309). Amounts live in the plan table only. Written by migrations or the admin.';

alter table public.billing_products enable row level security;

revoke all on table public.billing_products from anon, authenticated;
grant select on table public.billing_products to anon, authenticated;

-- Price ids are public: the checkout script in the browser needs them.
create policy "billing_products: everyone reads the active ones" on public.billing_products
  for select to anon, authenticated
  using (active);

-- ---------------------------------------------------------------------------------------------
-- Checkout references
-- ---------------------------------------------------------------------------------------------

create table public.checkout_refs (
  -- Sent to the provider as custom data in place of the user id (rule 5 in spirit: the provider
  -- learns the buyer's email from the checkout, never our ids).
  ref uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null check (plan_id ~ '^[a-z][a-z0-9_]{0,39}$'),
  -- The project the purchase is for; null when it covers the account.
  project_id uuid references public.projects (id) on delete cascade,
  -- The buyer confirmed being 18 or older just before this checkout (D-086).
  adult_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- A checkout must be started before this time; a payment made with it is applied even later.
  expires_at timestamptz not null default now() + interval '1 day'
);

comment on table public.checkout_refs is
  'One row per checkout a user started: the opaque reference sent to the provider, the plan, and the time the buyer confirmed being 18 or older (D-086, D-309). Written by start_checkout(); deleted with the account.';

create index checkout_refs_user_created_idx on public.checkout_refs (user_id, created_at desc);
create index checkout_refs_project_idx on public.checkout_refs (project_id) where project_id is not null;

alter table public.checkout_refs enable row level security;

revoke all on table public.checkout_refs from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------------------------

-- One row per period of paid or granted access. A one-time purchase (weekly, annual) is a row with
-- an end; a recurring plan has no end until it is cancelled or ends. A voucher (step 6) and an
-- admin grant (step 8) are rows of their own source.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null check (plan_id ~ '^[a-z][a-z0-9_]{0,39}$'),
  -- The project this access is for (pay per project, D-312); null when it covers the account.
  project_id uuid references public.projects (id) on delete cascade,
  source text not null check (source in ('paddle', 'voucher', 'admin')),
  status text not null check (status in ('active', 'past_due', 'canceled', 'ended')),
  starts_at timestamptz not null,
  -- Null while a recurring plan renews; access ends at this time otherwise.
  ends_at timestamptz,
  -- The provider's subscription id, or its transaction id for a one-time purchase.
  provider_ref text unique check (char_length(provider_ref) between 1 and 100),
  provider_customer_id text check (char_length(provider_customer_id) between 1 and 100),
  -- When the provider event last applied to this row happened: an older event never overwrites it.
  provider_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_provider_ref_by_source check ((source = 'paddle') = (provider_ref is not null)),
  constraint subscriptions_period check (ends_at is null or ends_at > starts_at)
);

comment on table public.subscriptions is
  'Paid or granted access: plan, source (paddle, voucher, admin), status and period (D-309). Paddle rows are written only by apply_payment_event(); deleted with the account.';

create index subscriptions_user_idx on public.subscriptions (user_id, starts_at desc);
create index subscriptions_project_idx on public.subscriptions (project_id) where project_id is not null;

alter table public.subscriptions enable row level security;

revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscriptions to authenticated;

create policy "subscriptions: owner reads" on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete cascade,
  provider text not null check (provider in ('paddle')),
  provider_transaction_id text not null unique check (char_length(provider_transaction_id) between 1 and 100),
  -- The provider ref of the subscription this payment belongs to (its own transaction id for a
  -- one-time purchase), so a payment that arrives before its subscription is linked later.
  provider_ref text check (char_length(provider_ref) between 1 and 100),
  -- The total the buyer paid, in US cents, tax included (all charges are USD, CLAUDE.md §3).
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency = 'USD'),
  status text not null check (status in ('completed', 'refunded', 'partially_refunded', 'chargeback')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payments is
  'One row per completed provider transaction and its later refund or chargeback (D-309). Written only by apply_payment_event(); deleted with the account, as the merchant of record keeps the accounting records.';

create index payments_user_idx on public.payments (user_id, occurred_at desc);
create index payments_subscription_idx on public.payments (subscription_id);

alter table public.payments enable row level security;

revoke all on table public.payments from anon, authenticated;
grant select on table public.payments to authenticated;

create policy "payments: owner reads" on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Payment events
-- ---------------------------------------------------------------------------------------------

-- Every provider event received once, so a retried or replayed webhook changes nothing. No payload
-- and no user is kept: the event id, its type, when it happened and what applying it did.
create table public.payment_events (
  provider text not null check (provider in ('paddle')),
  event_id text not null check (char_length(event_id) between 1 and 100),
  event_type text not null check (char_length(event_type) between 1 and 100),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  outcome text not null check (outcome in ('applied', 'stale', 'ignored', 'unmatched')),
  primary key (provider, event_id)
);

comment on table public.payment_events is
  'Provider events already applied, for idempotency, with what applying each one did (D-309). Holds no user or payload. Written only by apply_payment_event().';

alter table public.payment_events enable row level security;

revoke all on table public.payment_events from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Starting a checkout
-- ---------------------------------------------------------------------------------------------

-- Starts a checkout for the signed-in user and returns its reference. The user must have finished
-- onboarding, must confirm being 18 or older (D-086), and the plan must be on sale. A project, when
-- given, must be the user's own (pay per project, D-312). A user starts
-- at most payments.checkouts_per_day checkouts per UTC day; a missing or non-positive setting
-- closes the door.
create function public.start_checkout(
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
  if not exists (
    select 1 from public.billing_products where plan_id = p_plan_id and active
  ) then
    raise exception 'start_checkout: the plan is not on sale' using errcode = '22023';
  end if;
  if p_project_id is not null and not exists (
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

comment on function public.start_checkout(text, uuid, boolean) is
  'Starts a checkout for the signed-in user after the 18+ confirmation (D-086) and returns the reference sent to the provider (D-309).';

revoke all on function public.start_checkout(text, uuid, boolean) from public, anon;
grant execute on function public.start_checkout(text, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Applying a provider event
-- ---------------------------------------------------------------------------------------------

-- Applies one verified provider event, once, and returns what it did:
--   'applied'   the change was made;
--   'stale'     a newer event already set this subscription, so nothing changed;
--   'ignored'   the event carries no change we keep;
--   'unmatched' no account could be found for it (logged for the admin, never retried);
--   'duplicate' the event was applied before (nothing is written).
-- The webhook verifies the signature and turns the provider's payload into p_change (packages/
-- payments): {"kind": "ignore"}; {"kind": "subscription", ...} for access; {"kind": "payment",
-- ...} for a completed transaction, with "grant" when it is a one-time purchase that gives a
-- period of access; {"kind": "payment_status", ...} for a refund or chargeback,
-- which also ends the access that payment bought. The account is found from the subscription the
-- provider ref already names, or else from the checkout reference.
create function public.apply_payment_event(
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
  v_sub public.subscriptions%rowtype;
  v_sub_id uuid;
  v_status text;
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
    -- "grant" carries the period that purchase gives (plan_id, starts_at, ends_at).
    select id, user_id into v_sub_id, v_user from public.subscriptions
    where provider_ref = p_change ->> 'provider_ref';
    if v_user is null then
      select user_id, project_id into v_user, v_project from public.checkout_refs
      where ref = (nullif(p_change ->> 'checkout_ref', ''))::uuid;
    end if;
    if v_user is null then
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
            updated_at = now();
      v_outcome := 'applied';
    end if;

  elsif v_kind = 'payment_status' then
    v_status := p_change ->> 'status';
    if v_status is null or v_status not in ('refunded', 'partially_refunded', 'chargeback') then
      raise exception 'apply_payment_event: unknown payment status %', v_status using errcode = '22023';
    end if;
    update public.payments set status = v_status, updated_at = now()
    where provider_transaction_id = p_change ->> 'transaction_id'
    returning subscription_id into v_sub_id;
    if not found then
      v_outcome := 'unmatched';
    else
      -- A full refund or a chargeback ends the access that payment bought; a partial refund does not.
      if v_status in ('refunded', 'chargeback') and v_sub_id is not null then
        update public.subscriptions set
          status = 'ended',
          ends_at = greatest(starts_at + interval '1 second', least(coalesce(ends_at, now()), now())),
          updated_at = now()
        where id = v_sub_id;
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

comment on function public.apply_payment_event(text, text, text, timestamptz, jsonb) is
  'Applies one verified provider event once (idempotent by event id, older events never overwrite newer state) and returns applied, stale, ignored, unmatched or duplicate (D-309). Service role only.';

revoke all on function public.apply_payment_event(text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, timestamptz, jsonb) to service_role;
