import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getClientEnv } from '@/env/client';
import { loadLaunchWindow } from '@/lib/launch/spot';
import type { Database } from '@/lib/supabase/database.types';
import { SERVER_FETCH_TIMEOUT_MS, timedFetch } from '@/lib/supabase/timed-fetch';

/**
 * The free launch window as the public counter shows it (D-331, D-344): spots left and total, and
 * the end date. Public and cached for a minute at the edge, so a busy home page asks the database
 * about once a minute, not once a visit. It reads the database's own numbers through the public
 * `launch_window()`; nothing is made up when it cannot, the answer is then 503 and the counter hides.
 */
export async function GET() {
  const env = getClientEnv();
  // No session: the counter is the same for everyone, so the answer can be shared by the cache.
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: timedFetch(SERVER_FETCH_TIMEOUT_MS) },
    },
  );
  const window = await loadLaunchWindow(supabase);
  if (window === null) {
    return NextResponse.json(
      { error: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json(
    {
      open: window.open,
      spotsLeft: window.spotsLeft,
      spotsTotal: window.spotsTotal,
      endsAt: window.endsAt === null ? null : window.endsAt.toISOString(),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
