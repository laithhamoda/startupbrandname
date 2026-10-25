import type { MetadataRoute } from 'next';
import { site } from '@/config/site';
import { routing } from '@/i18n/routing';
import type { CrawlerPolicy } from './indexing';

/** Signed-in, sign-up and internal pages: never crawled, whatever the crawler (D-090). */
const PRIVATE_PATHS = ['/design', '/projects', '/account', '/onboarding'] as const;

/**
 * The AI crawlers that may read the public pages before public launch (D-303): the ones that
 * answer people's questions with a source (search and user-triggered fetches) and the ones the
 * owner named. Vendors rename these; check their documentation when adding or renaming one.
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
] as const;

const privateRules = [
  '/api/',
  '/auth/',
  ...routing.locales.flatMap((locale) => PRIVATE_PATHS.map((path) => `/${locale}${path}`)),
];

/**
 * Public pages are open to the crawlers the policy names, the private areas are closed to all
 * (D-090). Before public launch nothing is open (D-027), except the AI crawlers when the owner
 * allows them (D-303); search engines stay out until the launch.
 */
export function robotsRules(policy: CrawlerPolicy): MetadataRoute.Robots {
  if (policy === 'closed') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  if (policy === 'ai-only') {
    return {
      rules: [
        { userAgent: [...AI_CRAWLERS], allow: '/', disallow: privateRules },
        { userAgent: '*', disallow: '/' },
      ],
    };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: privateRules },
    sitemap: `${site.origin}/sitemap.xml`,
    host: site.origin,
  };
}
