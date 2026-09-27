import type { BeforeSendEvent } from '@vercel/analytics/next';
import type { ServerEnv } from '@/env/server';

/** Drops query strings and fragments, so no code or token in a URL reaches the statistics. */
export function withoutQuery(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: event.url.split(/[?#]/)[0] ?? event.url };
}

/** Only the production deployment on Vercel is counted: previews and local builds never are (D-092). */
export function countVisits(env: Pick<ServerEnv, 'VERCEL' | 'VERCEL_ENV'>): boolean {
  return env.VERCEL === '1' && env.VERCEL_ENV === 'production';
}
