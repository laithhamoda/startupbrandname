import type { CookieOptions } from '@supabase/ssr';
import { isHttpsDeployment } from '@/env/deployment';

/**
 * Hardening applied to every Supabase auth cookie. The app talks to Supabase only from the
 * server (Server Components, Server Actions, the proxy and the auth callback), so the browser
 * never needs to read these cookies: httpOnly keeps the session out of reach of injected scripts.
 * `Secure` is on wherever Vercel serves the site (always HTTPS); local HTTP needs it off.
 */
export function hardenAuthCookie(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttpsDeployment(),
    path: '/',
  };
}
