import { type CookieOptions, createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { getClientEnv } from '@/env/client';
import { hardenAuthCookie } from './cookies';
import type { Database } from './database.types';

interface RefreshedSession {
  cookies: { name: string; value: string; options: CookieOptions }[];
  headers: Record<string, string>;
}

/** True when the request carries a Supabase session cookie (names start with "sb-"). */
export function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'));
}

/**
 * Refreshes an expiring session before the page renders. The new cookies are written onto the
 * request itself, so the page rendered for this request already sees the fresh session, and are
 * returned so the caller can send them to the browser with `applyRefreshedSession`.
 * Server Components cannot set cookies, so without this a signed-in user would be signed out
 * once the access token expires (one hour). Pages still check the session themselves.
 */
export async function refreshSession(request: NextRequest): Promise<RefreshedSession> {
  const env = getClientEnv();
  const refreshed: RefreshedSession = { cookies: [], headers: {} };
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const cookie of cookiesToSet) request.cookies.set(cookie.name, cookie.value);
          refreshed.cookies = cookiesToSet;
          refreshed.headers = headers;
        },
      },
    },
  );
  await supabase.auth.getClaims();
  return refreshed;
}

export function applyRefreshedSession(response: NextResponse, refreshed: RefreshedSession): void {
  for (const { name, value, options } of refreshed.cookies) {
    response.cookies.set(name, value, hardenAuthCookie(options));
  }
  // Responses that set auth cookies must never be cached by a CDN.
  for (const [key, value] of Object.entries(refreshed.headers)) response.headers.set(key, value);
}
