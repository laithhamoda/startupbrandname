# Sign-in setup for the hosted projects (M2)

Do this once for **staging** and once for **production**. The local stack is configured by
`supabase/config.toml` and needs none of it.

## 1. Email (Resend, D-061)

1. Resend: create the account in the **EU (Ireland)** region and add the domain
   `mail.startupbrandname.com`.
2. Add the DNS records Resend shows (SPF, DKIM, return path) at the domain registrar, plus a DMARC
   record for `startupbrandname.com` if there is none. Wait until Resend shows the domain as verified.
3. Supabase → Authentication → Emails → SMTP settings: turn on custom SMTP with Resend's host, port,
   user and an API key made for this project. Sender: `Startup Brand Name`,
   `no-reply@mail.startupbrandname.com`.
4. Supabase → Authentication → Rate limits: raise "emails sent per hour" from the SMTP default to a
   level that covers signups (start with 100).

## 2. Code email templates

Supabase → Authentication → Emails → Templates. For **Confirm signup** and **Magic link**:

- Subject: `رمز الدخول · Your sign-in code`
- Body: the whole of `supabase/templates/code.html`.

## 3. Auth settings

Supabase → Authentication → Sign In / Providers:

- Allow new users to sign up: **on** (D-065 replaces D-018; the onboarding gate enforces eligibility).
- Email: on. Confirm email: on. Email OTP length **6**, expiry **600** seconds.

Supabase → Authentication → URL Configuration:

- Site URL: `https://startupbrandname.com` (production) or the staging URL.
- Redirect URLs: `https://startupbrandname.com/auth/callback` for production; for staging, the
  Vercel preview pattern `https://*-<team-slug>.vercel.app/auth/callback`, with the team slug copied
  from any preview deployment URL.

## 4. Google sign-in

Google Cloud console, in a project for Startup Brand Name:

1. OAuth consent screen: External; app name `Startup Brand Name`; support email; authorised domain
   `startupbrandname.com`; scopes `openid`, `email`, `profile` only.
2. Credentials → Create OAuth client ID → Web application. Authorised redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback` (one client per Supabase project, or both URIs
   on one client).
3. Supabase → Authentication → Providers → Google: on, paste the client ID and secret.

## 5. Check

- Sign up at `/ar/signup` with a real inbox: the code arrives in Arabic, from the Resend domain.
- Sign in with Google with an account that has never used the site: you land on `/ar/onboarding`.
- Supabase → Database → Cron: the job `purge-incomplete-accounts` runs every hour.
