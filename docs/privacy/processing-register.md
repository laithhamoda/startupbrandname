# Record of processing activities

What personal data the platform processes, why, where and for how long (GDPR Art. 30). It
describes `main` as of 2026-10-05, after M3c and the audit fixes, and gathers facts decided in
D-061, D-065, D-082, D-092, D-098, D-126 and D-146 to D-154. The privacy page draft
(`apps/web/src/app/[locale]/(site)/privacy/content.tsx`) must say the same.

**Privacy page gaps.** The draft of 2026-10-04 (`PRIVACY_UPDATED`, D-154) now covers the stored
answers, the AI review and what it removes, the IP addresses kept by sign-in, the hosting logs and
the sign-in records that outlive a deletion. It still differs from this register here; remove an
item when the page says it or the legal review drops it:

- It names no legal basis for any activity (the Legal basis column below, GDPR Art. 13(1)(c)).
- It gives no operator, contact or EU representative yet (#78, #73), and its rights section names
  neither objection, restriction and portability nor the right to complain to a supervisory
  authority (Art. 13(2)(b) and (d)).
- It does not say that each AI call also leaves a reservation (time, model, held cost) for a day
  or more (Usage limits and cost records), nor how long Anthropic keeps what it receives.
- It does not say that Vercel keeps runtime logs outside the EU (#34), or that the app's log lines
  carry project and question IDs (Hosting and logs).

**[LEGAL REVIEW REQUIRED]:** every legal basis and transfer mechanism below is a working
assumption until the legal review (#73). Items marked "to confirm" need a check with the provider.

## Controller

- Operator: **[legal name, address and contact email, #78]**.
- EU representative (GDPR Art. 27) and data protection officer: not appointed; legal review (#73).

## Activities

| Activity                         | Purpose                                                                                        | Personal data                                                                                                                                                                                                                                                                                                                                                                                              | People                                    | Legal basis **[LEGAL REVIEW REQUIRED]**                                          | Recipients (see processors)           | Kept                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Account and sign-in              | Create and protect the account; send sign-in codes                                             | Email address; sign-in method; with Google, the name, email and photo Google sends (kept by Supabase Auth; the names are used only to remove them from answers before the AI review, D-148); sessions with IP address and browser; sign-in events with IP address in the auth audit log                                                                                                                    | Users                                     | Contract, Art. 6(1)(b)                                                           | Supabase, Resend; Google if chosen    | Until the account is deleted. Unfinished signups: 24 hours (D-079). Audit log: after the deletion too, until #87 is settled |
| Onboarding profile               | Pick the country data and the language; know whether the user has a project                    | Country, language, the answer to "Do you have a project or a project idea?"                                                                                                                                                                                                                                                                                                                                | Users                                     | Contract, Art. 6(1)(b)                                                           | Supabase                              | Until the account is deleted                                                                                                |
| Consent records                  | Show which text the user agreed to, and when (Art. 7(1))                                       | Kind, given or withdrawn, text version, language, time. A cross-border consent counts only for a text version listed in `consent.crossborder.accepted_versions` (D-147)                                                                                                                                                                                                                                    | Users                                     | Legal obligation, Art. 6(1)(c)                                                   | Supabase                              | Until the account is deleted; whether proof must outlive deletion is #31                                                    |
| Diagnostic answers and projects  | Produce the analysis the user asked for                                                        | Project title, country, currency; every answer with what was typed (`raw_text`) and its provenance. Answers may name other people: team members and partners (A4), suppliers (E4)                                                                                                                                                                                                                          | Users; people they name                   | Contract, Art. 6(1)(b); for the people named, legitimate interests, Art. 6(1)(f) | Supabase                              | Until the project or account is deleted. The free tier's 30 days are not enforced yet (M7, #9)                              |
| AI answer review                 | Understand dialect answers, apply rules the fixed checks cannot, check the idea (D-072, D-103) | Typed answer text after de-identification: the account's email and Google names, other email addresses, phone numbers, contact links, IBANs and ID numbers are replaced by numbered placeholders that are put back only in the app; other names and numbers are sent as typed (rule 5, D-148, D-149). The model's output in `tool_runs`, still de-identified, with the MSA wording only for a real rewrite | Users with a current cross-border consent | Consent, Art. 6(1)(a), to the text version shown (D-062, D-082, D-147)           | Anthropic; Supabase stores the output | Output: until the project is deleted. At Anthropic: per its API terms, to confirm                                           |
| Usage limits and cost records    | Enforce the daily AI limits; know the cost of each call (rule 10)                              | Calls per user per UTC day (`usage_counters`); one reservation per AI call with its time, model and the most it could cost (`private.ai_reservations`, D-146); tokens and cost per run (`tool_runs`)                                                                                                                                                                                                       | Users                                     | Legitimate interests, Art. 6(1)(f)                                               | Supabase                              | Until the account is deleted. Reservations older than a day go at the user's next reservation                               |
| Visit statistics                 | Count visits to the public pages (D-092)                                                       | Page address without parameters and with project IDs replaced by `:id` (D-098, D-153), referring site, country, browser, operating system, device type; aggregated; no cookies                                                                                                                                                                                                                             | Visitors                                  | Legitimate interests, Art. 6(1)(f)                                               | Vercel Web Analytics                  | Per Vercel, to confirm                                                                                                      |
| Hosting and logs                 | Run the service, find errors, protect it from abuse                                            | IP addresses, request paths and times; the app's own log lines, with allowlisted fields only, such as the event, error code and class, digest, route template, request ID and project and question IDs; never answer text, a prompt or an email (D-126)                                                                                                                                                    | Visitors and users                        | Legitimate interests, Art. 6(1)(f)                                               | Vercel, Supabase                      | Per each provider's log retention, to confirm                                                                               |
| Data requests and breach records | Answer rights requests; document breaches (Art. 12, 33(5))                                     | The request, the requester's email, what was done                                                                                                                                                                                                                                                                                                                                                          | Requesters, people affected               | Legal obligation, Art. 6(1)(c)                                                   | None                                  | Private log outside this repository; period to set                                                                          |

Not personal data: the daily AI spend ledger (`private.ai_spend_daily`) keeps calls, tokens and cost
per UTC day and model with no user or project key, so no deletion lowers it (D-146, D-175).

Not live yet, to add when built: payments and subscriptions (PayPal, M7), vouchers and affiliates
(M7), the age check at payment (M7), the AI mentor (M6) and reports (M5).

## Processors

| Processor | Service                                                | Where the data is processed                                                                                                                | Data                                              | Outside the EU **[LEGAL REVIEW REQUIRED]**                                                           | Contract          |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------- |
| Supabase  | Database, sign-in, scheduled jobs, backups             | Frankfurt, Germany (`eu-central-1`, D-044)                                                                                                 | All account and project data                      | No                                                                                                   | DPA, to confirm   |
| Vercel    | App hosting and functions; public files; Web Analytics | Functions in Frankfurt (`fra1`); runtime logs and builds outside the EU (#34); public files on a global network; Web Analytics: to confirm | Requests, logs, visit statistics                  | Vercel is a US company: mechanism to confirm                                                         | DPA, to confirm   |
| Resend    | Sign-in code emails, as Supabase's SMTP (D-061)        | Ireland (`eu-west-1`)                                                                                                                      | Email address, the code email                     | To confirm                                                                                           | DPA, to confirm   |
| Anthropic | AI answer review                                       | United States                                                                                                                              | De-identified answer text                         | Yes, only with the user's current cross-border consent (D-082, D-147); transfer mechanism to confirm | Terms, to confirm |
| Google    | Optional "Continue with Google" (D-065)                | United States                                                                                                                              | Google account name, email and photo; the sign-in | Yes; Google may act as a separate controller for its sign-in                                         | Terms, to confirm |

GitHub (code and CI) and the developer's machine hold no production user data: CI and the tests
use a local database.

## Security measures (GDPR Art. 32)

- Hosting and database in Frankfurt, with every connection over TLS.
- Row level security on every table, checked by pgTAP (`rls_guard.test.sql`); functions that write
  act only on the signed-in user (D-085), and deleting an account or a project reaches every table
  that holds its data (`erasure_guard.test.sql`, D-144).
- The browser never calls Supabase; sessions live in httpOnly, Secure cookies (D-077). The app
  holds no Supabase secret key, and a build fails if a secret reaches the browser bundle.
- Sign-in by an 8-digit code valid 10 minutes, or Google (D-087); no passwords.
- De-identification before every model call, with tests (rule 5, D-107, D-148); placeholders are
  restored only in the app (D-149). AI only with a current consent (D-147).
- AI costs are computed by the database against one-time reservations, so no user can record a
  cost or close AI for others (D-146).
- Server logs carry allowlisted fields only, never answer text or an email (D-126). Security
  headers on every response (D-130).
- Secrets scanned in the full git history on every change (D-040); production migrations only from
  `main` with the owner's approval ([operations.md](../runbooks/operations.md)).
- Daily backups on the Supabase Pro plan, which production moves to before signup opens to the
  public (D-064).
- Open items: [M9 checklist](../security/m9-checklist.md). Incidents:
  [breach-response.md](../runbooks/breach-response.md). Requests:
  [data-requests.md](../runbooks/data-requests.md).
