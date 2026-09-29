import { type Locale, routing } from '@/i18n/routing';

const LOCALE_PATH = new RegExp(`^/(${routing.locales.join('|')})(/[A-Za-z0-9/_-]*)?$`);

/**
 * Where to send the user after sign-in. Only paths of this site under /ar or /en are accepted,
 * so a crafted link cannot bounce the user to another site (open redirect).
 */
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || value.includes('//') || !LOCALE_PATH.test(value)) return fallback;
  return value;
}

/** The locale a path starts with, or the default. */
export function localeOfPath(path: string): Locale {
  const match = LOCALE_PATH.exec(path);
  return match?.[1] === 'en' ? 'en' : routing.defaultLocale;
}

/** The signed-in home: the list of the user's projects. */
export function projectsPath(locale: Locale): string {
  return `/${locale}/projects`;
}

/**
 * The request header in which proxy.ts passes the page's own path to the page, so a sign-in
 * redirect can come back to it. The proxy overwrites whatever the browser sent.
 */
export const PATH_HEADER = 'x-sbn-path';

/**
 * The sign-in page, with a way back to `from` (checked by safeNextPath). The projects list is
 * where sign-in goes anyway, so it adds nothing to the address.
 */
export function loginPath(locale: Locale, from?: string | null): string {
  const next = safeNextPath(from, projectsPath(locale));
  if (next === projectsPath(locale)) return `/${locale}/login`;
  return `/${locale}/login?next=${encodeURIComponent(next)}`;
}
