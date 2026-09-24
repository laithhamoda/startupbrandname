import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const SUPABASE_URL = 'https://abc.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_test123';

function mockFetch(implementation: typeof fetch) {
  const fetchMock = vi.fn<typeof fetch>(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', PUBLISHABLE_KEY);
  vi.stubEnv('VERCEL_REGION', 'fra1');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET /api/health', () => {
  it('reports the region and a reachable Supabase', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(new Response(null, { status: 200 })));

    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({ status: 'ok', region: 'fra1', supabase: { reachable: true } });
    expect(fetchMock).toHaveBeenCalledWith(
      `${SUPABASE_URL}/auth/v1/health`,
      expect.objectContaining({ headers: { apikey: PUBLISHABLE_KEY } }),
    );
  });

  it('returns 503 when Supabase cannot be reached', async () => {
    mockFetch(() => Promise.reject(new Error('network down')));

    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: 'degraded',
      supabase: { reachable: false, latency_ms: null },
    });
  });

  it('returns 503 when Supabase answers with an error status', async () => {
    mockFetch(() => Promise.resolve(new Response(null, { status: 502 })));

    const response = await GET();

    expect(response.status).toBe(503);
  });

  it('reports "local" outside Vercel', async () => {
    vi.stubEnv('VERCEL_REGION', undefined);
    mockFetch(() => Promise.resolve(new Response(null, { status: 200 })));

    const body: unknown = await (await GET()).json();

    expect(body).toMatchObject({ region: 'local' });
  });

  it('does not expose configuration values', async () => {
    mockFetch(() => Promise.resolve(new Response(null, { status: 200 })));

    const text = await (await GET()).text();

    expect(text).not.toContain(SUPABASE_URL);
    expect(text).not.toContain(PUBLISHABLE_KEY);
  });
});
