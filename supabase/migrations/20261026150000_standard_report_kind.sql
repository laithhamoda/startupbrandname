-- The «متردد» numbers report can be stored as a PDF like the other two kinds (D-314, D-316).
--
-- Expand only: the check on reports.kind accepts one more value; every existing row keeps its own.

alter table public.reports drop constraint reports_kind_check;
alter table public.reports
  add constraint reports_kind_check check (kind in ('summary', 'standard', 'full'));
