import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getClientEnv } from '@/env/client';
import { hardenAuthCookie } from './cookies';
import type { Database } from './database.types';
import { SERVER_FETCH_TIMEOUT_MS, timedFetch } from './timed-fetch';

/**
 * Supabase client acting as the signed-in user (publishable key + the user's session), so row
 * level security applies to every query. For Server Components, Server Actions and Route Handlers.
 * Each request it makes gives up after 8 seconds (REL-4).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getClientEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, hardenAuthCookie(options));
            }
          } catch {
            // Server Components cannot set cookies; the proxy refreshes the session instead.
          }
        },
      },
      global: { fetch: timedFetch(SERVER_FETCH_TIMEOUT_MS) },
    },
  );
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
