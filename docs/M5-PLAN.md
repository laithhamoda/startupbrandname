# M5 plan: canvases, report and PDF

Status: proposed on 2026-10-11 with the owner's answers folded in; it becomes the working plan when
this pull request merges. The choices are recorded as D-225 to D-237 in [DECISIONS.md](DECISIONS.md).
The owner-facing version is a private Arabic page; this file is for the people and agents who build it.

## 1. Scope

CLAUDE.md §9, M5: the T1 and T2 canvases with two-way binding, T17 (JO, DZ), T18, the MVP report
and its PDF, and the one-page summary. Definition of done: Arabic PDF shaping verified, and the
summary locks the full sections for the free tier. M5 is the first time a founder sees an engine
figure (D-178). Everything in it works without AI (D-062); AI only improves wording (D-226).

## 2. Where we start

Present: `projects`, `answers` with provenance, `tool_runs` (owner can read it; written only by
`record_ai_run`, because `record_tool_run` was dropped by D-191), `settings`, `usage_counters`, the
AI reservation ledger; `@sbn/engine` 1.0.0 with `runEngine`, the canonical serialiser, three golden
projects and the owner review page; `@sbn/ai` (client, `deidentify`, cost, fake provider);
`config/plans.ts` (display only); the project page and the diagnostic; the component gallery.

Missing: `tax_rules`, `country_pack_items`, `reports` and the report bucket; a recorder for engine
runs; entitlement checks; verdict, confidence and T18 logic; the question-to-canvas map; every
canvas, summary and report screen; print fonts and the PDF renderer; the report message catalogs;
T17 content; the Anthropic key in Vercel; Vercel Pro (D-021, the team is on Hobby today).

## 3. Steps

Sequential. Each step is a pull request (step 0 may be two), reviewed independently and merged after
the six checks and CodeQL, under the merge rule the owner gives for M5. The lead pushes and merges.

### Step 0: the PDF spike (`packages/report`, `apps/web`)

- Delivers: Arabic, English and digits rendered to PDF by headless Chromium behind a launcher
  abstraction (`@sparticuz/chromium` on Vercel, a local executable path in CI and on a laptop);
  Cairo and Tajawal embedded; measurements on a Vercel preview (cold start, duration, memory,
  bundle size) from a temporary route that returns 404 unless a preview-only token matches.
- Files: `packages/report/src/render/`, `packages/report/fonts/` (OFL licences included),
  `packages/report/src/fixtures/`, tests that extract text from the PDF and check shaping, logical
  order, embedded fonts and the page count.
- Gate: a decision records Vercel function or a separate render worker (a new processor, so the
  owner approves it before anything is built around it, CLAUDE.md §5). The temporary route is removed
  in step 6.
- Risks: Hobby limits, Chromium size, font fallback, bidi of isolated digits.

### Step 1: data foundations (`supabase/`, `apps/web`)

- Migrations, expand-only: `tax_rules` (SPEC §8 plus D-216: legal form, levy, kind, brackets, fixed
  amount, payment month, status), `country_pack_items`, `reports`, a private `reports` bucket with
  owner-only policies on the path `{user_id}/{project_id}/{report_id}.pdf`, a recorder for engine
  runs (`record_engine_run`, writing `engine_version`), settings rows (PDF daily limit). pgTAP for every
  policy; `pnpm db:types`.
- App: `lib/entitlements.ts` reading `config/plans.ts` (everyone is `free` until M7), the server-only
  `FULL_REPORT_PREVIEW_EMAILS` allow-list for the owner, env schema and `.env.example`, the processing
  register entry for stored reports.
- Risks: storage policies; the allow-list must not exist in production after M7.

### Step 2: the verdict in the engine (`packages/engine`, `packages/question-bank`)

- Delivers: the feasibility score and the verdict (D-227), the changes that would change it (D-228),
  overall confidence and the three numbers (D-229), the T18 ranking (D-230); `ENGINE_VERSION` 1.1.0;
  golden files regenerated (the diff is the review); the owner review page extended with good, bad and
  borderline projects; `FULL_REPORT_QUESTIONS` gains F6.
- Files: `src/feasibility.ts`, `verdict.ts`, `changes.ts`, `confidence.ts`, `validation-plan.ts`,
  `params.ts` (thresholds as named assumptions), `run.ts`, tests and goldens.
- Tests: truth tables, boundary cases at exactly 75% and exactly twice the capital, determinism, and a
  property test that improving price, variable cost, fixed cost or sales never worsens the score.
- Risks: verdict credibility (tune with the owner on the review page); search cost (budgeted).

### Step 3: the canvases T1 and T2 (`packages/report`, `apps/web`)

- Delivers: the canvas map (D-231), pure builders for both canvases, the page
  `/projects/[id]/canvas` with a Business Model Canvas tab and a Lean Canvas tab in the geometry of
  D-051, provenance marks, chips that edit the underlying answer with the diagnostic's own editors and
  actions, recompute by input hash through the engine recorder, a phone layout, ar and en messages.
- New question: one follow-up, C7.1 (customer relationships), as a draft for the owner's review.
- Tests: unit (map, builders), e2e (edit a chip, the answer saves, numbers change), accessibility,
  RTL and phone snapshots (baselines come from the manual workflow, D-055).
- Risks: cells fed by several answers; editing semantics; mobile.

### Step 4: country data and T17 (`packages/report`, `supabase/`, `docs/`)

- Delivers: the T17 rules as pure functions over answers and pack items; seed migration for JO and DZ
  from official sources only (D-233), each item with `source_url`, `last_verified` and a status; the
  official-link and advisor lines every report shows; the label rule for items older than 90 days or
  `under_review` (CLAUDE.md rule 8); the allowed-domain list in `settings`.
- Tests: rules, seed validity (https, allowed domain, date, status), label logic.
- Risks: legal accuracy; sites in Arabic or French PDFs; nothing is invented, and a tax rule is
  stored only when it was read on an official page.

### Design gate: the four print pages

An HTML mock of the cover, the executive summary, the landscape projection table and the validation
plan, for the owner to approve or change before step 5 (CLAUDE.md §6, D-053).

### Step 5: the summary and the report on screen (`packages/report`, `apps/web`)

- Delivers: `ReportModel` (JSON-safe, formatted, per locale) built from the run, the answers, the
  pack and the verdict; the one-page summary; the full report at `/projects/[id]/report` with a
  contents list, the verdict slab and its one reveal motion, the highlight for low-confidence pivotal
  numbers, the assumptions register, the disclaimer; locked sections for the free tier decided on the
  server (D-232); message catalogs `messages/ar.ts` and `en.ts` with a parity test.
- Tests: golden `ReportModel` for the three golden projects; a leak test that proves locked values
  are absent from the HTML and the RSC payload; e2e, accessibility, reduced motion, snapshots.
- Risks: leakage of paid content; size.

### Step 6: the PDF (`packages/report`, `apps/web`)

- Delivers: print CSS and the template rendered from the same `ReportModel`; `renderPdf`; the route
  `POST /api/projects/[id]/report/pdf` (auth, entitlement, daily limit, render, store, short-lived
  signed URL, `reports` row); deletion of stored files in the account-deletion flow with the user's own
  session, and a note for the M9 retention job.
- Hardening (D-235): text rendered as escaped text, JavaScript off, every network request aborted,
  fonts embedded, tagged PDF and outline if the renderer supports them.
- Tests: text extraction in CI (order, shaping, digits), fonts, pages, no network, e2e download.

### Step 7: AI wording and the English pass (`packages/ai`, `packages/report`)

- Delivers: prompts for canvas wording, the executive summary and risks, and T18 phrasing; the number
  guard (D-226); consent, quota and cost records; results cached by input hash; the English report
  checked end to end. Needs the Anthropic key and a spending cap from the owner.
- Tests: fake provider, guard failures fall back to the template, prompt-injection fixtures.

## 4. Cross-cutting

- Languages: every report string exists in Arabic and English from the first commit; a parity test
  fails the build otherwise. Western digits, `bdi`, the currency after the number.
- Quality gates (D-237): the engine keeps its gates; `@sbn/report` gets coverage thresholds; the
  PDF tests run in CI against the pinned Playwright image.
- Privacy: the PDF carries the project title only, never a name or an email. Stored reports follow the
  project's retention. A render worker would be a new processor and needs the owner and the privacy
  register first.
- Cost: wording is generated once per input hash and only for the paid report; the free summary uses
  deterministic text. PDF generation has a daily limit per user.

## 5. Not in M5

The mentor and the skills and personality session (M6), payments and plans (M7), the country-pack
agent (M8), charts, T3, T4, T5, T6, T11 to T15, the pitch deck, public calculators, and a public
sample report.
