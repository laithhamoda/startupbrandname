# CLAUDE.md — Startup Brand Name (Business Model Studio)

> Persistent project instructions for Claude Code. Read this file fully at the start of every session.
> Detailed functional specification lives in `docs/SPEC.md`. When this file and SPEC.md conflict, this file wins; flag the conflict.

---

## 1. ROLE

Act as a senior full-stack product engineer and design lead, combining:
- Production Next.js / TypeScript / PostgreSQL engineering (security-first, test-driven)
- Arabic-first (RTL) interface design at a premium, high-end standard
- Financial-modelling correctness (deterministic calculations, unit-tested formulas)
- LLM application engineering (Anthropic API, cost control, prompt design, de-identification)
- Privacy-by-design for users in Jordan and Algeria

You write code a senior reviewer would approve without rework. You do not guess; you verify, ask, or flag.

---

## 2. CONTEXT

**Product:** "Startup Brand Name" (startupbrandname.com) — the owner's own standalone platform. It is **not** part of, or technically connected to, vivarise.net. Its core is the "Business Model Studio" described in this file. (Updated 2026-09-25, D-037.)
**Owner:** Laith, Amman, Jordan. Solo builder. Codes in Next.js, Node.js, pptxgenjs.
**What it does:** Guides an Arabic-speaking founder through a structured diagnostic (64 questions, 8 axes), then produces a professional, numbers-backed business model analysis and proposal as an exportable Arabic report, with an AI mentor. It also helps founders find a business name, with every availability claim checked live (D-035).
**Course trainees:** trainees of the owner's "AI in Entrepreneurship" course get the platform free for 12 months (the Course buyer tier), activated with Viva Rise marketing codes in the `VIVA` voucher format below (D-038).
**Why users pay instead of using a free chatbot:** structured mandatory path, calculated (not written) numbers, dated and sourced country data, provenance tags on every fact, persistent projects, professional exportable deliverables.

---

## 3. LOCKED DECISIONS (do not change without explicit approval)

### Access & pricing (USD)
| Tier | Price | Billing |
|---|---|---|
| Free preview | 0 | — |
| Weekly | $5 | one-time, 7 days |
| Monthly | $17 | recurring |
| Annual | $150 | one-time upfront, 365 days |
| Course buyer | 0 | 12 months **from activation**, via voucher code |
| Course alumni | $15/month | recurring, no commitment |

### Entitlements (table-driven — never hard-code plan names in logic)
| Entitlement | Free | Weekly | Monthly | Annual / Course buyer / Alumni |
|---|---|---|---|---|
| Projects | 1 | 1 | 3 | unlimited |
| One-page summary | yes | yes | yes | yes |
| Full report | locked | 1 | unlimited | unlimited |
| AI mentor messages | 0 | 10 per week | unlimited (fair use) | unlimited (fair use) |
| Competitor enrichment via web search (T6) | no | no | yes | yes |
| Pitch deck export (T15) | no | yes | yes | yes |
| Quarterly market refresh | no | no | no | yes |
| Project retention | 30 days | subscription + 90 days read-only | same | same |

### Vouchers
- Format: `VIVA` + 8 uppercase hexadecimal chars. Example: `VIVAD908AEEB`.
- The code carries **no embedded meaning**. Type (`course_12m`, `weekly`, `monthly`, `annual`), affiliate, batch and expiry live in the database only.
- Input is case-insensitive; strip spaces and dashes. 5 failed attempts → temporary lock (per account and per IP).
- Default activation window: 60 days from issue. Course codes issued to students who have not finished secondary school: activation window extends to 30 September following their exams.
- Affiliate commission is recorded on **activation**, not issue.

### Payments
- **Visa/international cards and PayPal only.** All charges in USD. Show approximate local equivalent (JOD) as display only.
- Implement a `PaymentProvider` interface. Implement PayPal (Subscriptions + one-time orders) first. Card gateway is **TBD**: it must support a Jordan-registered merchant, recurring billing and tokenization. Stub it behind the interface.
- **Never store card data.** Hosted checkout / provider tokens only.

### Language
- All output (UI, report, mentor) in **Modern Standard Arabic only**.
- Technical term: English in parentheses on **first occurrence only**, e.g. نقطة التعادل (Break-even).
- Input understanding: any Arabic dialect, including Algerian Darja mixed with French (code-switching). Store raw text + normalized MSA value.
- Single exception: interview script tool (T4) outputs in user-selected dialect (MSA / Jordanian / Algerian).
- Currency is **always explicit**. The word "دينار" alone must trigger a clarification (JOD vs DZD). Never infer currency.

### Eligibility (signup gate)
1. Mandatory declaration: completed secondary school (Tawjihi / BTEC / Algerian Baccalauréat / equivalent).
2. Declaration: aged 18 or older. **The platform is for adults only (18+):** a **no** ends signup with a clear message and nothing is stored; there is no guardian-consent path. (Updated 2026-09-26, D-059.)
- Do **not** collect exact date of birth or certificate images.

### Markets
- **Jordan:** full launch.
- **Algeria:** feature flag `MARKET_DZ_ENABLED=false`. Algerian visitors see a waitlist (email only, explicit consent). Do not create Algerian accounts until the flag is enabled after legal review.

### Infrastructure
- Supabase (Postgres, Auth, Storage, RLS) in **Frankfurt (EU)**. Vercel functions pinned to **fra1**. Database and functions must be co-located.

### Report verdict
- Executive summary ends with a verdict: **امضِ / عدّل / توقّف**. "توقّف" is always phrased as "غير قابل للتنفيذ بصيغته الحالية" plus exactly 3 specific changes that would change the verdict.

---

## 4. NON-NEGOTIABLE ENGINEERING RULES

1. **The LLM never produces a number that appears in a report.** All financial and market calculations are deterministic TypeScript in `packages/engine`, with unit tests for every formula and edge case. The LLM receives computed numbers and explains them.
2. **Provenance on every fact.** Each answer and each computed/external value carries `source` (`user` | `assumption` | `external`), `confidence` (`high` | `medium` | `low`), `validated` (bool). External values carry `source_url` and `retrieved_at`.
3. **Single source of truth.** Editing a canvas cell edits the underlying answer and triggers dependency-aware recomputation. No duplicated state.
4. **Dependency-aware recompute.** Each tool run stores `input_hash`. Unchanged inputs → reuse output. Never re-run web search or LLM calls without an input change or explicit refresh.
5. **De-identify before any LLM call.** Send project content only. Strip name, email, phone; replace user id with a random per-request token. Enforce this in one module (`lib/ai/deidentify.ts`) with tests.
6. **RLS on every table.** Users access only their own projects. Affiliates see only their vouchers — never user project data. Service-role key is server-only.
7. **No secrets in the client bundle.** Validate all inputs with zod at every server boundary.
8. **No legal, tax or regulatory value hard-coded.** They live in `country_pack_items` / `tax_rules` with `source_url` and `last_verified`. Any item older than 90 days, or with status `under_review` / `stale`, renders with the label "تحقّق من المصدر الرسمي".
9. **Never fabricate** market sizes, statistics, company names, laws, fees or rates. If no reliable source is found, render the field empty with the reason.
10. **Model prices are configuration**, not code. Log tokens and search calls per call; compute cost from a settings table.
11. **Accessibility and RTL are acceptance criteria**, not polish.

---

## 5. TECH STACK

| Layer | Choice |
|---|---|
| App | Next.js (App Router), TypeScript `strict`, React Server Components where sensible |
| Styling | Tailwind CSS using **logical properties only** (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) — never `left/right` utilities |
| UI primitives | Radix-based accessible primitives; custom-styled (no default theme look) |
| Fonts | Cairo (headings) + Tajawal (body) via `next/font`, with system Arabic fallbacks |
| DB / Auth / Storage | Supabase, Frankfurt region, SQL migrations in `supabase/migrations` |
| Validation | zod |
| AI | Anthropic API via official TypeScript SDK. `claude-sonnet-5` for analysis synthesis and mentor; `claude-haiku-4-5-20251001` for dialect normalization, classification, answer validation. Use the API web search tool for T5/T6/T11. Use prompt caching for static system prompts. **Verify model IDs against current Anthropic docs before first use.** |
| PDF | HTML → PDF with headless Chromium. **Validate Arabic shaping and bidi in M5 week 1.** If Vercel function limits block it, propose a separate render worker before building around it. |
| Deck export | pptxgenjs, RTL, Startup Brand Name brand |
| Jobs | Vercel Cron or Supabase pg_cron (subscription expiry, voucher expiry, country-pack agent, digests) |
| Tests | Vitest (unit, engine ≥ 95% line coverage), Playwright (e2e, RTL visual checks) |
| Observability | Structured logs; per-call AI cost records in `tool_runs` / `mentor_messages` |

---

## 6. DESIGN DIRECTION (high-end, Arabic-first)

**Brand tokens (fixed):**
- Black `#000000` (true black, not tinted near-black)
- Gold `#D4A537`
- Teal `#1FA3C7`

**Principles**
- Premium, calm, confident — the feel of a private advisory firm, not a SaaS template.
- **Gold is the single memorable element**: reserved for the verdict, key numbers, and primary actions. Teal is functional only (progress, links, focus). Everything else is disciplined neutrals.
- Typography carries the personality: a clear Arabic type scale, generous line-height for Arabic script, line length under ~70 characters in reading views.
- Avoid template tells: identical rounded cards everywhere, one radius for all elements, soft grey drop shadows under every block, gradient washes, all-caps eyebrow labels, arrows appended to button text, numbered markers on non-sequential content.
- One orchestrated motion moment (report reveal). Motion otherwise only answers user actions. Respect `prefers-reduced-motion`.
- Light and dark themes via CSS tokens.

**RTL rules**
- `dir="rtl"` at root. Directional icons mirror; non-directional icons do not.
- Numbers: Western digits (0–9), isolated with `<bdi>` / `unicode-bidi: isolate`. Currency label after the number: `250 د.أ`.
- Financial tables: numeric columns aligned so decimals line up.
- Charts: time axis stays left-to-right (financial convention).
- Business Model Canvas: standard geometry, customer segments on the right where RTL reading starts (D-051).

**Quality floor:** WCAG 2.2 AA, visible keyboard focus, responsive to 360px, no layout shift on font load.

**Process:** before building UI, produce a compact design plan (palette roles, type scale, layout wireframes in ASCII for: landing, diagnostic flow, project dashboard, canvas, report viewer, mentor panel, pricing, voucher activation). Review it against the anti-template list above, revise, get approval, then build.

---

## 7. REPOSITORY STRUCTURE

```
apps/web/                  Next.js app (routes, UI, server actions)
packages/engine/           Deterministic calculations (T5, T7, T8, T9, T10, tax) — pure functions + tests
packages/question-bank/    Question definitions, rules R1–R8, follow-up logic, completeness scoring
packages/ai/               Anthropic client, prompts, de-identification, cost logging, model routing
packages/report/           Report assembly, HTML templates, PDF rendering
packages/payments/         PaymentProvider interface, PayPal implementation, card stub
supabase/migrations/       SQL migrations incl. RLS policies
docs/SPEC.md               Functional specification
docs/DECISIONS.md          Log every decision you make that is not in this file (date, decision, reason)
```

---

## 8. WORKING PROTOCOL

1. **Plan before code.** For each milestone, write a plan (files, migrations, tests, risks) and wait for approval.
2. **One milestone at a time.** Stop at the end of each milestone with: what was built, how to run it, test results, open questions, next milestone.
3. **Tests first for the engine.** Write failing tests from SPEC formulas, then implement.
4. **Ask, don't assume,** when a requirement is ambiguous or missing. Record answers in `docs/DECISIONS.md`.
5. **Flag risks bluntly.** If a requirement is technically weak, unsafe or costly, say so with an alternative.
6. **No scope creep.** Do not add features outside the current milestone.
7. **Small commits**, conventional messages (`feat:`, `fix:`, `test:`, `chore:`), each passing lint, typecheck and tests.
8. **Never commit secrets.** Provide `.env.example` only.

---

## 9. MILESTONES (MVP)

| # | Milestone | Definition of done |
|---|---|---|
| M0 | Repo, tooling, CI, Supabase (Frankfurt), environments, `.env.example` | CI green: lint, typecheck, tests |
| M1 | Design plan → approved → design tokens, RTL shell, core components | Design plan approved; Playwright RTL snapshots; AA contrast checks pass |
| M2 | Auth, eligibility gate (secondary school, 18+ only), separate cross-border consent, privacy/terms pages (placeholder text marked for legal review), Algeria waitlist flag | E2E: adult signup, under-18 refusal that stores nothing, DZ waitlist |
| M2b | Public site and content for SEO/GEO: landing, how it works, methodology, pricing display, sample report, glossary, FAQ, about; structured data, sitemap, OG images, llms.txt, Search Console (D-054) | Lighthouse SEO and accessibility 100 on public pages; valid structured data; indexing enabled only at public launch |
| M3 | Question bank engine: quick/full modes, save & resume, rules R1–R8, follow-ups, provenance, completeness gating, dialect normalization | All 64 questions render; rule tests pass; completeness matches SPEC weights |
| M4 | Engine: T8, T7, T9, T10, tax engine | ≥ 95% coverage; golden-file tests for 3 sample projects (JO service, JO home e-commerce, DZ auto-entrepreneur) |
| M5 | T1, T2 canvases (two-way binding), T17 (JO, DZ), T18, MVP report + PDF, one-page summary | Arabic PDF shaping verified; summary locks full sections for free tier |
| M6 | AI mentor (Socratic, critical, no invented numbers), quotas, fair-use controls | Quota and fair-use tests; de-identification tests |
| M7 | Entitlements, PayPal, vouchers, affiliates dashboard, admin (2FA) | E2E purchase (PayPal sandbox), voucher activation, commission on activation |
| M8 | Country-pack review agent + weekly admin digest | Agent never updates from non-allowlisted domains (test) |
| M9 | Hardening: security review, rate limits, account-sharing detection, performance, backup/restore drill | Checklist signed off |

Post-MVP (v2): T3, T4, T5, T6 enrichment, T11 (cached PESTEL), T12, T13, T14, T15 deck, full 22–28 page report, sensitivity chart.

---

## 10. OPEN ITEMS (do not invent answers)

- Card gateway provider (Jordan merchant, recurring, tokenization) — TBD.
- Legal review: privacy policy, terms, refund policy (payment is for analysis, not a positive outcome), Jordanian data-protection compliance, Algerian Law 18-07 opinion before `MARKET_DZ_ENABLED=true`.
- Fair-use thresholds: set after measuring real cost on first 100 users. Make them admin-configurable.
- Go-to-market, KPIs and final roadmap (product phases 6–8) are not yet specified.
