import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { aiContextRedirect, aiContextRewrite, arabicRedirect } from '@/i18n/arabic-only';
import { routing } from '@/i18n/routing';
import { PATH_HEADER } from '@/lib/auth/next-path';
import { applyRefreshedSession, hasSessionCookie, refreshSession } from '@/lib/supabase/proxy';

const handleLanguageRouting = createMiddleware(routing);

/**
 * 1. Refreshes a signed-in user's session (only when a session cookie is present, so anonymous
 *    visits never reach Supabase).
 * 2. Tells the page its own path (PATH_HEADER), so a sign-in redirect can come back to it.
 * 0. Sends an English address with no English version to its Arabic page (D-336).
 * 3. Sends every page request to its /ar or /en version (D-070). next-intl forwards the request
 *    headers, so the page sees the refreshed session and the path.
 */
export default async function proxy(request: NextRequest) {
  const single = aiContextRedirect(request.nextUrl.pathname);
  if (single) {
    const target = request.nextUrl.clone();
    target.pathname = single;
    return NextResponse.redirect(target, 308);
  }
  const inside = aiContextRewrite(request.nextUrl.pathname);
  if (inside) {
    const target = request.nextUrl.clone();
    target.pathname = inside;
    return NextResponse.rewrite(target);
  }
  const arabic = arabicRedirect(request.nextUrl.pathname);
  if (arabic) {
    const target = request.nextUrl.clone();
    target.pathname = arabic;
    return NextResponse.redirect(target, 308);
  }
  const refreshed = hasSessionCookie(request) ? await refreshSession(request) : null;
  request.headers.set(PATH_HEADER, request.nextUrl.pathname);
  const response = handleLanguageRouting(request);
  if (refreshed) applyRefreshedSession(response, refreshed);
  return response;
}

export const config = {
  // Pages only: not API routes, the auth callback, Next.js internals or files with an extension.
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
