import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { applyRefreshedSession, hasSessionCookie, refreshSession } from '@/lib/supabase/proxy';

const handleLanguageRouting = createMiddleware(routing);

/**
 * 1. Refreshes a signed-in user's session (only when a session cookie is present, so anonymous
 *    visits never reach Supabase).
 * 2. Sends every page request to its /ar or /en version (D-070). next-intl forwards the request
 *    headers, so the page sees the refreshed session.
 */
export default async function proxy(request: NextRequest) {
  const refreshed = hasSessionCookie(request) ? await refreshSession(request) : null;
  const response = handleLanguageRouting(request);
  if (refreshed) applyRefreshedSession(response, refreshed);
  return response;
}

export const config = {
  // Pages only: not API routes, the auth callback, Next.js internals or files with an extension.
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
