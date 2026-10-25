# M7 plan: payments with Paddle, entitlements, vouchers, affiliates, admin

Status: proposed on 2026-10-25; it becomes the working plan when this pull request merges. The
payment provider is decided in D-309 (Paddle as merchant of record, replacing direct PayPal and the
undecided card gateway). The owner-facing summary is in Arabic in the chat; this file is for the
people and agents who build it.

## 1. Scope

CLAUDE.md §9, M7: entitlements, payments, vouchers, the affiliates dashboard, admin with 2FA, and
the age check (18+) at payment (D-086). Definition of done: an end-to-end purchase in the Paddle
sandbox, voucher activation, and commission recorded on activation.

Out of scope: the per-project pricing proposal of 2026-10-24 is not decided (see §6, Q1); this plan
keeps the catalog table-driven so either pricing model fits without code changes in logic. Local
currency display (OQ #16) stays off: every charge and every shown price is USD.

## 2. Where we start

Present: `config/plans.ts` (the plan table, display only), `lib/entitlements.ts` (`accessFor`, every
account `free`; preview list and early access, D-245, D-290), the report access model,
`usage_counters`, `settings`, `profiles`, `consent_events`, the pricing page and FAQ (display only),
an empty `@sbn/payments` package.

Missing: any provider code, `subscriptions`, payment and webhook tables, vouchers, affiliates,
commissions, an admin area, MFA, the age check, a billing page, Paddle in the privacy and terms
pages.

## 3. How a payment works

```
pricing page → age check (18+, recorded) → server creates a checkout reference
  → Paddle.js overlay checkout (card, PayPal; Paddle is the seller)
  → Paddle sends a signed webhook → we verify, store the event once, update `subscriptions`
  → `accessFor` reads the active subscription → the plan table grants the entitlements
```

- The browser never grants access. Only a verified webhook (or a server call to the Paddle API that
  reconciles a missing one) changes `subscriptions`.
- Paddle receives an opaque `checkout_ref` in `custom_data`, never our user id, and the buyer's
  email for the receipt. No card data touches our servers (CLAUDE.md §3).
- Renewals, cancellation, card changes: the Paddle customer portal, linked from our billing page.
- Refunds and chargebacks arrive as `adjustment.*` events and end or shorten the access they paid
  for.
- Vouchers never touch Paddle: activation writes a `subscriptions` row with `source = 'voucher'`.

## 4. Steps

Sequential. Each step is one pull request, reviewed and merged after the checks and CodeQL, under
the owner's merge rule. Steps 1 to 9 use the Paddle sandbox only. Nothing goes live before step 10.

### Step 0: feasibility (owner and lead, no code)

- Owner: opens a Paddle sandbox account and a live account application; asks Paddle support:
  (a) is a Jordan-registered seller accepted, and how are payouts made; (b) fees on items under
  $10; (c) can checkout be shown in Arabic.
- Lead: reads `allow_sales` from the countries API for JO, DZ and the main Arab markets; reads
  Paddle's buyer terms and refund policy against D-299; lists the website-approval requirements.
- Gate: if Jordan is refused, stop and return to the owner (fallback: direct PayPal as in the old
  §3). Result recorded as a decision.

### Step 1: data model (`supabase/migrations`, pgTAP)

- `billing_products(plan_id, provider, provider_price_id, active)`: maps the plan table to Paddle
  prices; no price amount is duplicated (the plan table owns it, a test compares both).
- `subscriptions(id, user_id, plan_id, source paddle|voucher|admin, status, starts_at, ends_at,
provider_subscription_id, provider_customer_id, updated_from_event_at)` (SPEC §8).
- `payments(id, user_id, subscription_id, provider_transaction_id unique, amount_usd, status,
occurred_at)`: kept for accounting after an account deletion, de-linked from the user (OQ #31).
- `payment_events(provider_event_id unique, type, occurred_at, processed_at, result)`: idempotency;
  the payload is not stored beyond the fields we use.
- `checkout_refs(ref, user_id, plan_id, age_confirmed_at, created_at, expires_at)`.
- RLS: a user reads their own subscriptions and payments; nobody writes them from the client; all
  writes go through security-definer functions called with the service role.

### Step 2: `@sbn/payments`

- `PaymentProvider` interface: `createCheckout`, `verifyWebhook(rawBody, headers)`,
  `parseEvent → NormalizedEvent`, `customerPortalUrl`, `getSubscription` (reconciliation).
- Paddle implementation on the official Node SDK (version pinned and checked at the time), plus a
  fake provider for tests. Unit tests on signed sandbox event fixtures, including a forged signature,
  a replay, and events out of order.

### Step 3: webhook route (`apps/web/src/app/api/payments/webhook`)

- Node runtime, fra1, raw body; reject unsigned or stale events; store the event id first, then
  apply; an older event never overwrites a newer state (`updated_from_event_at`).
- Handled: `transaction.completed`, `subscription.created|updated|canceled|past_due`,
  `adjustment.created|updated` (refunds, chargebacks).
- A daily reconciliation job compares active subscriptions with the Paddle API and logs drift.

### Step 4: entitlements from the database

- `accessFor` reads the account's active subscription; plan resolution stays table-driven.
- Enforced here: project count, the weekly plan's one full report (OQ #7), mentor quotas through
  `usage_counters`, read-only retention after expiry (OQ #9). Early access (D-290) keeps working
  until the owner turns it off.

### Step 5: checkout and billing UI

- Pricing page buttons; the age check before checkout (wording from the owner, OQ #80; country age
  of majority, OQ #72 and #24); Paddle.js overlay in the user's language where Paddle supports it;
  a return page that waits for the webhook and says so honestly if it is late.
- Account billing page: plan, renewal or end date, receipts and the customer portal link, cancel.
- RTL, keyboard, AA contrast, Playwright snapshots in both languages.

### Step 6: vouchers

- `voucher_batches`, `vouchers` (SPEC §8), `voucher_attempts`. Normalise input (case, spaces,
  dashes); 5 failures lock per account and per IP (window and length: OQ #11); global failure
  monitoring for guessing across accounts (OQ #14).
- Activation windows: 60 days, `course_12m` 12 months from issue (D-060); course access is 12
  months from activation.

### Step 7: affiliates

- `affiliates`, `commissions` written on activation, never on issue. The dashboard shows an
  affiliate their own vouchers and commissions only, never user or project data (rule 6).
  Commission shape: OQ #13.

### Step 8: admin with 2FA

- Supabase MFA (TOTP), admin routes require `aal2` and an admin role; every action written to
  `audit_log`. Functions: issue voucher batches, view subscriptions and payments, grant or end an
  `admin` subscription, see webhook drift. Refunds are made in the Paddle dashboard, not here.

### Step 9: end-to-end and security tests

- Playwright: a sandbox purchase through the real overlay (one test, may be marked manual if the
  sandbox iframe is unstable), plus CI tests that post signed simulated events to the webhook;
  voucher activation; commission on activation; MFA required on admin.
- Security review of the payment paths (rule 6 and 7, OWASP webhook checks).

### Step 10: going live (owner)

- Legal pages: Paddle named as reseller and merchant of record in the terms; Paddle replaces PayPal
  in the processor list (SPEC §10); the refund policy aligned with Paddle's (Q3).
- Paddle website approval; live keys in Vercel production only; Vercel Pro before taking money
  (D-021: Hobby is non-commercial); "migrate production" from the owner for the migrations.

## 5. Risks

- Paddle may refuse a Jordan-registered seller or the product category: step 0 gates everything.
- Paddle's refund policy applies to its buyers (14-day withdrawal right where consumer law gives
  it, first subscription payment included); D-299 must be amended to match.
- Fees of about 5% + $0.50 cost about 15% of the $5 weekly plan; Paddle quotes items under $10
  separately.
- Paddle may hold payouts during review or on disputes; cash flow should not depend on day one.
- Website approval needs a reachable site with pricing, terms, privacy and refund pages, while
  indexing stays off before launch (D-303).
- Paddle becomes a data recipient (buyer email, country, IP): privacy policy and cross-border
  consent text must name it.

## 6. Owner decisions needed

1. Pricing model: the locked time-based plans, or the per-project proposal of 2026-10-24. Needed
   before step 5 (prices are created in Paddle then).
2. Age check wording, and whether Algeria (19) and Egypt (21) need a higher age (OQ #72, #80).
3. Refund policy: accept Paddle's buyer refund rules and amend D-299.
4. The weekly $5 plan given Paddle's fee (tied to Q1).
