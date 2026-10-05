# M9 hardening checklist

M9's definition of done is "Checklist signed off" (CLAUDE.md §9). This is that checklist: every
security, privacy and operations item deferred by an earlier milestone or by the 2026-09-28 audit,
with its source. Each milestone adds what it defers; an item leaves the list only when it is done
or a decision drops it. A done item is ticked and moves to [Done](#done), with the decision that
did it.

## Browser security

- [ ] **Content-Security-Policy.** The theme script is inlined before first paint
      (`themeScript` in `apps/web/src/app/[locale]/layout.tsx`) and needs a hash (D-058). Next.js
      also inlines its own scripts: a nonce makes every page render on request, losing
      prerendering and the CDN cache, while the alternatives weaken the policy. Decide the
      trade-off and record it. `form-action` must allow the Google sign-in hand-over to Supabase and
      Google.
- [ ] **Other headers.** Since the audit fixes (D-130), every response sends `X-Frame-Options`,
      `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
      and `Strict-Transport-Security` (`next.config.ts`). Left for M9: `includeSubDomains` and
      `preload` on HSTS (owner decision), `payment=` for PayPal (M7), and pages served with
      `Access-Control-Allow-Origin: *`: check that nothing needs it.
- [ ] **`security.txt`** at `/.well-known/security.txt` (RFC 9116), with a contact (#78) and an
      expiry date.

## Sign-in and abuse

- [ ] **Bot protection.** Cloudflare Turnstile on sign-up and sign-in before public launch (D-074).
- [ ] **Client IP.** Server Actions call Supabase Auth from Vercel (D-077), so Supabase's per-IP
      limits see Vercel's address, not the visitor's: forward the visitor's address or limit in
      the app (SEC-6).
- [ ] **Rate limits** on Server Actions and routes, including `saveAnswer` (CLAUDE.md §9).
- [ ] **Session lifetimes.** Supabase time-box and inactivity timeout; suggested 30 days and 7
      days, to decide in the M9 plan (SEC-7). `supabase/config.toml` leaves them unset.
- [ ] **Account sharing.** More than two devices at once signs out the oldest session and tells
      the user (SPEC §10, CLAUDE.md §9).
- [ ] **Voucher guessing.** `VIVA` + 8 hex is 32 bits, and per-account and per-IP locks do not stop
      guessing across many free accounts: monitor failed attempts globally (#14, M7 vouchers).
- [ ] **Security advisor.** No open Supabase advisor warning except those accepted in D-085.
      `create_project()` (M3a), `reserve_ai_run()` and `record_ai_run()` (D-146) are signed-in
      SECURITY DEFINER functions of the same kind as those three, and no decision accepts them yet.

## Logging, monitoring and alerting

- [ ] **Security events.** The structured logger exists since the audit fixes
      (`apps/web/src/lib/log.ts`, D-126). Left for M9: log security events through it (failed and
      rate-limited sign-ins, consent changes, account deletions, permission errors from database
      functions), never answer text or an email address (OBS-1, SEC-11).
- [ ] **Monitoring and alerting.** `/api/health` uptime, error rate, AI spend close to
      `ai.limit.global_daily_usd` (the day's `cost_usd + held_usd` in `private.ai_spend_daily`,
      D-146), `ai.skipped` with `timeout` or `previous_schema` and `proxy.refresh_timeout` in the
      logs (D-152, D-168), failed `DB deploy` runs and cron jobs, each alerting the owner (OBS-3).
      The audit proposed adding this to M9's definition of done in CLAUDE.md §9; that text changes
      only with the owner's approval.

## Personal data

- [ ] **Download my data** on `/account`: the same tables as
      [data-requests.md](../runbooks/data-requests.md), read under row level security, returned as
      JSON, with an end-to-end test (PRIV-10). `private.ai_reservations` is closed to signed-in
      users, so it needs a function of its own or a decision to leave it out (D-175).
- [ ] **Deletion versus records that must be kept** (payments, commissions, audit log): what
      survives, and how it is anonymised (#31). AI costs already survive with no key (D-146).
- [ ] **Auth audit log.** Emails and IP addresses in Supabase's auth audit log outlive a deleted
      account. Turn off its database storage, or purge it after a set period and delete the user's
      entries in `delete_my_account()`; record the choice in
      [auth-setup.md](../runbooks/auth-setup.md) (PRIV-15, #87). The privacy draft already says
      these records may stay (D-154).
- [ ] **AI reservations.** `reserve_ai_run()` removes a user's reservations older than a day only
      at that user's next reservation, so an account that stops using AI keeps its last ones until
      it is deleted. A scheduled purge would bound them (D-146, D-175).
- [ ] **Retention.** Free projects after 30 days: counted from creation or last activity, and hard
      deleted or not (#9, M7).

## Backups and recovery

- [ ] **Acceptable data loss.** Daily backups (up to 24 hours lost, D-064) or point-in-time
      recovery; decide before public launch (OPS-3).
- [ ] **Restore drill** on a scratch project, timed and written up (CLAUDE.md §9).
- [ ] **Erasure replay.** A way to apply again, after a restore, the account deletions made since
      the backup (PRIV-9).

## Dependencies and secrets

- [ ] **Remediation window.** How fast a vulnerable dependency is fixed by severity, and how it is
      noticed (`pnpm audit`, GitHub alerts). Decide in the M9 plan.
- [ ] **Rotation drill.** Rotate each secret in [breach-response.md](../runbooks/breach-response.md)
      once, and time it.

## Performance

- [ ] **Field Web Vitals.** Vercel Speed Insights, a first-party cookieless route, or none, with an
      entry on the privacy page if collected (PERF-10).

## Done

Finished by the audit fixes A to D (2026-09-28 to 2026-10-05):

- [x] **Structured logs without personal data.** One logger, `apps/web/src/lib/log.ts`, with
      allowlisted fields only and `LOG_LEVEL`; uncaught server errors logged with their digest;
      `no-console` in ESLint (D-126, OBS-1). Logging the security events stays open above.
- [x] **Security headers.** `X-Frame-Options`, `frame-ancestors 'none'`, `X-Content-Type-Options`,
      `Referrer-Policy`, `Permissions-Policy` and `Strict-Transport-Security` on every response
      (D-130). What remains of them is under Browser security.
- [x] **Competitor links.** Only `http` and `https` URLs to a domain name are accepted (D-130).
- [x] **AI cost records.** Runs are recorded only against one-time reservations, with the cost
      computed by the database; no signed-in user can record a cost or close AI for everyone, and
      no deletion lowers the day's spend (D-146, SEC-1, COST-1).
- [x] **Consent to the processing actually done.** A consent counts only for a listed text
      version, and the account page renews it (D-147, PRIV-1, PRIV-4).
- [x] **De-identification scope.** Names from the sign-in profile, emails, phones, contact links,
      IBANs and ID numbers, with bounded patterns (CodeQL alert 1) and numbered placeholders that
      never reach a saved answer (D-148, D-149, PRIV-2, PRIV-5, PRIV-7).
- [x] **Project IDs in page views.** Replaced with `:id` before sending (D-153, PRIV-14).
- [x] **Privacy draft.** Lists the stored answers, the AI review, the IP data kept by sign-in, the
      hosting logs and what outlives a deletion (D-154, PRIV-1, PRIV-15); the gaps that remain
      are in the [processing register](../privacy/processing-register.md).
- [x] **Supabase timeouts.** Every Supabase request has a deadline (8 seconds, 3 from the proxy),
      and the proxy's session refresh 4 seconds (D-168, REL-4).
- [x] **AI time budget.** One save spends at most 8 seconds on AI review, with at most one retry
      per request (D-150, PERF-1).
- [x] **Performance budget.** JavaScript per route, script and font bytes and layout shift per
      public page fail CI over budget (D-171, PERF-5).

## Sign-off

| Signed off by | Date | Commit |
| ------------- | ---- | ------ |
|               |      |        |
