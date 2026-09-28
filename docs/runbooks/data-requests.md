# Data requests

How to answer a user who asks for a copy of their data, a correction or a deletion (GDPR Art.
15-20). Until the self-service export arrives in M9 ([M9 checklist](../security/m9-checklist.md)),
a copy is prepared by hand with the SQL below. **[LEGAL REVIEW REQUIRED]** for the rules outside
the EU (#73).

## What users can already do themselves

On `/account`: see and change their country and language, give or withdraw the cross-border
consent, and delete the account, which removes everything at once (`delete_my_account()`; every
table cascades from `auth.users`). Answers are corrected in the diagnostic itself. The email
address cannot be changed by the user yet.

## Receiving a request

1. **Identity.** Act only on a request sent from the account's email address, or confirmed by a
   reply from it. Never send data to any other address, and never ask for an identity document.
2. **Deadline.** Answer within one month of receiving the request. For a complex request or many
   requests it can be extended by two more months, if the user is told why within the first month
   (GDPR Art. 12(3)). It is free (Art. 12(5)).
3. **Record** the date received, the right asked for, how identity was confirmed and the date
   answered, in a private log outside this public repository.

## A copy of the data (access and portability)

Run in the **production** project: Supabase → SQL editor. The editor runs as the database owner,
so row level security does not apply: check the user ID twice.

Find the account:

```sql
select id, email, created_at, last_sign_in_at
from auth.users
where lower(email) = lower('<email address>');
```

Everything the platform holds about it, as one JSON document:

```sql
with target as (select '<user id>'::uuid as id)
select jsonb_pretty(jsonb_build_object(
  'exported_at', now(),
  'account', (
    select jsonb_build_object(
      'email', u.email,
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      -- How the user signs in; for Google, the name, email and photo Google sent.
      'identities', coalesce((
        select jsonb_agg(jsonb_build_object(
          'provider', i.provider,
          'identity_data', i.identity_data,
          'created_at', i.created_at
        ) order by i.created_at)
        from auth.identities i
        where i.user_id = u.id
      ), '[]'::jsonb)
    )
    from auth.users u join target t on u.id = t.id
  ),
  'profile', (
    select to_jsonb(p) - 'user_id'
    from public.profiles p join target t on p.user_id = t.id
  ),
  'consent_events', coalesce((
    select jsonb_agg(to_jsonb(c) - 'user_id' - 'id' order by c.created_at, c.id)
    from public.consent_events c join target t on c.user_id = t.id
  ), '[]'::jsonb),
  'projects', coalesce((
    select jsonb_agg(
      (to_jsonb(pr) - 'user_id') || jsonb_build_object(
        -- Includes raw_text, what the user typed, next to the saved value.
        'answers', coalesce((
          select jsonb_agg(to_jsonb(a) - 'project_id' order by a.question_id)
          from public.answers a
          where a.project_id = pr.id
        ), '[]'::jsonb),
        'ai_reviews', coalesce((
          select jsonb_agg(jsonb_build_object(
            'tool_id', r.tool_id,
            'model', r.model,
            'output', r.output,
            'created_at', r.created_at
          ) order by r.created_at)
          from public.tool_runs r
          where r.project_id = pr.id
        ), '[]'::jsonb)
      )
      order by pr.created_at
    )
    from public.projects pr join target t on pr.user_id = t.id
  ), '[]'::jsonb),
  'usage_counters', coalesce((
    select jsonb_agg(to_jsonb(uc) - 'user_id' order by uc.period_start, uc.key)
    from public.usage_counters uc join target t on uc.user_id = t.id
  ), '[]'::jsonb)
)) as export;
```

While Supabase stores the auth audit log in the database (PRIV-15), it also holds the user's
sign-in events with an IP address; add them to the reply:

```sql
select created_at, ip_address, payload ->> 'action' as action
from auth.audit_log_entries
where payload ->> 'actor_id' = '<user id>'
order by created_at;
```

Copy the result into a file named `startupbrandname-data-<YYYY-MM-DD>.json`, send it as a reply
from the platform's address (#78) to the verified address, then delete every local copy.

When a migration adds a table or column that holds a user's data, add it to this query in the same
pull request ([CONTRIBUTING.md](../../CONTRIBUTING.md)).

## Correction

Country, language and answers: the user can change them. Anything else, such as the email address:
correct it by hand after confirming identity, and record it.

## Deletion

The user deletes the account on `/account`. If they cannot, after confirming identity:

```sql
delete from auth.users where id = '<user id>';
```

This is exactly what `delete_my_account()` does: profiles, consents, projects, answers, AI reviews
and usage counters go with it. Copies in Supabase's daily backups remain until those backups
expire; if a backup is ever restored, the deletion must be run again
([operations.md](operations.md#rolling-back)).

## Withdrawing consent or objecting

The cross-border consent is withdrawn on `/account`; AI review then stops for that user (D-062).
Any other objection or restriction request goes to the owner for a decision, recorded in the
private log.
