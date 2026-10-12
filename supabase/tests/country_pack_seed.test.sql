-- M5 step 4: the first country pack for Jordan and Algeria (D-263 to D-266). Reads the rows the
-- migration 20261013000000_m5_country_pack_seed.sql wrote and checks the rules the report relies on
-- (CLAUDE.md rules 8 and 9): an official https source on an allowed domain, a date, a known status,
-- evidence next to every figure, the tax authority link of each country.
begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

-- The allowed domains as rows, for the checks below.
create temporary table allowed_domains on commit drop as
select d.domain
from public.settings s, jsonb_array_elements_text(s.value) as d(domain)
where s.key = 'pack.allowed_domains';

select ok(
  (select count(*) from allowed_domains) > 0,
  'pack.allowed_domains is a list with entries'
);

select ok(
  (select count(*) from public.country_pack_items where country_code = 'JO') > 0,
  'Jordan has pack items'
);

select ok(
  (select count(*) from public.country_pack_items where country_code = 'DZ') > 0,
  'Algeria has pack items'
);

select is(
  (select count(*)::int from public.country_pack_items where source_url not like 'https://%'),
  0,
  'every item has an https source'
);

select is(
  (
    select count(*)::int
    from public.country_pack_items i
    where not exists (
      select 1
      from allowed_domains a
      where i.source_domain = a.domain
        or right(i.source_domain, length(a.domain) + 1) = '.' || a.domain
    )
  ),
  0,
  'every item source domain is an allowed domain or one of its subdomains'
);

select is(
  (select count(*)::int from public.country_pack_items where last_verified > current_date),
  0,
  'no item is dated in the future'
);

select is(
  (select count(*)::int from public.country_pack_items where status = 'verified' and last_verified is null),
  0,
  'every verified item has a date'
);

select is(
  (
    select count(*)::int
    from public.country_pack_items
    where status not in ('verified', 'unverified', 'under_review', 'stale')
  ),
  0,
  'every item has a known status'
);

select is(
  (
    select count(*)::int
    from (select distinct country_code from public.country_pack_items) c
    where not exists (
      select 1
      from public.country_pack_items i
      where i.country_code = c.country_code and i.key = 'official.tax_authority'
    )
  ),
  0,
  'every country with items has an official.tax_authority item'
);

select is(
  (
    select count(*)::int
    from public.country_pack_items
    where key = 'official.tax_authority'
      and (value ->> 'url') is distinct from source_url
  ),
  0,
  'the tax authority link of each country is its source'
);

select is(
  (
    select count(*)::int
    from public.country_pack_items
    where coalesce(value #>> '{name,ar}', '') = ''
      or coalesce(value #>> '{name,en}', '') = ''
      or coalesce(value #>> '{description,ar}', '') = ''
      or coalesce(value #>> '{description,en}', '') = ''
  ),
  0,
  'every item has its name and description in Arabic and English'
);

select is(
  (
    select count(*)::int
    from public.country_pack_items i,
      jsonb_array_elements(coalesce(i.value -> 'figures', '[]'::jsonb)) as f
    where jsonb_typeof(f -> 'evidence') is distinct from 'array'
      or jsonb_array_length(coalesce(f -> 'evidence', '[]'::jsonb)) = 0
  ),
  0,
  'every figure carries evidence'
);

select is(
  (
    select count(*)::int
    from public.country_pack_items i,
      jsonb_array_elements(coalesce(i.value -> 'figures', '[]'::jsonb)) as f,
      jsonb_array_elements(coalesce(f -> 'evidence', '[]'::jsonb)) as e
    where (e ->> 'url') not like 'https://%'
      or coalesce(e ->> 'text', '') = ''
  ),
  0,
  'every piece of figure evidence has a sentence and an https page'
);

select is(
  (
    select count(*)::int
    from public.country_pack_items
    where country_code = 'JO' and key = 'licence.home_business.amman' and status = 'under_review'
  ),
  1,
  'the Amman home business guide is under review'
);

select is(
  (
    select count(*)::int
    from public.country_pack_items
    where country_code = 'DZ' and key = 'registration.auto_entrepreneur.micro_import_limits'
      and status = 'unverified'
  ),
  1,
  'the micro-import limits are unverified'
);

-- A tax rule is stored only when read on an official page (D-233, D-266). None is written by the
-- seed, so this holds vacuously today and guards every rule added later.
select is(
  (
    select count(*)::int
    from public.tax_rules
    where source_url not like 'https://%'
      or (status = 'verified' and last_verified is null)
      or last_verified > current_date
      or not exists (
        select 1
        from allowed_domains a
        where split_part(split_part(source_url, '://', 2), '/', 1) = a.domain
          or right(split_part(split_part(source_url, '://', 2), '/', 1), length(a.domain) + 1)
            = '.' || a.domain
      )
  ),
  0,
  'every tax rule has an https source on an allowed domain, a date and a status that fits it'
);

select * from finish();

rollback;
