import { getServerEnv, type ServerEnv } from '@/env/server';

/**
 * True only on the production deployment with SITE_INDEXABLE=true (docs/DECISIONS.md D-027, D-054).
 * Previews and local builds are never indexable. Mirrored in next.config.ts for the X-Robots-Tag header.
 */
export function isIndexable(env: ServerEnv = getServerEnv()): boolean {
  return env.SITE_INDEXABLE && env.VERCEL_ENV === 'production';
}

/**
 * Who may read the public pages (D-303). `closed`: nobody, the state before launch. `ai-only`: only
 * the named AI crawlers (src/seo/robots.ts), while search engines stay out. `open`: everybody, at
 * public launch. Same rule as `crawlerPolicy` in next.config.ts, which cannot import this module.
 */
export type CrawlerPolicy = 'closed' | 'ai-only' | 'open';

export function crawlerPolicy(env: ServerEnv = getServerEnv()): CrawlerPolicy {
  if (isIndexable(env)) return 'open';
  return env.AI_CRAWLERS_ALLOWED && env.VERCEL_ENV === 'production' ? 'ai-only' : 'closed';
}
