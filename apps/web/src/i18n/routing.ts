import { defineRouting } from 'next-intl/routing';

/**
 * Arabic (default, right-to-left) and English, each under its own prefix: /ar/… and /en/…
 * `/` redirects to the saved language, else the browser language, else Arabic (D-067, D-070).
 */
export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export const DIRECTION: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', en: 'ltr' };

/** Open Graph locale tags (language_TERRITORY). The platform is global, so no single country. */
export const OG_LOCALE: Record<Locale, string> = { ar: 'ar_AR', en: 'en_US' };
