-- M5 step 1: tax rules, country pack items, stored reports, the engine-run recorder, the PDF limit
-- and the reports bucket (D-233, D-234, D-238, D-243, D-244).
begin;

create extension if not exists pgtap with schema extensions;

select plan(103);

insert into auth.users (id, email, created_at) values
  ('a5000000-0000-4000-8000-000000000001', 'm5-owner@example.test', now()),
  ('b5000000-0000-4000-8000-000000000002', 'm5-stranger@example.test', now());

insert into public.projects (id, user_id, title, country_code, currency) values
  ('a5100000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'one', 'JO', 'JOD'),
  ('a5100000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000001', 'two', 'JO', 'JOD'),
  ('b5100000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000002', 'other', 'DZ', 'DZD');

create function pg_temp.act_as(p_user uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
$$;

-- A signed-in session without a user: the role of a visitor with an expired token.
create function pg_temp.act_as_nobody() returns void
language sql
as $$
  select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
$$;

-- A valid tax rule (a flat 5% of turnover in a made-up currency), with the parts a test changes.
-- Reading the arguments as a JSON object keeps each test to the one field it breaks.
create function pg_temp.rule(p_override jsonb default '{}') returns void
language sql
as $$
  insert into public.tax_rules
  select * from jsonb_populate_record(
    null::public.tax_rules,
    jsonb_build_object(
      'id', gen_random_uuid(),
      'country_code', 'ZZ',
      'legal_form', 'sole',
      'regime', 'test_regime',
      'levy', 'test_levy',
      'kind', 'tax',
      'basis', 'turnover',
      'rate', '1/20',
      'brackets', '[]'::jsonb,
      'currency', 'XTS',
      'payment_month', 3,
      'effective_from', '2026-01-01',
      'source_url', 'https://example.test/tax',
      'last_verified', '2026-10-01',
      'status', 'verified',
      'created_at', now(),
      'updated_at', now()
    ) || p_override
  );
$$;

-- A valid country pack item, the same way.
create function pg_temp.item(p_override jsonb default '{}') returns void
language sql
as $$
  insert into public.country_pack_items
  select * from jsonb_populate_record(
    null::public.country_pack_items,
    jsonb_build_object(
      'id', gen_random_uuid(),
      'country_code', 'ZZ',
      'key', 'test.item',
      'value', '{"text": "x"}'::jsonb,
      'source_url', 'https://registry.example.test/guide',
      'source_domain', 'registry.example.test',
      'last_verified', '2026-10-01',
      'status', 'verified',
      'created_at', now(),
      'updated_at', now()
    ) || p_override
  );
$$;

-- Keeps the id of a run for a later comparison, under `p_name`.
create function pg_temp.keep(p_name text, p_id bigint) returns bigint
language sql
as $$
  select set_config('test.' || p_name, p_id::text, true);
  select p_id;
$$;

create function pg_temp.kept(p_name text) returns bigint
language sql
as $$
  select current_setting('test.' || p_name)::bigint;
$$;

-- ---------------------------------------------------------------------------------------------
-- The tables and functions exist, with row level security
-- ---------------------------------------------------------------------------------------------

select has_table('public', 'tax_rules', 'tax_rules exists');
select has_table('public', 'country_pack_items', 'country_pack_items exists');
select has_table('public', 'reports', 'reports exists');
select is(
  (
    select count(*)::int from pg_class
    where oid in ('public.tax_rules'::regclass, 'public.country_pack_items'::regclass, 'public.reports'::regclass)
      and relrowsecurity
  ),
  3,
  'all three have row level security'
);
select has_function(
  'public', 'record_report',
  array['uuid', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'integer'],
  'record_report exists'
);
select has_function(
  'public', 'record_engine_run', array['uuid', 'text', 'text', 'jsonb', 'text'],
  'record_engine_run exists'
);
select is(
  (select value #>> '{}' from public.settings where key = 'report.pdf_per_day'),
  '10',
  'a user may make 10 PDFs a day'
);
select ok(
  not has_function_privilege('anon', 'public.record_engine_run(uuid, text, text, jsonb, text)', 'execute')
    and not has_function_privilege(
      'anon', 'public.record_report(uuid, uuid, text, text, text, text, text, text, integer)', 'execute'
    ),
  'visitors cannot run either recorder'
);

-- ---------------------------------------------------------------------------------------------
-- Reference data: read by signed-in users, written by nobody who connects as a role
-- ---------------------------------------------------------------------------------------------

select lives_ok($$select pg_temp.rule()$$, 'a valid flat-rate rule is stored');
select lives_ok($$select pg_temp.item()$$, 'a valid country pack item is stored');

select pg_temp.act_as('a5000000-0000-4000-8000-000000000001');
set local role authenticated;

select is((select count(*)::int from public.tax_rules), 1, 'a signed-in user reads the tax rules');
select is(
  (select count(*)::int from public.country_pack_items), 1, 'a signed-in user reads the country pack'
);

select throws_ok(
  $$insert into public.tax_rules (country_code, legal_form, regime, levy, kind, basis, rate, currency, payment_month, effective_from, source_url, status)
    values ('ZZ', 'sole', 'r', 'l', 'tax', 'turnover', '1/20', 'XTS', 3, '2026-01-01', 'https://example.test/x', 'unverified')$$,
  '42501', null, 'a user cannot add a tax rule'
);
select throws_ok(
  $$update public.tax_rules set status = 'verified'$$, '42501', null, 'a user cannot change a tax rule'
);
select throws_ok($$delete from public.tax_rules$$, '42501', null, 'a user cannot delete a tax rule');
select throws_ok(
  $$insert into public.country_pack_items (country_code, key, value, source_url, source_domain, status)
    values ('ZZ', 'a.b', '{}', 'https://example.test/x', 'example.test', 'unverified')$$,
  '42501', null, 'a user cannot add a country pack item'
);
select throws_ok(
  $$update public.country_pack_items set status = 'verified'$$,
  '42501', null, 'a user cannot change a country pack item'
);
select throws_ok(
  $$delete from public.country_pack_items$$, '42501', null, 'a user cannot delete a country pack item'
);

reset role;
set local role anon;

select throws_ok($$select * from public.tax_rules$$, '42501', null, 'a visitor cannot read the tax rules');
select throws_ok(
  $$select * from public.country_pack_items$$, '42501', null, 'a visitor cannot read the country pack'
);
select throws_ok($$select * from public.reports$$, '42501', null, 'a visitor cannot read reports');

reset role;

-- ---------------------------------------------------------------------------------------------
-- The shape of a tax rule
-- ---------------------------------------------------------------------------------------------

select throws_ok(
  $$select pg_temp.rule('{"status": "draft"}')$$, '23514', null, 'a status outside the four is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"source_url": "http://example.test/tax"}')$$,
  '23514', null, 'a source URL that is not https is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"source_url": "https://user@example.test/tax"}')$$,
  '23514', null, 'a source URL with a login in it is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"basis": "fixed", "rate": null, "fixed_amount": -1}')$$,
  '23514', null, 'a negative fixed amount is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"min_amount": -5}')$$, '23514', null, 'a negative minimum is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"ceiling": -5}')$$, '23514', null, 'a negative turnover ceiling is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"payment_month": 13}')$$, '23514', null, 'a payment month of 13 is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"payment_month": 0}')$$, '23514', null, 'a payment month of 0 is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"rate": "0.05"}')$$, '23514', null, 'a rate that is not an n/d fraction is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"rate": "1/0"}')$$, '23514', null, 'a rate with a zero divisor is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"rate": "-1/20"}')$$, '23514', null, 'a negative rate is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"legal_form": "partnership"}')$$, '23514', null, 'an unknown legal form is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"status": "verified", "last_verified": null}')$$,
  '23514', null, 'a verified rule needs its verification date'
);
select throws_ok(
  $$select pg_temp.rule('{"rate": null}')$$, '23514', null, 'a turnover basis needs a rate or brackets'
);
select throws_ok(
  $$select pg_temp.rule('{"brackets": [{"up_to": null, "rate": "1/10"}]}')$$,
  '23514', null, 'a rate and brackets together are refused'
);
select throws_ok(
  $$select pg_temp.rule('{"basis": "fixed", "fixed_amount": 1200}')$$,
  '23514', null, 'a fixed basis with a rate is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"fixed_amount": 1200}')$$, '23514', null, 'a fixed amount without a fixed basis is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"rate": null, "brackets": [{"up_to": "1000", "rate": "1/10"}]}')$$,
  '23514', null, 'brackets that never end open are refused'
);
select throws_ok(
  $$select pg_temp.rule('{"rate": null, "brackets": [{"up_to": "5000", "rate": "1/10"}, {"up_to": "1000", "rate": "1/5"}, {"up_to": null, "rate": "1/4"}]}')$$,
  '23514', null, 'brackets that do not rise are refused'
);
select throws_ok(
  $$select pg_temp.rule('{"rate": null, "brackets": [{"up_to": "1000", "rate": "0.1"}, {"up_to": null, "rate": "1/4"}]}')$$,
  '23514', null, 'a bracket rate that is not an n/d fraction is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"rate": null, "brackets": [{"up_to": "1000", "rate": "1/10", "note": "x"}, {"up_to": null, "rate": "1/4"}]}')$$,
  '23514', null, 'a bracket with an extra key is refused'
);
select throws_ok(
  $$select pg_temp.rule('{"rate": null, "brackets": [{"up_to": 1000, "rate": "1/10"}, {"up_to": null, "rate": "1/4"}]}')$$,
  '23514', null, 'a bracket limit that is a number, not minor-unit text, is refused'
);
select lives_ok(
  $$select pg_temp.rule('{"levy": "bracketed", "basis": "profit", "rate": null, "brackets": [{"up_to": "1000", "rate": "1/10"}, {"up_to": "5000", "rate": "3/20"}, {"up_to": null, "rate": "1/4"}]}')$$,
  'rising brackets that end open are stored'
);
select lives_ok(
  $$select pg_temp.rule('{"levy": "flat_fee", "basis": "fixed", "rate": null, "fixed_amount": 120000, "min_amount": 0, "ceiling": 5000000000, "kind": "social_contribution", "status": "unverified", "last_verified": null}')$$,
  'a fixed-amount social contribution that is not yet verified is stored'
);
select throws_ok(
  $$select pg_temp.rule()$$, '23505', null, 'the same rule twice on the same date is refused'
);

-- ---------------------------------------------------------------------------------------------
-- The shape of a country pack item
-- ---------------------------------------------------------------------------------------------

select throws_ok(
  $$select pg_temp.item('{"key": "Test.Item2"}')$$, '23514', null, 'a key with capitals is refused'
);
select throws_ok(
  $$select pg_temp.item('{"key": "test..item"}')$$, '23514', null, 'a key with an empty part is refused'
);
select throws_ok(
  $$select pg_temp.item('{"key": "b", "source_url": "http://registry.example.test/guide"}')$$,
  '23514', null, 'an item source that is not https is refused'
);
select throws_ok(
  $$select pg_temp.item('{"key": "b", "source_domain": "other.example.test"}')$$,
  '23514', null, 'a source domain that is not the host of the source URL is refused'
);
select throws_ok(
  $$select pg_temp.item('{"key": "b", "status": "draft"}')$$, '23514', null, 'an item status outside the four is refused'
);
select throws_ok(
  $$select pg_temp.item('{"key": "b", "last_verified": null}')$$,
  '23514', null, 'a verified item needs its verification date'
);
select throws_ok(
  $$select pg_temp.item()$$, '23505', null, 'a second item with the same country and key is refused'
);
select lives_ok(
  $$select pg_temp.item('{"key": "b.c_d", "status": "stale", "last_verified": "2026-01-01"}')$$,
  'a stale item with a dotted key is stored'
);

-- ---------------------------------------------------------------------------------------------
-- record_report and the reports table
-- ---------------------------------------------------------------------------------------------

select pg_temp.act_as('a5000000-0000-4000-8000-000000000001');
set local role authenticated;

select is(
  public.record_report(
    'a5200000-0000-4000-8000-000000000001', 'a5100000-0000-4000-8000-000000000001', 'full', 'ar',
    '  ', repeat('a', 64), '1.0.0',
    'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000001.pdf',
    118136
  ),
  'a5200000-0000-4000-8000-000000000001'::uuid,
  'the owner records a report for their project and gets its id'
);

select is(
  (
    select audience is null and kind = 'full' and locale = 'ar' and engine_version = '1.0.0'
      and pdf_bytes = 118136
    from public.reports where id = 'a5200000-0000-4000-8000-000000000001'
  ),
  true,
  'the row has the values recorded, and a blank audience is stored as none'
);

select lives_ok(
  $$select public.record_report(
    'a5200000-0000-4000-8000-000000000002', 'a5100000-0000-4000-8000-000000000002', 'summary', 'en',
    'investor', repeat('b', 64), '1.0.0',
    'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000002/a5200000-0000-4000-8000-000000000002.pdf',
    90000
  )$$,
  'the owner records a report for their other project'
);

select is(
  (select audience from public.reports where id = 'a5200000-0000-4000-8000-000000000002'),
  'investor',
  'an audience is kept'
);

select throws_ok(
  $$select public.record_report(
    'a5200000-0000-4000-8000-000000000003', 'b5100000-0000-4000-8000-000000000003', 'full', 'ar',
    '', repeat('a', 64), '1.0.0',
    'a5000000-0000-4000-8000-000000000001/b5100000-0000-4000-8000-000000000003/a5200000-0000-4000-8000-000000000003.pdf',
    100
  )$$,
  '42501', 'record_report: not your project', 'a report for someone else''s project is refused'
);

select throws_ok(
  $$select public.record_report(
    'a5200000-0000-4000-8000-000000000004', 'a5100000-0000-4000-8000-000000000001', 'full', 'ar',
    '', repeat('a', 64), '1.0.0',
    'b5000000-0000-4000-8000-000000000002/a5100000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000004.pdf',
    100
  )$$,
  '42501', 'record_report: the path is not {user}/{project}/{report}.pdf',
  'a path in another user''s folder is refused'
);

select throws_ok(
  $$select public.record_report(
    'a5200000-0000-4000-8000-000000000005', 'a5100000-0000-4000-8000-000000000001', 'full', 'ar',
    '', repeat('a', 64), '1.0.0',
    'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000002/a5200000-0000-4000-8000-000000000005.pdf',
    100
  )$$,
  '42501', 'record_report: the path is not {user}/{project}/{report}.pdf',
  'a path in another project''s folder is refused'
);

select throws_ok(
  $$select public.record_report(
    'a5200000-0000-4000-8000-000000000006', 'a5100000-0000-4000-8000-000000000001', 'full', 'ar',
    '', repeat('a', 64), '1.0.0',
    'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000001.pdf',
    100
  )$$,
  '42501', 'record_report: the path is not {user}/{project}/{report}.pdf',
  'a path that names another report is refused'
);

select throws_ok(
  $$select public.record_report(
    'a5200000-0000-4000-8000-000000000007', 'a5100000-0000-4000-8000-000000000001', 'draft', 'ar',
    '', repeat('a', 64), '1.0.0',
    'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000007.pdf',
    100
  )$$,
  '23514', null, 'a kind outside summary and full is refused'
);

select throws_ok(
  $$select public.record_report(
    'a5200000-0000-4000-8000-000000000001', 'a5100000-0000-4000-8000-000000000001', 'full', 'ar',
    '', repeat('a', 64), '1.0.0',
    'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000001.pdf',
    100
  )$$,
  '23505', null, 'a report id is recorded once'
);

select throws_ok(
  $$select public.record_report(
    'a5200000-0000-4000-8000-000000000008', 'a5100000-0000-4000-8000-000000000001', 'full', 'ar',
    '', repeat('a', 64), '1.0.0',
    'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000008.pdf',
    -1
  )$$,
  '23514', null, 'a negative size is refused'
);

select throws_ok(
  $$insert into public.reports (project_id, kind, locale, input_hash, engine_version, pdf_path, pdf_bytes)
    values ('a5100000-0000-4000-8000-000000000001', 'full', 'ar', repeat('a', 64), '1.0.0', 'x', 1)$$,
  '42501', null, 'a user cannot insert into reports directly'
);
select throws_ok(
  $$update public.reports set pdf_bytes = 1$$, '42501', null, 'a user cannot change a report'
);
select throws_ok($$delete from public.reports$$, '42501', null, 'a user cannot delete a report row');

select is((select count(*)::int from public.reports), 2, 'the owner sees their two reports');

reset role;

-- A report of the stranger's, written by the database owner, is invisible to the first user.
insert into public.reports (id, project_id, kind, locale, input_hash, engine_version, pdf_path, pdf_bytes) values
  (
    'b5200000-0000-4000-8000-000000000009', 'b5100000-0000-4000-8000-000000000003', 'summary', 'ar',
    repeat('c', 64), '1.0.0',
    'b5000000-0000-4000-8000-000000000002/b5100000-0000-4000-8000-000000000003/b5200000-0000-4000-8000-000000000009.pdf',
    10
  );

select pg_temp.act_as('a5000000-0000-4000-8000-000000000001');
set local role authenticated;

select is(
  (select count(*)::int from public.reports where project_id = 'b5100000-0000-4000-8000-000000000003'),
  0,
  'a user does not see another user''s report'
);

reset role;
set local role anon;

select throws_ok(
  $$select public.record_report(
    'a5200000-0000-4000-8000-000000000010', 'a5100000-0000-4000-8000-000000000001', 'full', 'ar',
    '', repeat('a', 64), '1.0.0',
    'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000010.pdf',
    100
  )$$,
  '42501', null, 'a visitor cannot record a report'
);

reset role;
select pg_temp.act_as_nobody();
set local role authenticated;

select throws_ok(
  $$select public.record_report(
    'a5200000-0000-4000-8000-000000000011', 'a5100000-0000-4000-8000-000000000001', 'full', 'ar',
    '', repeat('a', 64), '1.0.0',
    'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000011.pdf',
    100
  )$$,
  '42501', 'record_report: not signed in', 'a session without a user cannot record a report'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- record_engine_run (D-238)
-- ---------------------------------------------------------------------------------------------

select pg_temp.act_as('a5000000-0000-4000-8000-000000000001');
set local role authenticated;

select lives_ok(
  $$select pg_temp.keep('first', public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('1', 64), '{"verdict": "adjust"}', '1.0.0'
  ))$$,
  'the owner records an engine run'
);

select is(
  (
    select model is null and prompt_version is null and tokens_in = 0 and tokens_out = 0
      and cache_write_tokens = 0 and cache_read_tokens = 0 and search_calls = 0 and cost_usd = 0
      and engine_version = '1.0.0' and output = '{"verdict": "adjust"}'::jsonb
    from public.tool_runs where id = pg_temp.kept('first')
  ),
  true,
  'the run has no model and no cost, and carries the engine version and the output'
);

select is(
  public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('1', 64), '{"verdict": "other"}', '1.0.0'
  ),
  pg_temp.kept('first'),
  'the same project, tool, hash and version give the same id'
);

select is(
  (select output from public.tool_runs where id = pg_temp.kept('first')),
  '{"verdict": "adjust"}'::jsonb,
  'and the first output is kept'
);

select isnt(
  public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('1', 64), '{"verdict": "adjust"}', '1.1.0'
  ),
  pg_temp.kept('first'),
  'a new engine version writes a new row'
);

select isnt(
  public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('2', 64), '{"verdict": "adjust"}', '1.0.0'
  ),
  pg_temp.kept('first'),
  'a new input hash writes a new row'
);

select isnt(
  public.record_engine_run(
    'a5100000-0000-4000-8000-000000000002', 'engine_run', repeat('1', 64), '{"verdict": "adjust"}', '1.0.0'
  ),
  pg_temp.kept('first'),
  'the same hash in another project writes a new row'
);

select is(
  (
    select count(*)::int from public.tool_runs
    where project_id = 'a5100000-0000-4000-8000-000000000001' and tool_id = 'engine_run'
  ),
  3,
  'the first project has three engine runs: one per hash and version'
);

select throws_ok(
  $$select public.record_engine_run(
    'b5100000-0000-4000-8000-000000000003', 'engine_run', repeat('1', 64), '{}', '1.0.0'
  )$$,
  '42501', 'record_engine_run: not your project', 'a run for someone else''s project is refused'
);
select throws_ok(
  $$select public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'review_text', repeat('1', 64), '{}', '1.0.0'
  )$$,
  '22023', 'record_engine_run: unknown tool', 'the model tool''s name is refused'
);
select throws_ok(
  $$select public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'Engine Run', repeat('1', 64), '{}', '1.0.0'
  )$$,
  '22023', 'record_engine_run: unknown tool', 'a tool name that is not a plain identifier is refused'
);
select throws_ok(
  $$select public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', 'abc', '{}', '1.0.0'
  )$$,
  '22023', 'record_engine_run: the input hash is not a sha256', 'a hash that is not a sha256 is refused'
);
select throws_ok(
  $$select public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('1', 64), '{}', ''
  )$$,
  '22023', 'record_engine_run: the engine version is missing or malformed', 'an empty engine version is refused'
);
select throws_ok(
  $$select public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('1', 64), null, '1.0.0'
  )$$,
  '22023', 'record_engine_run: the output is missing or too large', 'a missing output is refused'
);
select throws_ok(
  $$select public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('3', 64),
    jsonb_build_object('x', repeat('x', 70000)), '1.0.0'
  )$$,
  '22023', 'record_engine_run: the output is missing or too large', 'an output over 64 KB is refused'
);

reset role;
select pg_temp.act_as_nobody();
set local role authenticated;

select throws_ok(
  $$select public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('1', 64), '{}', '1.0.0'
  )$$,
  '42501', 'record_engine_run: not signed in', 'a session without a user cannot record a run'
);

reset role;
set local role anon;

select throws_ok(
  $$select public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('1', 64), '{}', '1.0.0'
  )$$,
  '42501', null, 'a visitor cannot record a run'
);

reset role;

-- A model run with the same hash and no engine version is another row, never returned.
insert into public.tool_runs (project_id, tool_id, input_hash, output, model) values
  ('a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('4', 64), '{"by": "model"}', 'm');

select pg_temp.act_as('a5000000-0000-4000-8000-000000000001');
set local role authenticated;

select lives_ok(
  $$select pg_temp.keep('engine', public.record_engine_run(
    'a5100000-0000-4000-8000-000000000001', 'engine_run', repeat('4', 64), '{"by": "engine"}', '1.0.0'
  ))$$,
  'an engine run is recorded next to a model run with the same hash'
);

select is(
  (select output from public.tool_runs where id = pg_temp.kept('engine')),
  '{"by": "engine"}'::jsonb,
  'the model run is not mistaken for the engine run'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- Deleting a project deletes its reports (the erasure guard covers the foreign key)
-- ---------------------------------------------------------------------------------------------

delete from public.projects where id = 'b5100000-0000-4000-8000-000000000003';

select is(
  (select count(*)::int from public.reports where project_id = 'b5100000-0000-4000-8000-000000000003'),
  0,
  'the project''s reports are deleted with it'
);

-- ---------------------------------------------------------------------------------------------
-- The reports bucket, where the storage schema exists (not in the CI stacks without Storage)
-- ---------------------------------------------------------------------------------------------

create function pg_temp.storage_tests() returns setof text
language plpgsql
as $$
begin
  if to_regclass('storage.objects') is null then
    return next skip('no storage schema in this stack: the reports bucket and its policies are not tested', 11);
    return;
  end if;

  return next is(
    (select public from storage.buckets where id = 'reports'),
    false,
    'the reports bucket exists and is private'
  );
  return next is(
    (select allowed_mime_types from storage.buckets where id = 'reports'),
    array['application/pdf'],
    'it takes PDFs only'
  );

  insert into storage.buckets (id, name) values ('elsewhere', 'elsewhere');
  insert into storage.objects (bucket_id, name) values
    ('reports', 'b5000000-0000-4000-8000-000000000002/b5100000-0000-4000-8000-000000000003/b5200000-0000-4000-8000-000000000009.pdf'),
    ('reports', 'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000001.pdf'),
    ('elsewhere', 'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000001.pdf');

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', 'a5000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  return next is(
    (select count(*)::int from storage.objects where bucket_id = 'reports'),
    1,
    'a user reads their own files in the bucket and no one else''s'
  );

  return next lives_ok(
    $q$insert into storage.objects (bucket_id, name) values
      ('reports', 'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000002/a5200000-0000-4000-8000-000000000002.pdf')$q$,
    'a user adds a PDF under their own project'
  );
  return next throws_ok(
    $q$insert into storage.objects (bucket_id, name) values
      ('reports', 'b5000000-0000-4000-8000-000000000002/b5100000-0000-4000-8000-000000000003/b5200000-0000-4000-8000-000000000020.pdf')$q$,
    '42501', null, 'a user cannot add a file in another user''s folder'
  );
  return next throws_ok(
    $q$insert into storage.objects (bucket_id, name) values
      ('reports', 'a5000000-0000-4000-8000-000000000001/b5100000-0000-4000-8000-000000000003/a5200000-0000-4000-8000-000000000021.pdf')$q$,
    '42501', null, 'a user cannot add a file under a project that is not theirs'
  );
  return next throws_ok(
    $q$insert into storage.objects (bucket_id, name) values
      ('reports', 'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000001/notes.txt')$q$,
    '42501', null, 'a user cannot add a file that is not {report}.pdf'
  );
  return next throws_ok(
    $q$insert into storage.objects (bucket_id, name) values
      ('reports', 'a5000000-0000-4000-8000-000000000001/a5200000-0000-4000-8000-000000000022.pdf')$q$,
    '42501', null, 'a user cannot add a file outside the user and project folders'
  );

  delete from storage.objects where bucket_id = 'reports'
    and name like 'b5000000-0000-4000-8000-000000000002/%';
  return next is(
    (select count(*)::int from storage.objects where name like 'b5000000-0000-4000-8000-000000000002/%'),
    0,
    'a user sees no file of another user to delete'
  );

  delete from storage.objects where bucket_id = 'reports'
    and name = 'a5000000-0000-4000-8000-000000000001/a5100000-0000-4000-8000-000000000002/a5200000-0000-4000-8000-000000000002.pdf';
  return next is(
    (select count(*)::int from storage.objects where bucket_id = 'reports'),
    1,
    'a user deletes their own file'
  );

  reset role;

  return next is(
    (select count(*)::int from storage.objects where bucket_id = 'reports'),
    2,
    'the other user''s file is still there'
  );
  return;
end;
$$;

select * from pg_temp.storage_tests();

select * from finish();

rollback;
