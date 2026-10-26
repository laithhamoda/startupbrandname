import 'server-only';
import { z } from 'zod';
import type { OfferPrices } from '@/lib/payments/offer';

/** Accepts exactly "true" or "false". `z.coerce.boolean()` would turn "false" into true. */
export const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

/**
 * A comma-separated list of email addresses: trimmed, lower-cased, without blanks or repeats. Empty
 * means none. One malformed address fails the whole variable, so a typo is never read as "nobody".
 */
export const emailList = z
  .string()
  .max(2000)
  .transform((value) => [
    ...new Set(
      value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email !== ''),
    ),
  ])
  .pipe(z.array(z.email().max(254)).max(20));

/**
 * The accounts that see the full report before paid plans exist (D-232, D-245): the owner's address
 * while the report is built. Read through `getPreviewEmails()`, not through `serverEnvSchema`, so a
 * typo in this temporary variable cannot take every page down (D-245). Remove it with M7.
 */
export const previewEmailsSchema = emailList.default([]);

/** Server-only variables. Importing this module from a Client Component fails the build. */
export const serverEnvSchema = z.object({
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Kill switch for Algeria, open since 2026-09-26 by the owner's decision (D-068). "false"
  // closes signup for Algerian users without touching existing accounts.
  MARKET_DZ_ENABLED: booleanFlag.default(true),
  // Shows "Continue with Google" when the environment's Supabase project also has Google enabled
  // (checked at runtime, D-089), so a mismatch never leads to Supabase's raw error page.
  AUTH_GOOGLE_ENABLED: booleanFlag.default(false),
  // Tests only: "false" skips asking Supabase whether Google is enabled, so the end-to-end tests can
  // press the button against a local stack that has no Google credentials.
  AUTH_GOOGLE_VERIFY_PROVIDER: booleanFlag.default(true),
  // AI features (M3c). Without a key, or with "off", the diagnostic uses its fixed checks only.
  // "fake" is a deterministic stand-in for tests and CI that makes no network call (D-123).
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_PROVIDER: z.enum(['anthropic', 'fake', 'off']).default('anthropic'),
  // Search indexing stays off until public launch, and always off outside production (D-027, D-054).
  SITE_INDEXABLE: booleanFlag.default(false),
  // Before public launch, lets only the listed AI crawlers read the public pages (D-303). Ignored
  // outside production and once SITE_INDEXABLE is on.
  AI_CRAWLERS_ALLOWED: booleanFlag.default(false),
  // Set by Vercel at build and run time. VERCEL is "1" on Vercel only; tests that imitate
  // production set VERCEL_ENV alone, so they never load Vercel-only scripts.
  VERCEL: z.literal('1').optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  VERCEL_REGION: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env);
}

export interface PreviewEmails {
  readonly emails: readonly string[];
  /** False when `FULL_REPORT_PREVIEW_EMAILS` is malformed: the list is then empty, so the caller logs it. */
  readonly valid: boolean;
}

/**
 * `FULL_REPORT_PREVIEW_EMAILS` as a list. One malformed address makes the whole list empty and
 * `valid` false: nobody previews, and the rest of the site keeps working.
 */
export function getPreviewEmails(
  raw: string | undefined = process.env.FULL_REPORT_PREVIEW_EMAILS,
): PreviewEmails {
  const parsed = previewEmailsSchema.safeParse(raw);
  return parsed.success ? { emails: parsed.data, valid: true } : { emails: [], valid: false };
}

/**
 * Early access (D-290): "true" opens the full report to every signed-in account while paid plans do
 * not exist. Fail-closed, and read apart from `serverEnvSchema` like the preview list, so a typo in
 * this temporary variable switches nothing on and cannot take a page down. Remove it with M7.
 */
export function getEarlyAccess(
  raw: string | undefined = process.env.EARLY_ACCESS_FULL_REPORT,
): boolean {
  const parsed = booleanFlag.safeParse(raw);
  return parsed.success && parsed.data;
}

export interface PaymentsEnv {
  readonly paddleWebhookSecret: string;
  readonly supabaseSecretKey: string;
}

const paymentsEnvSchema = z.object({
  PADDLE_WEBHOOK_SECRET: z.string().trim().min(1),
  SUPABASE_SECRET_KEY: z.string().trim().min(1),
});

/**
 * The payment webhook's secrets (D-309, D-310), or null while either is missing. Read apart from
 * `serverEnvSchema`, so an environment without payments keeps every other page working; the
 * webhook then answers 503.
 */
export function getPaymentsEnv(env: NodeJS.ProcessEnv = process.env): PaymentsEnv | null {
  const parsed = paymentsEnvSchema.safeParse(env);
  if (!parsed.success) return null;
  return {
    paddleWebhookSecret: parsed.data.PADDLE_WEBHOOK_SECRET,
    supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY,
  };
}

/** The variables a reader takes: process.env, or a plain object in tests. */
type EnvSource = Readonly<Record<string, string | undefined>>;

const priceId = z.string().regex(/^pri_[a-z0-9]{1,60}$/);

const pricesSchema = z.object({
  PADDLE_PRICE_STANDARD: priceId,
  PADDLE_PRICE_ADVENTURER: priceId,
  PADDLE_PRICE_UPGRADE: priceId,
});

/**
 * The provider's prices of the packages in this environment (D-317): sandbox prices on Preview,
 * live prices on Production. Null while one is missing or malformed: checkout stays closed, and the
 * webhook answers 500 so the provider sends the event again once they are set.
 */
export function getPaddlePrices(env: EnvSource = process.env): OfferPrices | null {
  const parsed = pricesSchema.safeParse(env);
  if (!parsed.success) return null;
  return {
    standard: parsed.data.PADDLE_PRICE_STANDARD,
    adventurer: parsed.data.PADDLE_PRICE_ADVENTURER,
    upgrade: parsed.data.PADDLE_PRICE_UPGRADE,
  };
}

export interface CheckoutEnv {
  /** Paddle's client-side token: public by design, it only opens checkouts. */
  readonly clientToken: string;
  /** From the token's prefix: test_ is the sandbox, live_ the live account. */
  readonly environment: 'sandbox' | 'production';
  readonly prices: OfferPrices;
}

const clientTokenSchema = z.string().regex(/^(test|live)_[A-Za-z0-9]{1,100}$/);

/** What the checkout needs, or null while it is not configured: the buy buttons then say "soon". */
export function getCheckoutEnv(env: EnvSource = process.env): CheckoutEnv | null {
  const token = clientTokenSchema.safeParse(env.PADDLE_CLIENT_TOKEN);
  const prices = getPaddlePrices(env);
  if (!token.success || prices === null) return null;
  return {
    clientToken: token.data,
    environment: token.data.startsWith('test_') ? 'sandbox' : 'production',
    prices,
  };
}
