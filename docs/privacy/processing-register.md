# Record of processing activities

What personal data the platform processes, why, where and for how long (GDPR Art. 30). It
describes `main` as of M3c and gathers facts decided in D-061, D-065, D-082, D-092 and D-098. The
privacy page draft (`apps/web/src/app/[locale]/(site)/privacy/content.tsx`) must say the same.

**[LEGAL REVIEW REQUIRED]:** every legal basis and transfer mechanism below is a working
assumption until the legal review (#73). Items marked "to confirm" need a check with the provider.

## Controller

- Operator: **[legal name, address and contact email, #78]**.
- EU representative (GDPR Art. 27) and data protection officer: not appointed; legal review (#73).

## Activities

| Activity                         | Purpose                                                                                        | Personal data                                                                                                                                                                        | People                                  | Legal basis **[LEGAL REVIEW REQUIRED]**                                          | Recipients (see processors)           | Kept                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Account and sign-in              | Create and protect the account; send sign-in codes                                             | Email address; sign-in method; with Google, the name, email and photo Google sends (kept by Supabase Auth, not used); sessions; sign-in events with IP address in the auth audit log | Users                                   | Contract, Art. 6(1)(b)                                                           | Supabase, Resend; Google if chosen    | Until the account is deleted. Unfinished signups: 24 hours (D-079). Audit log: PRIV-15         |
| Onboarding profile               | Pick the country data and the language; know whether the user has a project                    | Country, language, the answer to "Do you have a project or a project idea?"                                                                                                          | Users                                   | Contract, Art. 6(1)(b)                                                           | Supabase                              | Until the account is deleted                                                                   |
| Consent records                  | Show which text the user agreed to, and when (Art. 7(1))                                       | Kind, given or withdrawn, text version, language, time                                                                                                                               | Users                                   | Legal obligation, Art. 6(1)(c)                                                   | Supabase                              | Until the account is deleted; whether proof must outlive deletion is #31                       |
| Diagnostic answers and projects  | Produce the analysis the user asked for                                                        | Project title, country, currency; every answer with what was typed (`raw_text`) and its provenance. Answers may name other people: team members and partners (A4), suppliers (E4)    | Users; people they name                 | Contract, Art. 6(1)(b); for the people named, legitimate interests, Art. 6(1)(f) | Supabase                              | Until the project or account is deleted. The free tier's 30 days are not enforced yet (M7, #9) |
| AI answer review                 | Understand dialect answers, apply rules the fixed checks cannot, check the idea (D-072, D-103) | Typed answer text after de-identification (emails, phone numbers and the account's own identifiers replaced, rule 5); the model's output in `tool_runs`                              | Users who gave the cross-border consent | Consent, Art. 6(1)(a) (D-062, D-082)                                             | Anthropic; Supabase stores the output | Output: until the project is deleted. At Anthropic: per its API terms, to confirm              |
| Usage limits and cost records    | Enforce the daily AI limits; know the cost of each call (rule 10)                              | Calls per user per UTC day; tokens and cost per call                                                                                                                                 | Users                                   | Legitimate interests, Art. 6(1)(f)                                               | Supabase                              | Until the account is deleted                                                                   |
| Visit statistics                 | Count visits to the public pages (D-092)                                                       | Page address without parameters (D-098), referring site, country, browser, operating system, device type; aggregated; no cookies                                                     | Visitors                                | Legitimate interests, Art. 6(1)(f)                                               | Vercel Web Analytics                  | Per Vercel, to confirm                                                                         |
| Hosting and logs                 | Run the service, find errors, protect it from abuse                                            | IP addresses, request paths and times, error logs by name and code (never answer text)                                                                                               | Visitors and users                      | Legitimate interests, Art. 6(1)(f)                                               | Vercel, Supabase                      | Per each provider's log retention, to confirm                                                  |
| Data requests and breach records | Answer rights requests; document breaches (Art. 12, 33(5))                                     | The request, the requester's email, what was done                                                                                                                                    | Requesters, people affected             | Legal obligation, Art. 6(1)(c)                                                   | None                                  | Private log outside this repository; period to set                                             |

Not live yet, to add when built: payments and subscriptions (PayPal, M7), vouchers and affiliates
(M7), the age check at payment (M7), the AI mentor (M6) and reports (M5).

## Processors

| Processor | Service                                                | Where the data is processed                                                                  | Data                                              | Outside the EU **[LEGAL REVIEW REQUIRED]**                                            | Contract          |
| --------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------- |
| Supabase  | Database, sign-in, scheduled jobs, backups             | Frankfurt, Germany (`eu-central-1`, D-044)                                                   | All account and project data                      | No                                                                                    | DPA, to confirm   |
| Vercel    | App hosting and functions; public files; Web Analytics | Functions in Frankfurt (`fra1`); public files on a global network; Web Analytics: to confirm | Requests, logs, visit statistics                  | Vercel is a US company: mechanism to confirm                                          | DPA, to confirm   |
| Resend    | Sign-in code emails, as Supabase's SMTP (D-061)        | Ireland (`eu-west-1`)                                                                        | Email address, the code email                     | To confirm                                                                            | DPA, to confirm   |
| Anthropic | AI answer review                                       | United States                                                                                | De-identified answer text                         | Yes, only with the user's cross-border consent (D-082); transfer mechanism to confirm | Terms, to confirm |
| Google    | Optional "Continue with Google" (D-065)                | United States                                                                                | Google account name, email and photo; the sign-in | Yes; Google may act as a separate controller for its sign-in                          | Terms, to confirm |

GitHub (code and CI) and the developer's machine hold no production user data: CI and the tests
use a local database.

## Security measures (GDPR Art. 32)

- Hosting and database in Frankfurt, with every connection over TLS.
- Row level security on every table, checked by pgTAP (`rls_guard.test.sql`); functions that write
  act only on the signed-in user (D-085).
- The browser never calls Supabase; sessions live in httpOnly, Secure cookies (D-077). The app
  holds no Supabase secret key, and a build fails if a secret reaches the browser bundle.
- Sign-in by an 8-digit code valid 10 minutes, or Google (D-087); no passwords.
- De-identification before every model call, with tests (rule 5, D-107); AI only with consent.
- Secrets scanned in the full git history on every change (D-040); production migrations only from
  `main` with the owner's approval ([operations.md](../runbooks/operations.md)).
- Daily backups on the Supabase Pro plan (D-064).
- Open items: [M9 checklist](../security/m9-checklist.md). Incidents:
  [breach-response.md](../runbooks/breach-response.md). Requests:
  [data-requests.md](../runbooks/data-requests.md).
