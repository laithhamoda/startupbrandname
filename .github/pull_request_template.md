## What and why

<!-- One paragraph: what changes for the founder, the owner or the code, and why. -->

Decisions: <!-- D-IDs added or applied; open questions resolved (#NN) -->

## Checks

- [ ] The six CI jobs are green (`pnpm verify` runs the main steps of the `checks` and `db` jobs
      locally; it resets the local database).
- [ ] Tests added or updated for every change in behaviour (docs/TESTING.md).
- [ ] Accessibility and RTL checked where the interface changed (CLAUDE.md rule 11).
- [ ] New decisions appended to `docs/DECISIONS.md` and its topic index; merged rows untouched,
      except the Status of a decision the new one amends or supersedes (D-172).

## Only when the pull request touches these (CONTRIBUTING.md)

- [ ] Environment variable: schema, `env.test.ts`, `.env.example`, bundle scan for secrets, CI,
      Vercel (Production and Preview), the table in `docs/runbooks/operations.md`.
- [ ] Question, option or follow-up: stored answers still parse (mapping or data migration, with
      an old-shape test); Arabic label or rule changes, which make stored AI reviews stale, are
      batched.
- [ ] Settings key: migration, pgTAP assertion, fail-closed read, the table in
      `docs/runbooks/operations.md`.
- [ ] Migration: expand only; the app works on the previous schema; RLS and pgTAP; `db:types`
      committed; no merged migration edited. Production follows `docs/runbooks/operations.md`.
      New user data cascades from `auth.users` or `projects` (`on delete cascade`) and is added to
      the export (`docs/runbooks/data-requests.md`) and the processing register.
- [ ] UI string: `ar.json` and `en.json`, same keys and placeholders; a client component gets
      its namespace from its route's `ClientMessages` (`client-messages.test.ts`).
- [ ] Visual change: snapshots from the "Update RTL snapshots" workflow, reviewed.
- [ ] `CLAUDE.md` or `docs/SPEC.md` changed: the owner approved it (link), and
      `docs/SPEC-CHANGES.md` is updated.
