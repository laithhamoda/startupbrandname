import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getClientEnv } from '@/env/client';
import type { Database } from './database.types';
import { SERVER_FETCH_TIMEOUT_MS, timedFetch } from './timed-fetch';

/**
 * Supabase client with the secret key, which bypasses row level security (D-310). Only the payment
 * webhook uses it, because a provider's request carries no user session; everything a user does
 * still goes through `createSupabaseServerClient`. No session is kept, and each request gives up
 * after 8 seconds (REL-4).
 */
export function createSupabaseAdminClient(secretKey: string) {
  return createClient<Database>(getClientEnv().NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: timedFetch(SERVER_FETCH_TIMEOUT_MS) },
  });
}

export type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
