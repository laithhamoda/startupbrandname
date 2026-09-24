-- Home for security-definer helpers that RLS policies call (from M2).
-- Not listed in the Data API's exposed schemas, and closed to API roles until a
-- later migration grants EXECUTE on specific functions.
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
