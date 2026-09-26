import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

/** Sends every page request to its /ar or /en version (D-070). */
export default createMiddleware(routing);

export const config = {
  // Pages only: not API routes, the auth callback, Next.js internals or files with an extension.
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
