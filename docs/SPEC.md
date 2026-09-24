# docs/SPEC.md — Functional Specification

> Companion to `CLAUDE.md`. Place this file at `docs/SPEC.md`.
> Labels are Arabic (MSA). IDs and schema are English.

---

## 1. Diagnostic Question Bank

- 8 axes × 8 questions = 64 core questions + dynamic follow-ups.
- **Quick mode:** the 20 questions marked ★ (target 15–20 min). Feeds the free one-page summary.
- **Full mode:** all 64 + follow-ups, save & resume (target 60–90 min).
- Field types: `short_text`, `long_text`, `single`, `multi`, `number`, `money` (amount + currency), `range`, `country_city`, `line_items` (label, amount, currency), `percent_split`, `boolean`.

### A — المؤسس والموارد
| ID | Label (AR) | Type | Logic |
|---|---|---|---|
| A1★ | في أي دولة ومدينة ستعمل؟ | country_city | selects country pack |
| A2 | كم سنة خبرة لديك في هذا القطاع تحديداً؟ | number | if 0 → follow-up: who in your circle has this experience? |
| A3 | ما المهارات التي تملكها وتخدم المشروع مباشرة؟ | multi + text | reject "كل شيء" |
| A4 | هل لديك فريق أو شركاء؟ اذكر أدوارهم | line_items | feeds G4 |
| A5 | ما رأس المال المتاح لديك الآن؟ | range + currency | compared with F5 |
| A6 | كم ساعة أسبوعياً ستخصص للمشروع؟ | number | < 10 → timeline warning |
| A7 | إلى متى تستطيع الاستمرار دون دخل من المشروع؟ | single (<3, 3–6, 6–12, >12 months) | compared with BE_month |
| A8★ | ما هدفك من المشروع؟ | single (side income / main income / scalable company) | sets analysis depth & tone |

### B — الفكرة والمشكلة
| ID | Label | Type | Logic |
|---|---|---|---|
| B1★ | صف فكرتك في جملة واحدة: ماذا تقدّم، ولمن، ولماذا؟ | short_text (≤ 40 words) | reject multi-sentence |
| B2★ | ما المشكلة التي تحلّها بالضبط؟ | long_text | R8 |
| B3 | من يعاني من هذه المشكلة أكثر من غيره؟ | short_text | feeds C2 |
| B4★ | كيف يحلّ الناس هذه المشكلة اليوم دون مشروعك؟ | long_text | reject "لا يوجد حل" |
| B5 | كم شخصاً تحدثت معهم فعلياً عن هذه المشكلة؟ | number | 0 → tag problem "غير مُختبَرة" + create interview task |
| B6 | لماذا الآن؟ ما الذي تغيّر في السوق؟ | long_text | optional; feeds PESTEL |
| B7 | نوع المشروع | single (physical product / service / digital / hybrid) | selects financial template |
| B8 | ما الذي يمنع شخصاً آخر من نسخ فكرتك غداً؟ | long_text | reject "لا أحد يستطيع" |

### C — العميل
| ID | Label | Type | Logic |
|---|---|---|---|
| C1★ | من يدفع لك؟ | single (B2C / B2B / B2G / mixed) | branches C2 |
| C2★ | صف عميلك الأول بدقة | conditional fields (B2C: age band, city, income band, occupation / B2B: sector, size, decision-maker title) | R1 |
| C3 | ما "المهمة" التي يستأجر العميل منتجك لإنجازها؟ | short_text | JTBD |
| C4 | ما اللحظة أو الحدث الذي يدفعه للشراء؟ | short_text | |
| C5 | هل من يستخدم المنتج هو من يقرّر الشراء؟ | boolean + text | no → ask decision-maker |
| C6 | هل دفع أي عميل لك أو وعد بالدفع؟ | single (paid / promised / no) | raises confidence |
| C7 | أين يقضي عميلك وقته رقمياً وميدانياً؟ | multi | feeds channels |
| C8★ | كم عميلاً محتملاً تستطيع الوصول إليه في أول شهر؟ | number | > 1000 without channel in C7 → justify |

### D — السوق والدولة
| ID | Label | Type | Logic |
|---|---|---|---|
| D1★ | ما النطاق الجغرافي في السنة الأولى؟ | single (neighbourhood / city / country / multi-country) | multi-country → focus warning |
| D2 | ما القطاع؟ | single (sector list) | links sector data |
| D3★ | اذكر 3 منافسين أو بدائل على الأقل | line_items (name, url, strength, weakness), min 3 | R2 |
| D4★ | ما أسعار هؤلاء المنافسين؟ | money per competitor | unknown → assumption, low confidence, research task |
| D5 | ما الذي يجعل العميل يختارك بدلاً منهم؟ | long_text | R5 |
| D6 | هل يعتمد مشروعك على الاستيراد أو عملة أجنبية؟ | boolean + percent | FX risk |
| D7 | هل الطلب موسمي؟ | single + peak months | seasonality factors |
| D8 | ما التراخيص أو الموافقات المطلوبة التي تعرفها؟ | text + "لا أعرف" | completed by T17 |

### E — العمليات
| ID | Label | Type | Logic |
|---|---|---|---|
| E1★ | كيف يصل المنتج أو الخدمة إلى العميل خطوة بخطوة؟ | long_text / steps | process map |
| E2 | ما الأنشطة الثلاثة الأهم التي يجب أن تتقنها؟ | 3 × short_text | BMC key activities |
| E3 | ما المعدات أو الأدوات أو البرامج الأساسية؟ | line_items + cost | auto-feeds F5 |
| E4 | من هم مورّدوك الرئيسيون؟ | line_items | single supplier → dependency risk |
| E5 | من الشركاء الذين تحتاجهم؟ | text | BMC key partners |
| E6 | أين ستعمل؟ | single (home / shop / office / online only / field) | fixed-cost template; home + Amman → home permit path |
| E7 | أقصى عدد عملاء أو وحدات تستطيع خدمته شهرياً؟ | number | capacity check vs F6 |
| E8 | كم موظفاً تحتاج في السنة الأولى، وبأي أدوار؟ | line_items (role, monthly cost, start month) | payroll in T9 |

### F — الأرقام
| ID | Label | Type | Logic |
|---|---|---|---|
| F1★ | سعر البيع للوحدة أو للخدمة | money | mandatory number; unknown → range from D4 |
| F2 | نموذج التسعير | single (fixed / subscription / hourly / commission / bundles) | formula set |
| F3★ | التكلفة المتغيرة لكل وحدة | line_items | Σ ≥ F1 → **block + red alert** |
| F4★ | التكاليف الثابتة الشهرية | line_items | reject total 0 |
| F5★ | تكاليف التأسيس لمرة واحدة | line_items | > A5 → trigger H3 |
| F6★ | المبيعات المتوقعة في الشهر 1 و6 و12 | 3 × number | > 10× growth without reason → justify |
| F7 | كيف يدفع العميل؟ | single (cash / credit / instalments / deposit) | cash-flow timing |
| F8 | عملة التقرير | currency | default = A1 currency; never inferred from text |

### G — الإطار القانوني
| ID | Label | Type | Logic |
|---|---|---|---|
| G1 | ما الشكل القانوني الذي تفكر فيه؟ | single (sole / company / don't know) | don't know → comparison from pack |
| G2 | هل المشروع مسجّل حالياً؟ | single (yes / in progress / no) | |
| G3 | هل تعمل حالياً دون ترخيص؟ | boolean | yes → "مسار التنظيم" section, no blame |
| G4 | كيف تتوزع الملكية بين الشركاء؟ | percent_split | must sum to 100; no written agreement → warning |
| G5 | هل لديك اسم تجاري أو علامة محمية؟ | single | |
| G6★ | هل بلغت سن الأهلية القانونية لتسجيل منشأة في بلدك؟ | boolean | no → guardian / later path; never ask exact age |
| G7 | هل تفضّل تمويلاً متوافقاً مع الشريعة؟ | single (yes / no preference / no) | yes → Islamic instruments; word "فائدة" banned in report |
| G8 | هل تعرف التزاماتك الضريبية؟ | single (yes / partly / no) | checklist, verify-tagged |

### H — الأهداف والقيود
| ID | Label | Type | Logic |
|---|---|---|---|
| H1★ | ما الذي يجب أن يحدث خلال 12 شهراً لتعتبر المشروع ناجحاً؟ | short_text | reject non-measurable |
| H2 | ما الرقم الذي ستراقبه أسبوعياً؟ | short_text | none → suggest one by B7 |
| H3 | كيف ستموّل المشروع؟ | multi (self / family / loan / investor / grant / competition) | selects deliverable variant |
| H4 | ما الأمور التي لن تفعلها مهما حدث؟ | text | red lines respected in all recommendations |
| H5 | ما أقصى مدة تقبلها للوصول إلى التعادل؟ | single (months) | compared with BE_month and A7 |
| H6 | ما أكبر شيء لا تعرفه أو يقلقك؟ | long_text | top priority in T18 |
| H7 | هل تريد التوسع لاحقاً؟ | single (no / cities / countries / franchise) | |
| H8★ | لمن سيُعرض هذا التقرير؟ | single (self / investor / bank / grant body / course assignment) | report template & tone |

---

## 2. Global Rejection Rules

| Code | Trigger | Platform response (MSA) |
|---|---|---|
| R1 | Customer = "الجميع" / "كل الناس" | المشروع الذي يستهدف الجميع لا يصل إلى أحد. من أول 10 عملاء سيدفعون لك؟ |
| R2 | "لا منافسين" | كيف يتصرف العميل اليوم دونك؟ هذا هو منافسك. |
| R3 | Non-numeric in numeric field | Offer a suggested range to pick from |
| R4 | "لا أعرف" | Accept → store as `assumption`, confidence `low`, create validation task |
| R5 | Vague adjectives (أفضل، أسرع، جودة عالية) | أفضل بكم؟ أسرع بكم يوماً أو ساعة؟ أعطني رقماً. |
| R6 | Contradiction between answers | Show both side by side, ask to correct |
| R7 | Too short for long_text | Ask for one real example |
| R8 | Solution described instead of problem (B2) | هذا حلّك. ما الألم الذي يشعر به العميل قبل أن يعرفك؟ |

Rules are evaluated by Haiku-class classification **plus** deterministic checks where possible. Every rejection offers an easier question or an example — never a bare error. Tone: firm, never insulting.

Dialect handling: show the normalized MSA interpretation for confirmation (e.g. "فهمت أن تكلفة التوصيل 300 دينار جزائري للطلب. صحيح؟"). Never correct the user's dialect.

Seed glossary (extend in DB): registre de commerce / الريجيستر → السجل التجاري; la TVA → ضريبة القيمة المضافة; chiffre d'affaires → رقم الأعمال; carte auto-entrepreneur → بطاقة المقاول الذاتي; crédit / الكريدي → ask: قرض أم بيع آجل؟; le local → المحل; مصاري / الدراهم → المال (ask currency); كاش → نقداً; رخصة مهن → رخصة المهن.

---

## 3. Completeness & Gating

Weights: F 25%, C 20%, D 15%, B 12%, E 10%, H 8%, A 5%, G 5%.

| Score | Output |
|---|---|
| < 40% | No report; list the most important missing questions |
| 40–79% | One-page summary (free preview) |
| ≥ 80% **and** F1, F3, F4, F5 complete | Full report (paid entitlement) |

---

## 4. Engine Formulas (packages/engine — deterministic, unit-tested)

### T8 Unit economics & break-even
```
P = F1; VC = ΣF3; FC = ΣF4; S = ΣF5
CM = P − VC;  CM% = CM / P
BE_units = ceil(FC / CM);  BE_rev = FC / CM%
BE_month = first month in T9 where units ≥ BE_units
Payback = S / avg monthly net profit after BE_month
Alerts: CM ≤ 0 → block | BE_units > E7 | BE_month > H5 | BE_month > A7
Subscription (F2 = subscription): LTV = (ARPU × CM%) / churn; CAC = marketing / new customers; alert if LTV/CAC < 3
```

### T7 Pricing
```
Floor = VC + FC / avg expected monthly units
Band = min, median, max of D4
Penetration = max(Floor × 1.1, min(D4)); Market = median(D4)
Premium: only if D5 passed R5 (measurable difference)
Alert: F1 < Floor
```

### T5 Market size (v2)
```
Top-down (external, tagged): TAM = customers in country × annual spend; SAM = TAM × share in D1/C2 scope
Bottom-up: SOM = C8 × conversion × annual frequency × P, capped at E7 × 12 × P
Unknown conversion → show 1% / 3% / 5% as assumption
If top-down SOM > 3 × bottom-up → warn, use smaller
No reliable source → empty field with reason
```

### T9 Projection (Y1 monthly, Y2–Y3 quarterly)
| Line | Rule |
|---|---|
| Units | curve through F6 (m1, m6, m12) × D7 seasonality |
| Revenue | units × P |
| COGS | units × VC, escalated yearly by country inflation (external, tagged) |
| Gross profit | revenue − COGS |
| Opex | FC + E8 payroll schedule + marketing |
| Pre-tax | gross profit − opex |
| Tax | `taxDue(rule, turnover, profit)` from `tax_rules` for the user's regime |
| Cash flow | receipts delayed per F7; S at month 0 |
| **Funding need** | abs(min cumulative cash) — headline number |
| FX test | if D6 > 0: COGS at ±10% and ±20% FX |

### T10 Scenarios & sensitivity
| Variable | Conservative | Base | Optimistic |
|---|---|---|---|
| Sales | × 0.6 | user | × 1.3 |
| VC | × 1.1 | user | × 0.95 |
| Launch delay | 3 months | 0 | 0 |
Multipliers are configurable defaults, labelled as such. Outputs per scenario: BE_month, funding need, Y1 profit. Tornado: ±20% on P, VC, sales, FC ranked by Y1-profit impact; top variable becomes first T18 experiment.

### Tax engine
```ts
function taxDue(rule, annualTurnover, annualProfit) {
  const base = rule.basis === 'turnover' ? annualTurnover : Math.max(annualProfit, 0);
  const tax = base * rule.rate;
  return rule.min_amount ? Math.max(tax, rule.min_amount) : tax;
}
// annualTurnover > rule.ceiling → alert "تجاوزت سقف النظام المبسّط"
```

---

## 5. Tools Registry

| # | Tool | Executor | Release |
|---|---|---|---|
| T1 | Business Model Canvas (9 blocks, provenance colours, two-way binding) | code + LLM wording | MVP |
| T2 | Lean Canvas | code + LLM | MVP |
| T3 | Value Proposition Canvas + fit score (% pains addressed) | LLM | v2 |
| T4 | Interview script (past behaviour, not intentions; dialect option) + result sheet updating B5/C6 | LLM | v2 |
| T5 | Market size | code + search | v2 |
| T6 | Competitor matrix + 2D positioning map; search enrichment for monthly/annual | code + LLM + search | MVP (basic) / v2 (enrichment) |
| T7 | Pricing | code | MVP |
| T8 | Unit economics & break-even | code | MVP |
| T9 | 3-year projection | code | MVP |
| T10 | Scenarios & sensitivity | code | MVP (table) / v2 (chart) |
| T11 | PESTEL — live search, dated sources, impact −2..+2, political factors as neutral operational risks only; shared cache per country × sector, 30 days; sources > 12 months flagged | LLM + search | v2 |
| T12 | Porter's five forces, 1–5 with evidence IDs | LLM | v2 |
| T13 | SWOT — every item must cite an evidence ID or it is dropped | LLM + rules | v2 |
| T14 | Risk register: probability × impact, early-warning signal, mitigation | code + LLM | v2 |
| T15 | Pitch deck (10 slides, template by H8), pptxgenjs, RTL, brand | code + LLM | v2 |
| T16 | AI mentor | LLM | MVP |
| T17 | Registration guide from country pack | DB + rules | MVP (JO, DZ) |
| T18 | 30-day validation plan: top 3 assumptions by (4 − confidence) × sensitivity rank; experiment, metric, pre-set success threshold, cost, fallback | code + LLM | MVP |

### T16 Mentor behaviour
1. Asks, does not answer on the user's behalf inside the diagnostic; explains concepts with examples from a different sector.
2. Critical and direct about the weakest point; no flattery.
3. Never invents market numbers; points to T5/T11.
4. Cites answer IDs ("حسب إجابتك في F3…").
5. No binding legal or tax advice; refers to T17 and a professional.
6. Receives a project summary (~1 page), not all 64 answers.
7. Quotas and fair use per entitlements.

---

## 6. Report

### Full report (v2, 22–28 pages; MVP subset marked ●)
1. ● Cover + completeness + overall confidence
2. ● Executive summary: verdict (امضِ / عدّل / توقّف), 3 numbers, 3 risks
3. ● Project card
4. Customer & value proposition
5. Market & context (PESTEL)
6. Competition & Porter
7. ● BMC + Lean Canvas
8. ● Pricing & unit economics
9. ● Financial projection
10. ● Scenarios & sensitivity
11. SWOT & risk register
12. ● Legal path & financing
13. ● 30-day validation plan
- ● Appendix A: assumptions register
- Appendix B: sources with dates
- ● Appendix C: disclaimer (planning tool, not legal or financial advice)

Low-confidence pivotal numbers render highlighted with: "هذا الرقم افتراض، اختبره قبل أن تبني عليه قراراً."
Template variants by H8: investor (growth first), bank (cash flow first), grant (impact), course (method).

### One-page summary (free)
Project card, top 3 risks, break-even estimate, locked section titles (upgrade point).

---

## 7. Country Packs

Structure per country: currency, legal forms, simplified regimes, tax bodies, social security bodies, data sources, payment context, Islamic finance instruments, support programmes, each item with `source_url` + `last_verified`. **All values below must be verified from official sources during M5 and stored with dates.**

### Jordan (JO) — seed items to verify
- Sole proprietorship registration: Ministry of Industry, Trade and Supply (Central Trade & Industrial Registration Directorate).
- Companies: Companies Control Department.
- Sector pre-approvals where required (e.g. food: Ministry of Health, Civil Defense).
- Chamber of commerce/industry membership; vocational licence from Greater Amman Municipality or local municipality.
- Home-based business path; Amman home permit.
- Income and Sales Tax Department; Social Security Corporation.
- Data sources: Department of Statistics, Central Bank of Jordan, JEDCO.
- Currency JOD (USD-pegged). Display: `د.أ`.

T17 JO logic:
```
E6 = home AND A1 = Amman → home-business path + GAM home permit
B7 ∈ {food, cosmetics} → add health approvals
A4 has partners → compare sole vs LLC
G6 = no → guardian / later path
```

### Algeria (DZ) — behind `MARKET_DZ_ENABLED`
- Auto-entrepreneur status via ANAE (online registration); IFU 0.5% of turnover, minimum 10,000 DZD/year; turnover ceiling 5,000,000 DZD/year; IFU covers VAT (no VAT deduction on purchases); official activity list (store ANAE codes separately from CNRC codes).
- Otherwise: commercial register (CNRC). Social security for non-salaried: CASNOS. Tax: DGI. Data: ONS, Banque d'Algérie.
- Currency DZD, all user calculations in DZD; optional USD display tagged with rate source and date.

T17 DZ logic:
```
activity ∈ ANAE list AND annual turnover < ceiling → auto-entrepreneur path (default)
else → CNRC path + legal form comparison
goods import → check micro-import conditions
```

### Islamic finance (G7 = yes)
Murabaha (deferred-price purchase; profit margin, not interest), Ijara (lease payments in fixed costs), diminishing Musharaka (profit share + buyout schedule), Mudaraba (profit split), Qard hasan (no increase). Institutions per country: populate from official sources only.

---

## 8. Data Model (Postgres)

```sql
users(id, email, locale, country_code, eligibility_secondary bool, is_adult bool, guardian_consent_at, crossborder_consent_at, created_at)
plans(id, code, price_usd, billing, duration_days)
entitlements(plan_id, key, value)
subscriptions(id, user_id, plan_id, source, status, starts_at, ends_at, external_ref)
usage_counters(user_id, key, period_start, count)
affiliates(id, user_id, commission_rule)
vouchers(code unique, type, affiliate_id, batch_id, issued_at, expires_at, activated_by, activated_at, status)
waitlist(id, email, country_code, consent_at)
projects(id, user_id, title, country_code, currency, mode, completeness, created_at, archived_at)
answers(project_id, question_id, raw_text, normalized_value jsonb, source, confidence, validated, updated_at, pk(project_id, question_id))
tool_runs(id, project_id, tool_id, input_hash, output jsonb, engine_version, tokens_in, tokens_out, search_calls, cost_usd, created_at)
reports(id, project_id, type, audience, pdf_path, created_at)
mentor_messages(id, project_id, role, content, tokens_in, tokens_out, cost_usd, created_at)
country_pack_items(id, country_code, key, value jsonb, source_url, source_domain, last_verified, status)
pack_change_log(id, item_id, old_value, new_value, evidence_url, agent_confidence, action, created_at)
tax_rules(id, country_code, regime, basis, rate, min_amount, ceiling, currency, effective_from, source_url, last_verified)
pestel_cache(country_code, sector_code, payload jsonb, expires_at)
glossary(term, language, msa_equivalent, needs_clarification bool)
settings(key, value)   -- model prices, fair-use thresholds
audit_log(id, actor, action, entity, entity_id, created_at)
```

---

## 9. Country-Pack Review Agent

- Weekly scan of stale items; full review per pack every 90 days.
- Allowlist of official domains in `settings` (e.g. government portals, anae.dz).
```
for each item:
  fetch official source
  unchanged → update last_verified
  changed:
    allowlisted domain AND explicit change AND high confidence → auto-apply + log + notify
    otherwise → status = under_review, keep old value, render with verify label
  3 consecutive fetch failures → status = stale
```
- Never updates a value from a non-allowlisted source; such sources only trigger review.
- Weekly email digest to admin (mandatory).

---

## 10. Fair Use (admin-configurable, thresholds set after measurement)

| Signal | Action |
|---|---|
| Daily mentor threshold exceeded | slow responses, then route to lighter model until next day |
| > 2 concurrent devices | sign out oldest session + notify |
| 30-day AI cost > configured % of plan revenue | alert admin only |
| Scripted usage pattern | challenge, then temporary pause |

Cost per call = tokens_in × price_in + tokens_out × price_out + search_calls × price_search (prices from `settings`).

---

## 11. Privacy & Compliance Requirements

- Separate, unticked cross-border consent checkbox naming processors and countries.
- De-identification before every LLM call (tested).
- Data minimisation: no DOB, no ID images, phone optional.
- One-click account + project deletion.
- Processor list in privacy policy (Supabase, Vercel, Anthropic, PayPal, email provider).
- Breach response runbook in `docs/`.
- Legal texts are placeholders marked `[LEGAL REVIEW REQUIRED]` until reviewed.
