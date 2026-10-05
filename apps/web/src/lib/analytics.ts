import type { BeforeSendEvent } from '@vercel/analytics/next';
import type { ServerEnv } from '@/env/server';

/**
 * A path segment that is a UUID, such as a project's ID. No lookbehind: this runs in the browser,
 * and older Safari versions reject the whole script for one.
 */
const ID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/**
 * Drops query strings and fragments, so no code or token in a URL reaches the statistics, and
 * replaces each ID in the path with ":id", so a page of one founder's project is counted like any
 * other (PRIV-14, D-153).
 */
export function withoutQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = event.url.split(/[?#]/)[0] ?? event.url;
  return { ...event, url: url.replace(ID_SEGMENT, '/:id') };
}

/** Only the production deployment on Vercel is counted: previews and local builds never are (D-092). */
export function countVisits(env: Pick<ServerEnv, 'VERCEL' | 'VERCEL_ENV'>): boolean {
  return env.VERCEL === '1' && env.VERCEL_ENV === 'production';
}
