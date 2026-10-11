-- M5 step 1: the data the canvases, the report and the PDF stand on (docs/M5-PLAN.md, D-225,
-- D-233, D-234, D-238, D-243 to D-245).
--
-- Reference data: tax_rules (the contract of the engine's TaxRule, one row per rule) and
-- country_pack_items (dated, sourced country facts, CLAUDE.md rules 8 and 9). Both are read by
-- signed-in users and written only by migrations or the admin (M7, M8); they hold no seed data
-- until step 4. Stored reports: the reports table and a private bucket for the PDFs. A recorder
-- for engine runs (tool_runs rows without a model). The daily PDF limit as a settings row.
--
-- Expand only: new tables, new functions, a new settings key, and one partial unique index on
-- tool_runs that no existing row can violate (the model runs have no engine_version).

-- ---------------------------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------------------------

-- The PDFs one user may make per UTC day (D-234). Step 6 counts them in usage_counters.
insert into public.settings (key, value) values ('report.pdf_per_day', '10')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Tax rules
-- ---------------------------------------------------------------------------------------------

-- Whether brackets is a well-formed list of marginal tax brackets, as the engine reads it
-- (validateTaxRule, D-216): an empty list, or objects with exactly "up_to" and "rate", where
-- up_to is a whole number of minor units as text, rising from one bracket to the next, except
-- the last, whose up_to is null (no limit), and rate is an exact fraction "n/d" of two whole
-- numbers with d above 0 (D-243; the code that reads a row builds the engine's Rate from the two
-- integers with makeRate, as no engine function parses this text). Nothing else is stored.
create function private.tax_brackets_valid(p_brackets jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_brackets) is distinct from 'array' then false
    when p_brackets = '[]'::jsonb then true
    when exists (
      select 1 from jsonb_array_elements(p_brackets) as e (item)
      where jsonb_typeof(e.item) is distinct from 'object'
    ) then false
    else (
      select coalesce(bool_and(
        b.key_count = 2
        and b.item ? 'up_to'
        and jsonb_typeof(b.item -> 'rate') = 'string'
        and b.item ->> 'rate' ~ '^[0-9]{1,30}/[1-9][0-9]{0,29}$'
        and case
          when b.pos = b.total then b.item -> 'up_to' = 'null'::jsonb
          else jsonb_typeof(b.item -> 'up_to') = 'string'
            and b.up_to is not null
            and b.up_to > coalesce(b.previous_up_to, 0)
        end
      ), false)
      from (
        select
          a.pos, a.item, a.key_count, a.total, a.up_to,
          lag(a.up_to) over (order by a.pos) as previous_up_to
        from (
          select
            e.pos,
            e.item,
            (select count(*) from jsonb_object_keys(e.item)) as key_count,
            count(*) over () as total,
            case
              when e.item ->> 'up_to' ~ '^[0-9]{1,18}$' then (e.item ->> 'up_to')::bigint
            end as up_to
          from jsonb_array_elements(p_brackets) with ordinality as e (item, pos)
        ) as a
      ) as b
    )
  end;
$$;

comment on function private.tax_brackets_valid(jsonb) is
  'True when the argument is a well-formed list of tax brackets: rising up_to as minor-unit text, the last null, rate as n/d. Used by a check constraint on tax_rules.';

create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  -- ISO 3166-1 alpha-2.
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  legal_form text not null check (legal_form in ('sole', 'company')),
  -- The regime, and what is paid under it; a newer rule of the same levy replaces an older one.
  regime text not null check (char_length(btrim(regime)) between 1 and 80),
  levy text not null check (char_length(btrim(levy)) between 1 and 80),
  -- A tax proper, or a social contribution (CASNOS, social security): the same shape (D-186).
  kind text not null check (kind in ('tax', 'social_contribution')),
  -- What the levy is charged on: the year's turnover, its profit, or a fixed amount.
  basis text not null check (basis in ('turnover', 'profit', 'fixed')),
  -- A flat rate as an exact fraction "n/d", not a percentage and not a float: "1/20" is 5%.
  rate text check (rate is null or rate ~ '^[0-9]{1,30}/[1-9][0-9]{0,29}$'),
  -- Marginal brackets, [{"up_to": "1500000", "rate": "1/10"}, {"up_to": null, "rate": "1/5"}].
  brackets jsonb not null default '[]'::jsonb check (private.tax_brackets_valid(brackets)),
  -- Amounts are whole minor units of currency (fils, centimes), never negative.
  fixed_amount bigint check (fixed_amount is null or fixed_amount >= 0),
  min_amount bigint check (min_amount is null or min_amount >= 0),
  ceiling bigint check (ceiling is null or ceiling >= 0),
  -- ISO 4217: the currency of the amounts above and of the brackets.
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- The month of the projection year after the one the tax accrues in, in which it is paid.
  payment_month integer not null check (payment_month between 1 and 12),
  -- The rule applies to a run made on or after this date.
  effective_from date not null,
  -- The official page the rule was read on (D-233); never a summary or a forum.
  source_url text not null check (
    char_length(source_url) <= 2048
    and source_url ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#]\S*)?$'
  ),
  last_verified date,
  status text not null check (status in ('verified', 'unverified', 'under_review', 'stale')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_rules_verified_has_date check (status <> 'verified' or last_verified is not null),
  -- A fixed basis has only its amount; any other basis has no amount and exactly one of a rate
  -- and brackets (validateTaxRule).
  constraint tax_rules_basis_shape check (
    (
      basis = 'fixed'
      and fixed_amount is not null
      and rate is null
      and brackets = '[]'::jsonb
    )
    or (
      basis <> 'fixed'
      and fixed_amount is null
      and ((rate is null) <> (brackets = '[]'::jsonb))
    )
  ),
  constraint tax_rules_one_per_date unique (country_code, legal_form, regime, levy, effective_from)
);

comment on table public.tax_rules is
  'Tax and social-contribution rules, one row per rule, in the shape of the engine''s TaxRule (D-216, D-243). Reference data: read by signed-in users, written by migrations and the admin only. A row exists only when its rule was read on an official page (D-233).';

alter table public.tax_rules enable row level security;

revoke all on table public.tax_rules from anon, authenticated;
grant select on table public.tax_rules to authenticated;

create policy "tax_rules: signed-in users read" on public.tax_rules
  for select to authenticated
  using (true);

create trigger tax_rules_touch_updated_at
  before update on public.tax_rules
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Country pack items
-- ---------------------------------------------------------------------------------------------

create table public.country_pack_items (
  id uuid primary key default gen_random_uuid(),
  -- ISO 3166-1 alpha-2.
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  -- A dotted lowercase key, such as vat.registration_threshold.
  key text not null check (
    char_length(key) <= 120 and key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'
  ),
  value jsonb not null check (octet_length(value::text) <= 16384),
  source_url text not null check (
    char_length(source_url) <= 2048
    and source_url ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#]\S*)?$'
  ),
  -- The host of source_url, lowercase: the allowed-domain list of M8 is compared with it.
  source_domain text not null check (
    source_domain = lower(substring(source_url from '^https://([A-Za-z0-9.-]+)'))
  ),
  last_verified date,
  status text not null check (status in ('verified', 'unverified', 'under_review', 'stale')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint country_pack_items_verified_has_date check (status <> 'verified' or last_verified is not null),
  constraint country_pack_items_one_per_key unique (country_code, key)
);

comment on table public.country_pack_items is
  'Dated, sourced country facts: registration steps, fees, approvals (CLAUDE.md rules 8 and 9, D-233). Reference data: read by signed-in users, written by migrations and the admin only. An item older than 90 days, or not verified, is shown with a prompt to check the official source.';

alter table public.country_pack_items enable row level security;

revoke all on table public.country_pack_items from anon, authenticated;
grant select on table public.country_pack_items to authenticated;

create policy "country_pack_items: signed-in users read" on public.country_pack_items
  for select to authenticated
  using (true);

create trigger country_pack_items_touch_updated_at
  before update on public.country_pack_items
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('summary', 'full')),
  locale text not null check (locale in ('ar', 'en')),
  -- Who the report is for (H8), as the app names it; null when not asked.
  audience text check (audience is null or char_length(audience) between 1 and 80),
  -- sha256 of the answers, parameters and engine version the report was made from (rule 4).
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  engine_version text not null check (char_length(engine_version) between 1 and 40),
  -- {user_id}/{project_id}/{report_id}.pdf in the private reports bucket (D-234).
  pdf_path text not null,
  pdf_bytes integer not null check (pdf_bytes >= 0),
  created_at timestamptz not null default now(),
  constraint reports_pdf_path_shape check (
    pdf_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    and pdf_path = split_part(pdf_path, '/', 1) || '/' || project_id::text || '/' || id::text || '.pdf'
  )
);

comment on table public.reports is
  'One row per stored report PDF: project, kind, language, audience, the input hash and engine version it was made from, and its path and size in the reports bucket (D-234). Written only by record_report(); deleted with its project.';

create index reports_project_created_idx on public.reports (project_id, created_at desc);

alter table public.reports enable row level security;

revoke all on table public.reports from anon, authenticated;
grant select on table public.reports to authenticated;

create policy "reports: owner reads" on public.reports
  for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.user_id = (select auth.uid())
  ));

-- Records a stored report for a project of the signed-in user and returns its id. The app makes
-- the id, records the report here, and then uploads the file to {user_id}/{project_id}/{report_id}.pdf
-- with the user's own session: the storage policy lets a user add exactly the file a recorded
-- report names. The path must be exactly that, so a user cannot point a row at a file in another
-- user's or another project's folder. A user records at most report.pdf_per_day reports per UTC
-- day (D-234), so the rows, and with them the files, are bounded by the database and not only by
-- the app. An empty audience means none.
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
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_today integer;
begin
  if v_user is null then
    raise exception 'record_report: not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.projects where id = p_project_id and user_id = v_user
  ) then
    raise exception 'record_report: not your project' using errcode = '42501';
  end if;
  if p_report_id is null
    or p_pdf_path is distinct from v_user::text || '/' || p_project_id::text || '/' || p_report_id::text || '.pdf'
  then
    raise exception 'record_report: the path is not {user}/{project}/{report}.pdf' using errcode = '42501';
  end if;

  -- The daily limit, counted under a lock so two calls at once cannot both pass. A missing or
  -- non-positive setting closes the door.
  perform pg_advisory_xact_lock(hashtextextended('record_report:' || v_user::text, 0));
  select (value #>> '{}')::integer into v_limit
  from public.settings where key = 'report.pdf_per_day';
  select count(*)::integer into v_today
  from public.reports r
  join public.projects p on p.id = r.project_id
  where p.user_id = v_user
    and r.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
  if coalesce(v_limit, 0) <= 0 or v_today >= v_limit then
    raise exception 'record_report: the daily limit is reached' using errcode = '54000';
  end if;

  insert into public.reports (
    id, project_id, kind, locale, audience, input_hash, engine_version, pdf_path, pdf_bytes
  )
  values (
    p_report_id, p_project_id, p_kind, p_locale, nullif(btrim(p_audience), ''), p_input_hash,
    p_engine_version, p_pdf_path, p_pdf_bytes
  );
  return p_report_id;
end;
$$;

comment on function public.record_report(uuid, uuid, text, text, text, text, text, text, integer) is
  'Records a stored report PDF for a project of the signed-in user, up to report.pdf_per_day a UTC day. The path must be {user_id}/{project_id}/{report_id}.pdf. Returns the report id.';

revoke all on function public.record_report(uuid, uuid, text, text, text, text, text, text, integer)
  from public, anon;
grant execute on function public.record_report(uuid, uuid, text, text, text, text, text, text, integer)
  to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Engine runs
-- ---------------------------------------------------------------------------------------------

-- One engine run per project, tool, input and engine version (D-238). A run that comes back with
-- the same hash and version is the same row, so a repeated page load or a double submit writes
-- nothing new; a new engine version writes a new row. Model runs have no engine_version.
create unique index tool_runs_engine_run_key
  on public.tool_runs (project_id, tool_id, input_hash, engine_version)
  where engine_version is not null;

-- Records the run of an engine tool for a project of the signed-in user, with no model and no
-- cost, and returns its id; the id of the existing row when the same project, tool, input hash and
-- engine version are already recorded. The output is the compact summary of D-238, not the full
-- run. The model tools write their rows through record_ai_run() only: a new one is listed here
-- with its migration. The writes are bounded here, not left to the app: a project keeps the newest
-- five engine runs of each tool (older ones are recomputable and are deleted as a new one is
-- written) and at most twelve different engine tools, so a loop of calls cannot fill tool_runs.
create function public.record_engine_run(
  p_project_id uuid,
  p_tool_id text,
  p_input_hash text,
  p_output jsonb,
  p_engine_version text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_tools integer;
begin
  if auth.uid() is null then
    raise exception 'record_engine_run: not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.projects where id = p_project_id and user_id = auth.uid()
  ) then
    raise exception 'record_engine_run: not your project' using errcode = '42501';
  end if;

  if p_tool_id is null
    or p_tool_id !~ '^[a-z][a-z0-9_]{1,39}$'
    or p_tool_id in ('review_text')
  then
    raise exception 'record_engine_run: unknown tool' using errcode = '22023';
  end if;
  if p_input_hash is null or p_input_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'record_engine_run: the input hash is not a sha256' using errcode = '22023';
  end if;
  if p_engine_version is null or p_engine_version !~ '^[0-9A-Za-z][0-9A-Za-z._+-]{0,39}$' then
    raise exception 'record_engine_run: the engine version is missing or malformed' using errcode = '22023';
  end if;
  if p_output is null or octet_length(p_output::text) > 65536 then
    raise exception 'record_engine_run: the output is missing or too large' using errcode = '22023';
  end if;

  -- One writer per project at a time, so the counts below hold under concurrent calls.
  perform pg_advisory_xact_lock(hashtextextended('record_engine_run:' || p_project_id::text, 0));

  if not exists (
    select 1 from public.tool_runs
    where project_id = p_project_id and tool_id = p_tool_id and engine_version is not null
  ) then
    select count(distinct tool_id)::integer into v_tools
    from public.tool_runs
    where project_id = p_project_id and engine_version is not null;
    if v_tools >= 12 then
      raise exception 'record_engine_run: too many engine tools for one project' using errcode = '54000';
    end if;
  end if;

  insert into public.tool_runs (project_id, tool_id, input_hash, output, engine_version)
  values (p_project_id, p_tool_id, p_input_hash, p_output, p_engine_version)
  on conflict (project_id, tool_id, input_hash, engine_version) where engine_version is not null
    do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.tool_runs
    where project_id = p_project_id
      and tool_id = p_tool_id
      and input_hash = p_input_hash
      and engine_version = p_engine_version;
  else
    delete from public.tool_runs
    where project_id = p_project_id
      and tool_id = p_tool_id
      and engine_version is not null
      and model is null
      and id not in (
        select r.id from public.tool_runs r
        where r.project_id = p_project_id
          and r.tool_id = p_tool_id
          and r.engine_version is not null
          and r.model is null
        order by r.id desc
        limit 5
      );
  end if;
  return v_id;
end;
$$;

comment on function public.record_engine_run(uuid, text, text, jsonb, text) is
  'Records an engine tool run (no model, no cost) for a project of the signed-in user and returns its id; returns the existing id for the same project, tool, input hash and engine version. Keeps the newest five runs of each tool and at most twelve tools per project.';

revoke all on function public.record_engine_run(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.record_engine_run(uuid, text, text, jsonb, text) to authenticated;

comment on table public.tool_runs is
  'One row per tool or model run, with its input hash for reuse and its tokens and cost. Written by record_ai_run() (models) and record_engine_run() (engine tools).';

-- ---------------------------------------------------------------------------------------------
-- The private bucket for report PDFs (D-234, D-244)
-- ---------------------------------------------------------------------------------------------

-- The CI stacks that only run the migrations (supabase db start, and supabase start without the
-- storage API) have no storage schema; there this block does nothing. On the hosted projects and
-- on a full local stack it makes the bucket and its owner-only policies. A file lives at
-- {user_id}/{project_id}/{report_id}.pdf: the first folder is the user, the second one of their
-- projects. There is no update policy: a PDF is written once under a new id.
do $storage$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'm5_foundations: no storage schema here, the reports bucket and its policies are skipped';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('reports', 'reports', false, 10485760, array['application/pdf'])
  on conflict (id) do nothing;

  create policy "reports bucket: owner reads files" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'reports'
      and split_part(name, '/', 1) = (select auth.uid())::text
    );

  -- A user adds only the file that a report of theirs names: record_report() (daily limit, exact
  -- path, ownership) comes first, so the files cannot outnumber the recorded reports. A file is
  -- written once: there is no update policy, and an upload under an existing name is refused.
  create policy "reports bucket: owner adds the file of a recorded report" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'reports'
      and exists (
        select 1
        from public.reports r
        join public.projects p on p.id = r.project_id
        where r.pdf_path = objects.name and p.user_id = (select auth.uid())
      )
    );

  create policy "reports bucket: owner deletes files" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'reports'
      and split_part(name, '/', 1) = (select auth.uid())::text
    );
end
$storage$;
