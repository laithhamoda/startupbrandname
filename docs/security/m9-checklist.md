# M9 hardening checklist

M9's definition of done is "Checklist signed off" (CLAUDE.md §9). This is that checklist: every
security, privacy and operations item deferred by an earlier milestone or by the 2026-09-28 audit,
with its source. Each milestone adds what it defers; an item leaves the list only when it is done
or a decision drops it.

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

## Logging, monitoring and alerting

- [ ] **Security events.** The structured logger exists since the audit fixes
      (`apps/web/src/lib/log.ts`, D-126). Left for M9: log security events through it (failed and
      rate-limited sign-ins, consent changes, account deletions, permission errors from database
      functions), never answer text or an email address (OBS-1, SEC-11).
- [ ] **Monitoring and alerting.** `/api/health` uptime, error rate, AI spend close to
      `ai.limit.global_daily_usd`, failed `DB deploy` runs and cron jobs, each alerting the owner
      (OBS-3). The audit proposed adding this to M9's definition of done in CLAUDE.md §9; that text
      changes only with the owner's approval.

## Personal data

- [ ] **Download my data** on `/account`: the same tables as
      [data-requests.md](../runbooks/data-requests.md), read under row level security, returned as
      JSON, with an end-to-end test (PRIV-10).
- [ ] **Deletion versus records that must be kept** (payments, commissions, audit log): what
      survives, and how it is anonymised (#31).
- [ ] **Auth audit log.** Emails and IP addresses in Supabase's auth audit log outlive a deleted
      account. Turn off its database storage, or purge it after 30 days and delete the user's
      entries in `delete_my_account()`; disclose IP and browser data on the privacy page; record the
      choice in [auth-setup.md](../runbooks/auth-setup.md) (PRIV-15).
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

## Sign-off

| Signed off by | Date | Commit |
| ------------- | ---- | ------ |
|               |      |        |
