-- M7 step 9, security review: an admin's account can be deleted (D-327 fix).
--
-- audit_log.actor references auth.users with "on delete set null", but the append-only trigger of
-- 20261027160000 refused that update too, so deleting the account of anyone with a row in the log
-- failed. The one change now allowed is exactly the foreign key's: actor goes from an id to null
-- and nothing else in the row moves. Every other update, every delete and truncate stay refused.
--
-- Expand only: the function keeps its name and signature.

create or replace function private.audit_log_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.actor is not null and new.actor is null
       and (new.id, new.at, new.action, new.target_type, new.target_id, new.detail)
         is not distinct from (old.id, old.at, old.action, old.target_type, old.target_id, old.detail)
    then
      return new;
    end if;
  end if;
  raise exception 'the audit log is append only' using errcode = '42501';
end;
$$;
