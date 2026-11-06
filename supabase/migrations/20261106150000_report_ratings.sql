-- A rating before the PDF (D-345): the founder rates the report, 1 to 5 stars and a comment, once for
-- each report version, before the file is handed over.
--
-- The rating is written only through rate_report(), which names the account itself; the table has no
-- insert grant. has_report_rating() tells the PDF route whether this version was already rated. The
-- admin reads an average and the latest comments without any account identity.
--
-- Expand only: a table and five functions.

create table public.report_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  -- The report version rated; 0 for a report that has no versions (a summary, an unpaid project).
  version integer not null default 0 check (version >= 0),
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version)
);

create index report_ratings_created_idx on public.report_ratings (created_at desc);

comment on table public.report_ratings is
  'The rating a founder gives a report before its PDF (D-345): one per project version. Written only by rate_report(); deleted with the account or the project.';

alter table public.report_ratings enable row level security;

revoke all on table public.report_ratings from anon, authenticated;
grant select on table public.report_ratings to authenticated;

create policy "report_ratings: owner reads" on public.report_ratings
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Writing and checking
-- ---------------------------------------------------------------------------------------------

-- Rates a version of the signed-in account's own project. A second call for the same version
-- replaces the first (the founder may change a rating).
create function public.rate_report(
  p_project_id uuid,
  p_version integer,
  p_stars smallint,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_user is null then
    raise exception 'rate_report: not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id and user_id = v_user) then
    raise exception 'rate_report: not your project' using errcode = '42501';
  end if;
  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'rate_report: stars must be 1 to 5' using errcode = '22023';
  end if;
  if p_version is null or p_version < 0 then
    raise exception 'rate_report: unknown version' using errcode = '22023';
  end if;
  if v_comment is not null and char_length(v_comment) > 1000 then
    raise exception 'rate_report: the comment is too long' using errcode = '22023';
  end if;

  insert into public.report_ratings (user_id, project_id, version, stars, comment)
  values (v_user, p_project_id, p_version, p_stars, v_comment)
  on conflict (project_id, version)
  do update set stars = excluded.stars, comment = excluded.comment, updated_at = now();
end;
$$;

comment on function public.rate_report(uuid, integer, smallint, text) is
  'Rates a version of the signed-in account''s own project, 1 to 5 stars and an optional comment (D-345).';

-- Whether the signed-in account already rated this version of its own project.
create function public.has_report_rating(p_project_id uuid, p_version integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.report_ratings r
    where r.project_id = p_project_id
      and r.version = coalesce(p_version, 0)
      and r.user_id = (select auth.uid())
  );
$$;

revoke all on function public.rate_report(uuid, integer, smallint, text) from public, anon;
grant execute on function public.rate_report(uuid, integer, smallint, text) to authenticated;
revoke all on function public.has_report_rating(uuid, integer) from public, anon;
grant execute on function public.has_report_rating(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The admin's view: no account identity
-- ---------------------------------------------------------------------------------------------

create function public.admin_ratings_summary()
returns table (ratings bigint, average numeric)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit('admin.view_ratings_summary', null, null, '{}'::jsonb);
  return query
  select count(*), round(avg(r.stars), 2) from public.report_ratings r;
end;
$$;

create function public.admin_report_ratings(p_limit integer default 100)
returns table (
  id uuid,
  stars smallint,
  comment text,
  version integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  perform private.write_audit('admin.view_ratings', null, null, jsonb_build_object('limit', v_limit));
  return query
  select r.id, r.stars, r.comment, r.version, r.created_at
  from public.report_ratings r
  order by r.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.admin_ratings_summary() from public, anon;
revoke all on function public.admin_report_ratings(integer) from public, anon;
grant execute on function public.admin_ratings_summary() to authenticated;
grant execute on function public.admin_report_ratings(integer) to authenticated;
