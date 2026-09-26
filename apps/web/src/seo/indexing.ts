import { getServerEnv, type ServerEnv } from '@/env/server';

/**
 * True only on the production deployment with SITE_INDEXABLE=true (docs/DECISIONS.md D-027, D-054).
 * Previews and local builds are never indexable. Mirrored in next.config.ts for the X-Robots-Tag header.
 */
export function isIndexable(env: ServerEnv = getServerEnv()): boolean {
  return env.SITE_INDEXABLE && env.VERCEL_ENV === 'production';
}
