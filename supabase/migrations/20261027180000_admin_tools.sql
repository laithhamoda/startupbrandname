-- M7 step 8, part 2: the admin tools (docs/M7-PLAN.md, D-328).
--
-- Every function starts with private.require_admin() (an admin at aal2, D-327) and writes one row
-- of the audit log in the same transaction. They are the only way the admin area reads or writes
-- vouchers, affiliates, subscriptions and payments: the tables stay closed to the client. The lists
-- that show an account's email write a "view" row too, so reading personal data is answerable.
--
-- Expand only: new functions.

-- ---------------------------------------------------------------------------------------------
-- Vouchers and affiliates
-- ---------------------------------------------------------------------------------------------

create function public.admin_voucher_types()
returns table (type text, plan_id text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query select t.type, t.plan_id from public.voucher_types t order by t.type;
end;
$$;

-- Issues a batch and returns its codes, once, for the admin to copy. The log keeps the type, the
-- count and the affiliate, never a code.
create function public.admin_issue_batch(
  p_type text,
  p_count integer,
  p_affiliate uuid default null,
  p_note text default null
)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_made integer := 0;
begin
  perform private.require_admin();
  for v_code in select public.issue_voucher_batch(p_type, p_count, p_affiliate, p_note) loop
    v_made := v_made + 1;
    return next v_code;
  end loop;
  perform private.write_audit(
    'admin.issue_batch', 'voucher_batch', null,
    jsonb_build_object('type', p_type, 'count', v_made, 'affiliate', p_affiliate)
  );
end;
$$;

create function public.admin_create_affiliate(
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
  perform private.require_admin();
  v_id := public.create_affiliate(p_name, p_amount_usd_cents, p_user);
  perform private.write_audit(
    'admin.create_affiliate', 'affiliate', v_id::text,
    jsonb_build_object('amount_usd_cents', p_amount_usd_cents)
  );
  return v_id;
end;
$$;

-- One line per affiliate: codes issued and activated, and the commission due and paid, in US cents.
create function public.admin_affiliates()
returns table (
  id uuid,
  name text,
  active boolean,
  amount_usd_cents integer,
  issued bigint,
  activated bigint,
  due_usd_cents bigint,
  paid_usd_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select
    a.id,
    a.name,
    a.active,
    (a.commission_rule ->> 'amount_usd_cents')::integer,
    (select count(*) from public.vouchers v join public.voucher_batches b on b.id = v.batch_id
      where b.affiliate_id = a.id),
    (select count(*) from public.vouchers v join public.voucher_batches b on b.id = v.batch_id
      where b.affiliate_id = a.id and v.status = 'activated'),
    coalesce((select sum(c.amount_usd_cents) from public.commissions c
      where c.affiliate_id = a.id and c.status = 'due'), 0),
    coalesce((select sum(c.amount_usd_cents) from public.commissions c
      where c.affiliate_id = a.id and c.status = 'paid'), 0)
  from public.affiliates a
  order by a.created_at;
end;
$$;

-- The commissions of an affiliate are paid outside the platform in one transfer; this marks every
-- one that is due as paid and answers how many it was.
create function public.admin_pay_commissions(p_affiliate uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_total bigint;
begin
  perform private.require_admin();
  with paid as (
    update public.commissions
    set status = 'paid', paid_at = now()
    where affiliate_id = p_affiliate and status = 'due'
    returning amount_usd_cents
  )
  select count(*), coalesce(sum(amount_usd_cents), 0) into v_count, v_total from paid;
  perform private.write_audit(
    'admin.pay_commissions', 'affiliate', p_affiliate::text,
    jsonb_build_object('count', v_count, 'total_usd_cents', v_total)
  );
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Subscriptions and payments
-- ---------------------------------------------------------------------------------------------

create function public.admin_subscriptions(p_limit integer default 100)
returns table (
  id uuid,
  email text,
  plan_id text,
  project_id uuid,
  source text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  perform private.write_audit('admin.view_subscriptions', null, null, jsonb_build_object('limit', v_limit));
  return query
  select s.id, u.email::text, s.plan_id, s.project_id, s.source, s.status, s.starts_at, s.ends_at
  from public.subscriptions s
  join auth.users u on u.id = s.user_id
  order by s.starts_at desc
  limit v_limit;
end;
$$;

create function public.admin_payments(p_limit integer default 100)
returns table (
  id uuid,
  email text,
  amount_minor bigint,
  status text,
  occurred_at timestamptz,
  provider_transaction_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  perform private.write_audit('admin.view_payments', null, null, jsonb_build_object('limit', v_limit));
  return query
  select p.id, u.email::text, p.amount_minor, p.status, p.occurred_at, p.provider_transaction_id
  from public.payments p
  join auth.users u on u.id = p.user_id
  order by p.occurred_at desc
  limit v_limit;
end;
$$;

-- Gives an account access by hand (support, a promise, a failed webhook). A package is for one
-- project of that account; only the course plan covers the whole account (D-319, D-320).
create function public.admin_grant_subscription(
  p_email text,
  p_plan_id text,
  p_days integer,
  p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_id uuid;
begin
  perform private.require_admin();
  if p_plan_id is null or p_plan_id <> all (array['strategist', 'commander', 'course']) then
    raise exception 'admin_grant_subscription: unknown plan' using errcode = '22023';
  end if;
  if p_days is null or p_days not between 1 and 730 then
    raise exception 'admin_grant_subscription: days must be between 1 and 730' using errcode = '22023';
  end if;
  if (p_plan_id = 'course') <> (p_project_id is null) then
    raise exception 'admin_grant_subscription: a package needs a project, the course plan none'
      using errcode = '22023';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(p_email);
  if v_user is null then
    raise exception 'admin_grant_subscription: no such account' using errcode = '22023';
  end if;
  if p_project_id is not null
     and not exists (select 1 from public.projects where id = p_project_id and user_id = v_user) then
    raise exception 'admin_grant_subscription: the project is not this account''s' using errcode = '22023';
  end if;

  insert into public.subscriptions (user_id, plan_id, project_id, source, status, starts_at, ends_at)
  values (v_user, p_plan_id, p_project_id, 'admin', 'active', now(), now() + make_interval(days => p_days))
  returning id into v_id;
  perform private.write_audit(
    'admin.grant_subscription', 'subscription', v_id::text,
    jsonb_build_object('plan', p_plan_id, 'days', p_days, 'project', p_project_id, 'user', v_user)
  );
  return v_id;
end;
$$;

-- Ends an access given by hand or by a voucher, now. A paid one ends with its refund in Paddle.
create function public.admin_end_subscription(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text;
begin
  perform private.require_admin();
  select source into v_source from public.subscriptions where id = p_id for update;
  if v_source is null then
    raise exception 'admin_end_subscription: no such subscription' using errcode = '22023';
  end if;
  if v_source = 'paddle' then
    raise exception 'admin_end_subscription: a paid subscription ends with its refund in Paddle'
      using errcode = '22023';
  end if;
  update public.subscriptions
  set status = 'ended', ends_at = greatest(now(), starts_at + interval '1 second'), updated_at = now()
  where id = p_id;
  perform private.write_audit(
    'admin.end_subscription', 'subscription', p_id::text, jsonb_build_object('source', v_source)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Who may call them: the signed-in; require_admin() is the wall
-- ---------------------------------------------------------------------------------------------

revoke all on function public.admin_voucher_types() from public, anon;
revoke all on function public.admin_issue_batch(text, integer, uuid, text) from public, anon;
revoke all on function public.admin_create_affiliate(text, integer, uuid) from public, anon;
revoke all on function public.admin_affiliates() from public, anon;
revoke all on function public.admin_pay_commissions(uuid) from public, anon;
revoke all on function public.admin_subscriptions(integer) from public, anon;
revoke all on function public.admin_payments(integer) from public, anon;
revoke all on function public.admin_grant_subscription(text, text, integer, uuid) from public, anon;
revoke all on function public.admin_end_subscription(uuid) from public, anon;

grant execute on function public.admin_voucher_types() to authenticated;
grant execute on function public.admin_issue_batch(text, integer, uuid, text) to authenticated;
grant execute on function public.admin_create_affiliate(text, integer, uuid) to authenticated;
grant execute on function public.admin_affiliates() to authenticated;
grant execute on function public.admin_pay_commissions(uuid) to authenticated;
grant execute on function public.admin_subscriptions(integer) to authenticated;
grant execute on function public.admin_payments(integer) to authenticated;
grant execute on function public.admin_grant_subscription(text, text, integer, uuid) to authenticated;
grant execute on function public.admin_end_subscription(uuid) to authenticated;
