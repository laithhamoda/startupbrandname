import type { MetadataRoute } from 'next';
import { site } from '@/config/site';
import { routing } from '@/i18n/routing';

/** Signed-in, sign-up and internal pages: never crawled, whatever the crawler (D-090). */
const PRIVATE_PATHS = ['/design', '/projects', '/account', '/onboarding'] as const;

/**
 * One rule for every crawler, search engines and AI crawlers alike: public pages are open, the
 * private areas are closed (D-090). Nothing is open before public launch (D-027).
 */
export function robotsRules(indexable: boolean): MetadataRoute.Robots {
  if (!indexable) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/auth/',
        ...routing.locales.flatMap((locale) => PRIVATE_PATHS.map((path) => `/${locale}${path}`)),
      ],
    },
    sitemap: `${site.origin}/sitemap.xml`,
    host: site.origin,
  };
}
