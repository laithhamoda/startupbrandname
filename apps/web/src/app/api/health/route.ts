import { getClientEnv } from '@/env/client';
import { getServerEnv } from '@/env/server';

const SUPABASE_TIMEOUT_MS = 3000;

/**
 * Liveness and co-location check. In production `region` must be "fra1" and the round trip
 * to Supabase (Frankfurt) should stay low. Returns no configuration values.
 */
export async function GET(): Promise<Response> {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getClientEnv();
  const region = getServerEnv().VERCEL_REGION ?? 'local';

  const startedAt = performance.now();
  const reachable = await fetch(new URL('/auth/v1/health', NEXT_PUBLIC_SUPABASE_URL).href, {
    headers: { apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    cache: 'no-store',
    signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
  }).then(
    (response) => response.ok,
    () => false,
  );
  const latencyMs = Math.round(performance.now() - startedAt);

  return Response.json(
    {
      status: reachable ? 'ok' : 'degraded',
      region,
      supabase: { reachable, latency_ms: reachable ? latencyMs : null },
    },
    { status: reachable ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
