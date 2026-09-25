import { getClientEnv } from '@/env/client';
import { getServerEnv } from '@/env/server';

const SUPABASE_TIMEOUT_MS = 3000;

type SupabaseProbe =
  | { reachable: true; latency_ms: number; reason: null }
  | { reachable: false; latency_ms: null; reason: string };

/**
 * Calls Supabase Auth's health endpoint. On failure, `reason` says why (`http_<status>`,
 * `timeout` or `network`) so a wrong URL or key can be told apart without exposing either.
 */
async function probeSupabase(url: string, publishableKey: string): Promise<SupabaseProbe> {
  const startedAt = performance.now();
  try {
    const response = await fetch(new URL('/auth/v1/health', url).href, {
      headers: { apikey: publishableKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { reachable: false, latency_ms: null, reason: `http_${String(response.status)}` };
    }
    return { reachable: true, latency_ms: Math.round(performance.now() - startedAt), reason: null };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return { reachable: false, latency_ms: null, reason: timedOut ? 'timeout' : 'network' };
  }
}

/**
 * Liveness and co-location check. In production `region` must be "fra1" and the round trip
 * to Supabase (Frankfurt) should stay low. Returns no configuration values.
 */
export async function GET(): Promise<Response> {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getClientEnv();
  const region = getServerEnv().VERCEL_REGION ?? 'local';
  const supabase = await probeSupabase(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return Response.json(
    { status: supabase.reachable ? 'ok' : 'degraded', region, supabase },
    { status: supabase.reachable ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
