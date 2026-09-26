# Open questions

Ambiguities, contradictions and missing requirements found in `CLAUDE.md` and `docs/SPEC.md`
(first review 2026-09-24). Numbers are stable: refer to them as `#35`.
The tag is the milestone that needs the answer. When an item is resolved, record the decision in
[DECISIONS.md](DECISIONS.md) and mark it here.

**Resolve early (may force redesign):** #15 (PayPal receiving in Jordan), #35 (quick mode
cannot reach the summary threshold), #61 (owner answer on accounts).

## A. Files and milestone order

1. `M0` **Resolved (D-001):** docs moved into the repository.
2. `M3` Rule 5 names `lib/ai/deidentify.ts`; CLAUDE.md §7 has no `lib/` and puts AI code in `packages/ai/`. Which path?
3. `M3` First LLM calls happen in M3 (dialect normalization, R-rule classification), but de-identification tests are only in M6's definition of done and cost logging and consent come later. Rule 5 means de-identification must ship in M3.
4. `M5` T6 (basic competitor matrix) is marked MVP but appears in no milestone; its report section is not marked ●.
5. `M4` The M4 golden file for the Algerian auto-entrepreneur needs tax rules that are only verified from official sources in M5.

## B. Access, entitlements and vouchers

6. `M7` Alumni ($15) get the unlimited tier including quarterly refresh, which is more than Monthly ($17). Intended? Who qualifies as alumni, and how is it verified?
7. `M7` Weekly "1 full report": per purchase, per project or per 7 days? Two weekly purchases in a row?
8. `M7` Durations of `weekly` / `monthly` / `annual` voucher types. Is a monthly voucher 30 days, non-recurring?
9. `M7` Free retention of 30 days: from creation or last activity? Hard delete afterwards? What happens on downgrade (e.g. 7 projects on a 3-project plan)?
10. `M7` What does "quarterly market refresh" update in the MVP, given T5 and T11 are v2?
11. `M7` Voucher lock: 5 failures within what window, locked for how long?
12. `M7` Student exception: how is "not finished secondary school" known at issue time, and which year's 30 September? Needs an explicit per-voucher deadline. These students cannot pass the signup gate until they finish school: intended sequence?
13. `M7` Shape of `commission_rule` (fixed or percent of what, when course codes cost the user $0). Do affiliates go through the eligibility gate?
14. `M7/M9` Risk: `VIVA` + 8 hex is 32 bits; per-account and per-IP locks do not stop guessing across many free accounts. Add global failed-attempt monitoring?

## C. Payments

15. `now` Confirm the Jordan-registered PayPal business account can receive payments and run Subscriptions (PayPal has restricted receiving in several MENA countries).
16. `M7` Source and refresh schedule of the JOD display rate.
17. `M7` Are cards required at launch? The MVP takes PayPal only while the card gateway is undecided.
18. `M7` No tables for orders/payments, PayPal webhook events (idempotency), commissions or refunds.

## D. Language and currency

19. `M3` Arabic text for follow-ups and the R3, R4, R6, R7 responses is missing. Draft for approval?
20. `M3` Algerian amounts are often spoken in centimes ("مليون" commonly = 1,000,000 centimes = 10,000 DZD). Needs a clarification rule like "دينار" to avoid 100× errors.
21. `M3/M4` Conversion rule, rate source and date for mixed currencies inside one project.
22. `M4` Algeria: "all calculations in DZD" vs F8 letting the user choose the report currency.
23. `M3` Other ambiguous currency words needing a question ("ريال", "ليرة", "دولار")?

## E. Eligibility, consent, privacy and markets

24. `M2` The platform is 18+ (D-059); before enabling Algeria, decide whether Algerian users must be 19+. Algeria's age of majority is 19 (Civil Code; legal to confirm). The adult check and G6 should depend on country.
25. `M2` **Partly resolved (D-059):** signup already requires 18+, so G6 only matters where the legal age to register a business is higher (Algeria: 19, see #24). Original note: G6★ repeats the signup 18+ declaration and uses a quick-mode slot. Pre-fill or ask again?
26. `M2` **Obsolete (D-059): no guardian flow; the platform is 18+ only.** Original note: Guardian consent: how long an account may stay pending, data held meanwhile, resends, refusal.
27. `M2` When cross-border consent is asked, and what a user who refuses can still do.
28. `M2` How an "Algerian visitor" is identified (IP, declared country, phone). Can a Jordanian account create a project with A1 = Algeria while the flag is off?
29. `M2` Legal risk: the DZ waitlist already stores Algerian residents' data in the EU; Law 18-07 may restrict that transfer.
30. `M2` Use `public.profiles` keyed to `auth.users` instead of SPEC's `users`, without storing email twice. Missing tables and fields: tasks (created by R4/B5), sessions/devices, failed voucher attempts, consent-text version, `source_url` / `retrieved_at` on stored values.
31. `M9` One-click deletion vs financial records that may have to be kept (payments, commissions, audit log). What survives, anonymized?
32. `M2` Email provider for auth and digests (must be named in the privacy policy; Supabase's built-in email is not for production).
33. `M0` **Resolved (D-037): the platform is "Startup Brand Name" on startupbrandname.com.** Earlier note (D-022): standalone app on `startupbrandname.com`, confirmed by the owner on 2026-09-25 as their domain, to be connected to Vercel production. Public records (2026-09-25): registrar Unstoppable Domains, nameservers at atom.com and sedoparking.com (parked). Still open: does the owner control its DNS, and does the product brand change from "Vivarise" (affects UI copy and CLAUDE.md §2)?
34. `M2` Is fra1 pinning for latency or for EU data residency? If residency, Anthropic (US), PayPal, Vercel logs and builds are already outside the EU and consent must say so.

## F. Question bank and completeness

35. `M3` **Contradiction:** with equal weights inside each axis, the 20 ★ questions reach 38.4% completeness (A 2/8×5 + B 3/8×12 + C 3/8×20 + D 3/8×15 + E 1/8×10 + F 5/8×25 + G 1/8×5 + H 2/8×8 = 38.375%), below the 40% summary threshold.
36. `M3` Do optional questions (B6), follow-ups and "لا أعرف" assumptions count as complete?
37. `M3` Undefined field types: `text`, `currency`, and the combined types (`multi + text`, `boolean + text`, `boolean + percent`, `single + peak months`, `3 × number`, `3 × short_text`, `long_text / steps`, conditional C2, `range + currency`). Missing option lists: D2 sectors, H5, G5, A3, C7, C2 bands.
38. `M3` Do R1 and R5 apply to every text field or only the questions named in the Logic column?
39. `M5` **Contradiction:** T17 JO checks `B7 ∈ {food, cosmetics}`, but B7 options are product / service / digital / hybrid; food and cosmetics are D2 sectors.
40. `M5` T17 DZ needs an ANAE activity code (no question collects it) and a "goods import" signal (D6 mixes imports and FX exposure).
41. `M3` Cross-type comparisons: F5 (amount) vs A5 (range + currency); A7 and H5 buckets vs BE_month. Which bound, which currency?
42. `M5` The full-report gate requires F1, F3, F4, F5 but not F6 (sales) or F8 (currency), which T9 needs.

## G. Engine formulas

43. `M4` **Inconsistency:** T8 break-even uses FC = ΣF4 only; T9 opex = F4 + E8 payroll + marketing. BE_units and BE_month will disagree.
44. `M4` No question collects a marketing budget (T9, CAC), churn or ARPU (subscription LTV).
45. `M4` Sales curve between months 1, 6 and 12 (linear, geometric?). No input covers growth in years 2 and 3.
46. `M4` How D7 peak months become seasonal multipliers, and how they are normalized.
47. `M4` Only COGS escalates with inflation, not prices or fixed costs. Intended?
48. `M4` Flat-rate tax model cannot express progressive brackets (to verify with Jordan's Income and Sales Tax Department), pass-through sales tax, or CASNOS contributions. Which month does annual tax hit the cash flow?
49. `M4` Payment delays for credit, instalments and deposit (F7).
50. `M4` Payback: pre- or post-tax profit, horizon, output when never profitable.
51. `M4` T7 "average expected monthly units": over which months?
52. `M4` T10 launch delay: do fixed costs still start in month 0?
53. `M5` T18 `(4 − confidence) × sensitivity rank`: confidence has no numeric mapping, and if rank 1 is most sensitive the formula favours the least sensitive variable.
54. `M4` Money precision and rounding (JOD has 3 decimals): integer minor units or a decimal library; display vs calculation rounding.
55. `M5` Is the verdict decided by fixed thresholds or by the LLM? Which "3 numbers" go in the executive summary? How is "overall confidence" computed?

## H. Report, design and AI

56. `M5` Banning "فائدة" (G7 = yes) also blocks its everyday meaning "benefit". Ban only in financing contexts?
57. `M1/M5` **Resolved (D-051).** **Contradiction:** "BMC mirrored, starting at the right with customer segments". The standard canvas already has customer segments on the right; mirroring moves them left.
58. `M3` Free users trigger Haiku calls on 64+ answers with no free-tier AI limit defined.
59. `M6` Is the mentor's "~1 page project summary" built by code or by the LLM?
60. `M7` Vercel Cron or pg_cron per job (Vercel Hobby cron runs at most daily).

## Added 2026-09-24

61. `M0` **Resolved (D-036).** Owner's answer to "Supabase: new Vivarise organisation, staging on Free, production on Pro before M2?" was: "I will provide you with all emails [that] have free access for the first year." Meaning unclear: which Supabase (and Vercel) account should host the projects, and on which plan?

## Added 2026-09-25

62. `M3+` **Partly answered (D-035): in scope, milestone to be set.** Business-name finder: the owner described the product as "creating a business model and finding a business name". SPEC has no naming tool; only G5 asks whether the founder already has a trade name or protected mark. New feature? If yes: which milestone, and which official sources check availability (trade-name registers, trademark offices, domains)? Rule 9 forbids claiming a name is available without a verified source. Owner supplied about 2,000 candidate .com names on 2026-09-25; a registry (RDAP) spot check of 12 that day found 8 unregistered and 4 registered and listed for sale via Atom/Afternic, so "available" changes by name and by day and must be checked live.
63. `M7` Free year for course trainees (D-038): the owner will supply the full details. Needed: who issues the Viva Rise codes and how batches reach us; is Viva Rise recorded as the affiliate, and does it earn commission on activation (#13); do these students have to pass the secondary-school gate (#12)?
64. `M0` **Resolved 2026-09-25:** DNS moved to Unstoppable Domains nameservers and points to Vercel; the site is live on HTTPS from `fra1`. Original note: DNS control for `startupbrandname.com`: the domain is still held in the owner's Atom account (parked on Sedo). The owner must get it transferred, or its DNS changed, before it can point to Vercel.
65. `M1` **Resolved in part (D-050): lockup A.** Brand: the UI is Modern Standard Arabic only, but "Startup Brand Name" is English. Is there an Arabic form of the name for the logo and headings? "Startup Brand Name" is also a descriptive phrase, which trademark offices often refuse; registrability in Jordan (and Algeria) should be checked before investing in the brand.
66. `M2b` AI crawler policy for public pages (D-054): allow AI search/answer crawlers only, or also AI training crawlers? Private app routes are blocked either way.
67. `M2b` URL slugs for public pages: Latin/English (`/guides/break-even`, recommended) or Arabic (percent-encoded when shared)?
68. `M2b` Analytics: cookieless Vercel Web Analytics plus Search Console and Bing Webmaster Tools (recommended), or Google Analytics 4 (needs a consent banner and adds a processor)?
69. `M2b` Content ownership: who writes and approves public guides, the glossary and the founder biography (E-E-A-T)? Claude can draft in MSA; facts, country rules and credentials need the owner's review.
70. `M0` The Supabase GitHub integration deploys migrations to production automatically on every push to `main`, bypassing the approval gate in D-047. The owner should switch off its production deploy, or D-047 must change.
71. `M7` Course trainees under 18 (D-059): CLAUDE.md §3 extends the voucher activation window to 30 September after exams for students who have not finished secondary school. Some of them may still be under 18 on that date and cannot sign up. Extend the window until they can, limit the course codes to adults, or accept that those codes expire?
