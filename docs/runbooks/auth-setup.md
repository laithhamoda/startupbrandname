# Sign-in setup for the hosted projects (M2)

Do this once for **staging** (`mllysinjzlkhpcgbckil`) and once for **production**
(`blexotsepkuslrnawbbq`). The local stack is configured by `supabase/config.toml` and needs none of it.
Staging was set up on 2026-09-26 with the values below.

## 1. Email (Resend, D-061)

1. Resend → Domains → Add Domain: `mail.startupbrandname.com`, region **Ireland (eu-west-1)**. The
   region cannot be changed later.
2. Add the records Resend shows at Unstoppable Domains (names are relative to `startupbrandname.com`):
   - TXT `resend._domainkey.mail` (DKIM, copy the full value)
   - CNAME `rsend.mail` → `rsend-euw1.forge.rmta.net`
   - CNAME `send.mail` → `send.forge.rmta.net`
   - TXT `_dmarc` → `v=DMARC1; p=none;` (tighten to `p=quarantine` once delivery is proven)

   Then press **Verify DNS Records** in Resend.

3. Resend → API Keys: one key per Supabase project (`supabase-staging`, `supabase-production`),
   permission **Sending access**, domain `mail.startupbrandname.com`. Paste it straight into Supabase;
   never store it anywhere else.
4. Supabase → Authentication → Emails → SMTP Settings: custom SMTP on; sender
   `no-reply@mail.startupbrandname.com`, name `Startup Brand Name`; host `smtp.resend.com`, port
   `465`, username `resend`, password = the API key; minimum interval per user 60 seconds.
5. Supabase → Authentication → Rate Limits: emails sent per hour **100**.

## 2. Code email templates

Supabase → Authentication → Emails → Templates. For **Confirm sign up** and **Magic link or OTP**:

- Subject: `رمز الدخول · Your sign-in code`
- Body: the whole of `supabase/templates/code.html`.

## 3. Auth settings

Supabase → Authentication → Sign In / Providers:

- User Signups: Allow new users to sign up **on** (D-065 replaces D-018; the onboarding gate
  enforces eligibility); Confirm email **on**.
- Email provider: on; Secure email change on; Email OTP expiration **600** seconds; length **8** (D-087).

Supabase → Authentication → URL Configuration:

- Production: Site URL `https://startupbrandname.com`; redirect URL
  `https://startupbrandname.com/auth/callback`.
- Staging: Site URL `https://startupbrandname-git-m2-laithhamodas-projects.vercel.app`; redirect URL
  `https://startupbrandname-*-laithhamodas-projects.vercel.app/auth/callback` (every preview).

## 4. Vercel variables

Vercel → Project → Settings → Environment Variables, type **Config** (the `NEXT_PUBLIC_` values are
public by design; Vercel refuses the Secret type for them):

- Preview: `NEXT_PUBLIC_SUPABASE_URL` = `https://mllysinjzlkhpcgbckil.supabase.co` and the staging
  publishable key.
- Production: the same two names with the production project's values.

A variable change applies to the next deployment only.

## 5. Google sign-in

Google Cloud console, in a project for Startup Brand Name:

1. OAuth consent screen: External; app name `Startup Brand Name`; support email; authorised domain
   `startupbrandname.com`; scopes `openid`, `email`, `profile` only.
2. Credentials → Create OAuth client ID → Web application. Authorised redirect URIs:
   `https://mllysinjzlkhpcgbckil.supabase.co/auth/v1/callback` (staging) and
   `https://blexotsepkuslrnawbbq.supabase.co/auth/v1/callback` (production).
3. Supabase → Authentication → Sign In / Providers → Google: on, paste the client ID and secret.
4. Vercel: set `AUTH_GOOGLE_ENABLED` = `true` (type Config or Secret; the app reads it on the
   server only) for the same environment (Preview for
   staging, Production for production), then redeploy. Until then the Google button stays hidden,
   so nobody lands on Supabase's "provider is not enabled" error.

## 6. Check

- Sign up at `/ar/signup` with a real inbox: the code arrives in Arabic, from the Resend domain.
- Sign in with Google with an account that has never used the site: you land on `/ar/onboarding`.
- Supabase → Integrations → Cron: the job `purge-incomplete-accounts` runs every hour.
