# Breach response

What to do when personal data may have been exposed, changed, lost or reached someone it should
not have (a personal data breach, GDPR Art. 4(12)). Required by SPEC §11. The owner is the
controller and decides every notification; this page is the procedure, not legal advice.
**[LEGAL REVIEW REQUIRED]** for the authorities and deadlines outside the EU (#73).

Examples here: a leaked key or password, a row level security mistake that lets one user read
another's project, an email sent to the wrong person, a processor reporting an incident to us.

## 1. Record, and start the clock

Write down at once, in a private note (never in this public repository, never in an issue):

- when and how it was discovered, and by whom;
- what is known so far, and what is not.

Under the GDPR, the 72 hours for telling the supervisory authority start when we become aware that
personal data was affected (Art. 33(1)), not when the investigation ends.

Where alerts come from: the `secret-scan` CI job (gitleaks), GitHub secret scanning, the Supabase
security advisor, an unexpected rise in AI spend (`tool_runs.cost_usd`, the daily cap being hit),
Vercel and Supabase logs, a processor's notice, or a user's report.

## 2. Contain

Stop the exposure first, then investigate. Rotate a secret before searching for how it leaked.

| What is exposed                                        | Contain                                                                                                                                                                                                | Put back into service                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                    | Anthropic Console → revoke the key. AI falls back to the fixed checks.                                                                                                                                 | New key in Vercel (Sensitive, Production and Preview), redeploy                             |
| A Supabase database password                           | Supabase → Project Settings → Database → reset the password                                                                                                                                            | Update `SUPABASE_DB_PASSWORD` in that `db-` environment on GitHub                           |
| `SUPABASE_ACCESS_TOKEN` (manages every project)        | Supabase account → Access Tokens → revoke                                                                                                                                                              | New token in the GitHub secret                                                              |
| A Resend API key                                       | Resend → API Keys → delete it. Sign-in codes stop for that project until replaced                                                                                                                      | New "Sending access" key into that project's SMTP settings ([auth-setup.md](auth-setup.md)) |
| A Google client secret                                 | Google Cloud → Credentials → the OAuth client → delete that environment's secret                                                                                                                       | New secret into Supabase → Google provider                                                  |
| A Supabase secret key                                  | The app has none (D-077). Supabase → API Keys: delete any secret key found                                                                                                                             | Not needed                                                                                  |
| The publishable key                                    | Not a secret: row level security protects the data. Rotate only if it is abused (new key in Vercel, redeploy, then delete the old one)                                                                 | Same                                                                                        |
| One user's session                                     | SQL editor: `delete from auth.sessions where user_id = '<user id>';` ends the refresh tokens                                                                                                           | The user signs in again                                                                     |
| Everyone's sessions                                    | SQL editor: `delete from auth.sessions;`. Access tokens stay valid until they expire (one hour by default) unless the JWT signing key is rotated and the old one revoked (Project Settings → JWT Keys) | Everyone signs in again                                                                     |
| A policy or function that exposes data                 | Instant Rollback if app code caused it; otherwise revoke the grant or drop the policy in the SQL editor, with the owner, then fix it by migration                                                      | The fixing migration ([operations.md](operations.md))                                       |
| The owner's GitHub, Vercel, Supabase or Google account | Change the password, revoke sessions and tokens, check recent deployments, `DB deploy` runs and variables                                                                                              |                                                                                             |

The kill switches in [operations.md](operations.md#kill-switches) stop a feature within seconds or
minutes while a fix is written.

## 3. Assess

Answer, in the private note:

- **What data:** which tables and columns. `answers.raw_text` may name third parties (team members
  in A4, suppliers in E4); see the [processing register](../privacy/processing-register.md).
- **Whose, and how many:** count the accounts, and their countries from `profiles.country_code`.
- **What happened to it:** read, copied, changed, deleted or only exposed; for how long.
- **Protections:** was the text de-identified (AI review), was access limited by row level security.
- **Consequences** for the people concerned: phishing with their email, disclosure of a business
  idea, loss of their work.

## 4. Notify

| Who                                                                     | When                                                                                                                    | Rule                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Supervisory authority (EU)                                              | Within 72 hours of awareness, unless the breach is unlikely to result in a risk to people. Details may follow in phases | GDPR Art. 33. Which authority, and the EU representative, per legal review (#73) |
| The people concerned                                                    | Without undue delay when the risk to them is high                                                                       | GDPR Art. 34. Template below                                                     |
| Authorities in Jordan and Algeria                                       | Per legal review **[LEGAL REVIEW REQUIRED]**                                                                            | Jordan's data protection law; Algeria's Law 18-07                                |
| Other countries of affected users                                       | Per legal review **[LEGAL REVIEW REQUIRED]**                                                                            | D-066: signup is global                                                          |
| A processor at the source (Supabase, Vercel, Resend, Anthropic, Google) | As soon as known, to get their facts and logs                                                                           | They must tell us without undue delay (GDPR Art. 33(2))                          |

A notification to an authority gives: what happened, the categories and approximate number of
people and records, the likely consequences, what was done and is planned, and a contact.

## 5. Tell the people concerned

Send from the platform's contact address (still to be set, #78), in the user's language
(`profiles.locale`). Plain words, no blame, no reassurance that is not yet known to be true.

**Arabic**

> **الموضوع:** إشعار بحادثة أمنية تخصّ بياناتك في Startup Brand Name
>
> مرحبًا،
>
> نكتب إليك لنبلغك بحادثة أمنية قد تكون مسّت بعض بياناتك لدينا.
>
> **ما الذي حدث:** في [التاريخ] اكتشفنا أن [وصف موجز وواضح لما حدث].
>
> **البيانات المعنية:** [مثل: عنوان بريدك الإلكتروني، وبلدك، وإجاباتك في التشخيص]. لم تتأثر [ما لم يتأثر].
>
> **ما الذي فعلناه:** [مثل: أوقفنا الوصول غير المصرّح به، وغيّرنا المفاتيح، وأنهينا جلسات الدخول].
>
> **ما ننصحك به:** [مثل: احذر الرسائل التي تدّعي أنها منّا وتطلب رمز الدخول؛ فنحن لا نطلبه منك أبدًا].
>
> لأي سؤال راسلنا عبر [عنوان البريد]. نعتذر عمّا حدث.
>
> فريق Startup Brand Name

**English**

> **Subject:** A security incident affecting your data at Startup Brand Name
>
> Hello,
>
> We are writing to tell you about a security incident that may have affected some of your data.
>
> **What happened:** on [date] we found that [short, clear description].
>
> **Which data:** [for example: your email address, your country and your diagnostic answers].
> [What was not affected] was not affected.
>
> **What we did:** [for example: we stopped the unauthorised access, replaced our keys and ended
> all sign-in sessions].
>
> **What we advise:** [for example: be careful with messages that claim to come from us and ask
> for your sign-in code; we never ask for it].
>
> If you have a question, write to us at [email address]. We are sorry this happened.
>
> The Startup Brand Name team

## 6. Close

- Keep a record of every breach, notified or not: the facts, the effects and what was done
  (GDPR Art. 33(5)). Private, outside this repository.
- Fix the cause with a normal pull request and a test that fails without the fix.
- Add a decision if a rule or setting changes, and an item to the
  [M9 checklist](../security/m9-checklist.md) if something was missing.
