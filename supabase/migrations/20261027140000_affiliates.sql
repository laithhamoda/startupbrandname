-- M7 step 7: affiliates and their commissions (docs/M7-PLAN.md, CLAUDE.md §3, D-326).
--
-- An affiliate owns voucher batches. When a code of such a batch is activated, a commission of the
-- affiliate's fixed amount is recorded, once per code and in the same transaction as the
-- activation; issuing a code records nothing. The commission is only a record: it is paid outside
-- the platform and marked paid by the admin (step 8). A commission still due is voided when the
-- activation is undone: the code revoked, or the account deleted. The affiliate reads their own
-- row and commissions, never a user or a project (rule 6).
--
-- Expand only: new tables and functions; activate_voucher() keeps its signature and only gains the
-- commission; voucher_batches.affiliate_id, which exists, now references affiliates.

-- ---------------------------------------------------------------------------------------------
-- Affiliates
-- ---------------------------------------------------------------------------------------------

-- The rule is exactly {"kind": "fixed_per_activation", "amount_usd_cents": n}: a fixed amount in
-- US cents for each activated code (open question #13; the course codes cost the user nothing, so
-- there is no sale to take a share of).
create function private.valid_commission_rule(p_rule jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_rule) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(p_rule) as k)
      = array['amount_usd_cents', 'kind']
    and p_rule ->> 'kind' = 'fixed_per_activation'
    and jsonb_typeof(p_rule -> 'amount_usd_cents') = 'number'
    and (p_rule ->> 'amount_usd_cents') ~ '^[1-9][0-9]{0,5}$';
$$;

revoke all on function private.valid_commission_rule(jsonb) from public, anon, authenticated;

create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  -- The account that sees the affiliate dashboard; null until the affiliate has one.
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  commission_rule jsonb not null check (private.valid_commission_rule(commission_rule)),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.affiliates is
  'Who earns a commission when a code of their batches is activated, and the rule (D-326). Written only by create_affiliate() and the admin (step 8).';

alter table public.voucher_batches
  add constraint voucher_batches_affiliate_id_fkey
  foreign key (affiliate_id) references public.affiliates (id);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id),
  -- One commission per code, so an activation can never pay twice.
  voucher_code text not null unique references public.vouchers (code),
  amount_usd_cents integer not null check (amount_usd_cents between 1 and 999999),
  status text not null default 'due' check (status in ('due', 'paid', 'void')),
  activated_at timestamptz not null,
  paid_at timestamptz,
  voided_at timestamptz,
  constraint commissions_paid check ((status = 'paid') = (paid_at is not null)),
  constraint commissions_voided check ((status = 'void') = (voided_at is not null))
);

comment on table public.commissions is
  'One row per activated code of an affiliate batch: the amount at activation, due until paid outside the platform, void if the activation is undone (D-326).';

create index commissions_affiliate_idx on public.commissions (affiliate_id, activated_at desc);

alter table public.affiliates enable row level security;
alter table public.commissions enable row level security;
revoke all on table public.affiliates, public.commissions from anon, authenticated;
grant select on table public.affiliates, public.commissions to authenticated;

create policy "affiliates: own row" on public.affiliates
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "commissions: own affiliate" on public.commissions
  for select to authenticated
  using (affiliate_id in (select id from public.affiliates where user_id = (select auth.uid())));

-- Adds an affiliate; used by scripts/add-affiliate.mjs until the admin area (step 8).
create function public.create_affiliate(
  p_name text,
  p_amount_usd_cents integer,
  p_user uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.affiliates (name, user_id, commission_rule)
  values (
    p_name, p_user,
    jsonb_build_object('kind', 'fixed_per_activation', 'amount_usd_cents', p_amount_usd_cents)
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_affiliate(text, integer, uuid) from public, anon, authenticated;
grant execute on function public.create_affiliate(text, integer, uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- A commission follows its activation
-- ---------------------------------------------------------------------------------------------

-- A code revoked after activation, or an account deleted (activated_by is cleared), voids the
-- commission that is still due. A commission already paid stays paid: that is settled outside.
create function private.void_commission_on_undo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'activated'
     and (new.status = 'revoked' or (old.activated_by is not null and new.activated_by is null)) then
    update public.commissions
    set status = 'void', voided_at = now()
    where voucher_code = new.code and status = 'due';
  end if;
  return new;
end;
$$;

revoke all on function private.void_commission_on_undo() from public, anon, authenticated;

create trigger vouchers_void_commission
  after update of status, activated_by on public.vouchers
  for each row execute function private.void_commission_on_undo();

-- ---------------------------------------------------------------------------------------------
-- Activation records the commission
-- ---------------------------------------------------------------------------------------------

-- The body of step 6 (20261027120000_vouchers.sql) plus the commission block before the end.
create or replace function public.activate_voucher(
  p_user uuid,
  p_ip_hash text,
  p_code text,
  p_adult_confirmed boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_lock interval;
  v_code text;
  v_voucher public.vouchers;
  v_type public.voucher_types;
  v_subscription uuid;
  v_affiliate uuid;
  v_amount integer;
begin
  if p_user is null or p_ip_hash is null then
    raise exception 'activate_voucher: user and network are required' using errcode = '22023';
  end if;
  if p_adult_confirmed is distinct from true then
    raise exception 'activate_voucher: the buyer must confirm being 18 or older' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where user_id = p_user) then
    raise exception 'activate_voucher: onboarding is not complete' using errcode = '42501';
  end if;

  select coalesce((select (value #>> '{}')::integer from public.settings where key = 'vouchers.max_failures'), 5)
    into v_max;
  select make_interval(mins => coalesce(
    (select (value #>> '{}')::integer from public.settings where key = 'vouchers.lock_minutes'), 15))
    into v_lock;

  -- One activation of an account at a time, so parallel guesses cannot slip under the count.
  perform pg_advisory_xact_lock(hashtextextended('voucher:' || p_user::text, 0));

  if (select count(*) from public.voucher_attempts
        where user_id = p_user and not ok and at > now() - v_lock) >= v_max
     or (select count(*) from public.voucher_attempts
           where ip_hash = p_ip_hash and not ok and at > now() - v_lock) >= v_max then
    return 'locked';
  end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));

  if v_code ~ '^VIVA[0-9A-F]{8}$' then
    select * into v_voucher from public.vouchers where code = v_code for update;
  end if;

  if v_voucher.code is null
     or v_voucher.status <> 'issued'
     or v_voucher.expires_at <= now() then
    insert into public.voucher_attempts (user_id, ip_hash, ok) values (p_user, p_ip_hash, false);
    return 'invalid';
  end if;

  select * into v_type from public.voucher_types where type = v_voucher.type;

  if exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user
      and s.source = 'voucher'
      and s.plan_id = v_type.plan_id
      and s.project_id is null
      and s.status = 'active'
      and (s.ends_at is null or s.ends_at > now())
  ) then
    return 'in_use';
  end if;

  insert into public.subscriptions (user_id, plan_id, source, status, starts_at, ends_at)
  values (p_user, v_type.plan_id, 'voucher', 'active', now(), now() + v_type.access_interval)
  returning id into v_subscription;

  update public.vouchers
  set status = 'activated',
      activated_by = p_user,
      activated_at = now(),
      adult_confirmed_at = now(),
      subscription_id = v_subscription
  where code = v_voucher.code;

  insert into public.voucher_attempts (user_id, ip_hash, ok) values (p_user, p_ip_hash, true);

  -- The affiliate's commission is recorded here, on activation, never on issue (CLAUDE.md §3).
  select a.id, (a.commission_rule ->> 'amount_usd_cents')::integer
    into v_affiliate, v_amount
  from public.voucher_batches b
  join public.affiliates a on a.id = b.affiliate_id and a.active
  where b.id = v_voucher.batch_id;
  if v_affiliate is not null then
    insert into public.commissions (affiliate_id, voucher_code, amount_usd_cents, activated_at)
    values (v_affiliate, v_voucher.code, v_amount, now());
  end if;

  return 'activated';
end;
$$;
