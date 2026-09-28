## What and why

<!-- One paragraph: what changes for the founder, the owner or the code, and why. -->

Decisions: <!-- D-IDs added or applied; open questions resolved (#NN) -->

## Checks

- [ ] The six CI jobs are green (`pnpm verify` runs the `checks` and `db` jobs locally).
- [ ] Tests added or updated for every change in behaviour (docs/TESTING.md).
- [ ] Accessibility and RTL checked where the interface changed (CLAUDE.md rule 11).
- [ ] New decisions appended to `docs/DECISIONS.md`; merged rows untouched.

## Only when the pull request touches these (CONTRIBUTING.md)

- [ ] Environment variable: schema, `env.test.ts`, `.env.example`, bundle scan for secrets, CI,
      Vercel (Production and Preview), the table in `docs/runbooks/operations.md`.
- [ ] Question, option or follow-up: stored answers still parse (mapping or data migration, with
      an old-shape test).
- [ ] Settings key: migration, pgTAP assertion, fail-closed read, the table in
      `docs/runbooks/operations.md`.
- [ ] Migration: expand only; the app works on the previous schema; RLS and pgTAP; `db:types`
      committed; no merged migration edited. Production follows `docs/runbooks/operations.md`.
- [ ] UI string: `ar.json` and `en.json`, same keys and placeholders.
- [ ] Visual change: snapshots from the "Update RTL snapshots" workflow, reviewed.
- [ ] `CLAUDE.md` or `docs/SPEC.md` changed: the owner approved it (link), and
      `docs/SPEC-CHANGES.md` is updated.
