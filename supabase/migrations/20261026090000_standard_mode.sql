-- The standard diagnostic: the 20 quick questions and 20 more, for the «متردد» package (D-314).
--
-- Expand only: the check on projects.mode accepts one more value; every existing row keeps its
-- value, and an app that does not know the new mode never writes it.

alter table public.projects drop constraint projects_mode_check;
alter table public.projects
  add constraint projects_mode_check check (mode in ('quick', 'standard', 'full'));
