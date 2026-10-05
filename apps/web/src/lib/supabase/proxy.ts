import { type CookieOptions, createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { getClientEnv } from '@/env/client';
import { log } from '@/lib/log';
import { hardenAuthCookie } from './cookies';
import type { Database } from './database.types';
import { PROXY_FETCH_TIMEOUT_MS, timedFetch } from './timed-fetch';

interface RefreshedSession {
  cookies: { name: string; value: string; options: CookieOptions }[];
  headers: Record<string, string>;
}

/**
 * How long the proxy waits for a session refresh before the page renders signed out (REL-4,
 * D-168). auth-js retries a refresh that fails to connect for up to 30 seconds, each attempt
 * bounded by PROXY_FETCH_TIMEOUT_MS; this bounds them all.
 */
export const REFRESH_DEADLINE_MS = 4_000;

/** True when the request carries a Supabase session cookie (names start with "sb-"). */
export function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'));
}

/**
 * True for a Server Action: pages answer only GET, so a POST that reaches the proxy is one (sent
 * with a Next-Action header, or as a form without JavaScript).
 */
function isServerAction(request: NextRequest): boolean {
  return request.method === 'POST';
}

/** True when `work` settles within `ms`, false when the deadline comes first. */
async function settlesWithin(work: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<false>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, ms);
  });
  try {
    return await Promise.race([work.then(() => true), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Refreshes an expiring session before the page renders. The new cookies are written onto the
 * request itself, so the page rendered for this request already sees the fresh session, and are
 * returned so the caller can send them to the browser with `applyRefreshedSession`.
 * Server Components cannot set cookies, so without this a signed-in user would be signed out
 * once the access token expires (one hour). Pages still check the session themselves.
 *
 * When Supabase does not answer within REFRESH_DEADLINE_MS, this page renders signed out: the
 * session cookies are taken off the request (not off the browser, which tries again on the next
 * page), so the page does not wait for Supabase in turn. A refresh that completes after that
 * changes nothing here; if Supabase rotated the refresh token meanwhile, the browser's old one may
 * later be refused, which signs the visitor out (accepted, D-168).
 *
 * A Server Action keeps its session cookies instead: signed out, a save would send the founder to
 * sign in and lose the typed answer. The action checks the session itself, each Supabase request
 * bounded by SERVER_FETCH_TIMEOUT_MS, so a refresh Supabase answers late still lets it through.
 */
export async function refreshSession(request: NextRequest): Promise<RefreshedSession> {
  const env = getClientEnv();
  const refreshed: RefreshedSession = { cookies: [], headers: {} };
  let abandoned = false;
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          if (abandoned) return;
          for (const cookie of cookiesToSet) request.cookies.set(cookie.name, cookie.value);
          refreshed.cookies = cookiesToSet;
          refreshed.headers = headers;
        },
      },
      global: { fetch: timedFetch(PROXY_FETCH_TIMEOUT_MS) },
    },
  );
  // A session already refreshed when the deadline comes is kept: only the check after it is slow.
  if (
    (await settlesWithin(supabase.auth.getClaims(), REFRESH_DEADLINE_MS)) ||
    refreshed.cookies.length > 0
  ) {
    return refreshed;
  }
  abandoned = true;
  const action = isServerAction(request);
  if (!action) {
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) request.cookies.delete(cookie.name);
    }
  }
  await log.warn('proxy.refresh_timeout', {
    stage: action ? 'action' : 'page',
    requestId: request.headers.get('x-vercel-id') ?? undefined,
  });
  return refreshed;
}

export function applyRefreshedSession(response: NextResponse, refreshed: RefreshedSession): void {
  for (const { name, value, options } of refreshed.cookies) {
    response.cookies.set(name, value, hardenAuthCookie(options));
  }
  // Responses that set auth cookies must never be cached by a CDN.
  for (const [key, value] of Object.entries(refreshed.headers)) response.headers.set(key, value);
}
