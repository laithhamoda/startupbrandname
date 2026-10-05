import type { CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import {
  REFRESH_DEADLINE_MS,
  applyRefreshedSession,
  hasSessionCookie,
  refreshSession,
} from './proxy';

type SetAll = (
  cookies: { name: string; value: string; options: CookieOptions }[],
  headers: Record<string, string>,
) => void;

interface ClientOptions {
  cookies: { getAll: () => { name: string; value: string }[]; setAll: SetAll };
  global?: { fetch?: typeof fetch };
}

/** The options the proxy last gave the Supabase client, and what its getClaims does. */
const ssr: {
  options: ClientOptions | undefined;
  getClaims: (setAll: SetAll) => Promise<unknown>;
} = vi.hoisted(() => ({
  options: undefined,
  getClaims: () => Promise.resolve({ data: null, error: null }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: ClientOptions) => {
    ssr.options = options;
    return { auth: { getClaims: () => ssr.getClaims(options.cookies.setAll) } };
  },
}));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const FRESH = [{ name: 'sb-test-auth-token', value: 'fresh', options: { path: '/' } }];

/** The client's getClaims runs `getClaims` with the cookie writer the proxy gave it. */
function fakeClient(getClaims: (setAll: SetAll) => Promise<unknown>) {
  ssr.getClaims = getClaims;
}

/** The cookie writer the proxy gave the client, to call it after the deadline. */
function cookieWriter(): SetAll {
  if (!ssr.options) throw new Error('No Supabase client was created.');
  return ssr.options.cookies.setAll;
}

function request(): NextRequest {
  return new NextRequest('http://localhost:3000/ar/projects', {
    headers: { cookie: 'sb-test-auth-token=old; NEXT_LOCALE=ar', 'x-vercel-id': 'fra1::abc' },
  });
}

/** A Server Action posted from a step page, as the browser sends it. */
function actionRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/ar/projects/p/q/A1', {
    method: 'POST',
    headers: {
      cookie: 'sb-test-auth-token=old; NEXT_LOCALE=ar',
      'next-action': 'a1b2c3',
      'x-vercel-id': 'fra1::abc',
    },
  });
}

/** Never settles: Supabase does not answer. */
const never = () => new Promise<never>(() => undefined);

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.useFakeTimers();
});

afterEach(() => {
  ssr.options = undefined;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('hasSessionCookie', () => {
  it('is true only when a Supabase cookie is present', () => {
    expect(hasSessionCookie(request())).toBe(true);
    expect(
      hasSessionCookie(
        new NextRequest('http://localhost:3000/ar', { headers: { cookie: 'NEXT_LOCALE=ar' } }),
      ),
    ).toBe(false);
  });
});

describe('refreshSession', () => {
  it('reads the request cookies and limits each Supabase request of the proxy', async () => {
    fakeClient(() => Promise.resolve({ data: null, error: null }));

    await refreshSession(request());

    expect(ssr.options?.cookies.getAll()).toContainEqual({
      name: 'sb-test-auth-token',
      value: 'old',
    });
    expect(ssr.options?.global?.fetch).toBeTypeOf('function');
  });

  it('puts a refreshed session on the request and returns it for the browser', async () => {
    fakeClient((setAll) => {
      setAll(FRESH, { 'Cache-Control': 'private, no-cache, no-store' });
      return Promise.resolve({ data: { claims: {} }, error: null });
    });
    const incoming = request();

    const refreshed = await refreshSession(incoming);

    expect(refreshed.cookies).toEqual(FRESH);
    expect(refreshed.headers).toEqual({ 'Cache-Control': 'private, no-cache, no-store' });
    expect(incoming.cookies.get('sb-test-auth-token')?.value).toBe('fresh');
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('renders signed out when Supabase does not answer within the deadline', async () => {
    fakeClient(never);
    const incoming = request();

    const pending = refreshSession(incoming);
    await vi.advanceTimersByTimeAsync(REFRESH_DEADLINE_MS);
    const refreshed = await pending;

    expect(refreshed).toEqual({ cookies: [], headers: {} });
    expect(incoming.cookies.has('sb-test-auth-token')).toBe(false);
    expect(incoming.cookies.get('NEXT_LOCALE')?.value).toBe('ar');
    expect(log.warn).toHaveBeenCalledWith('proxy.refresh_timeout', {
      stage: 'page',
      requestId: 'fra1::abc',
    });
  });

  it('lets a Server Action past the deadline with its session, to check it itself', async () => {
    fakeClient(never);
    const incoming = actionRequest();

    const pending = refreshSession(incoming);
    await vi.advanceTimersByTimeAsync(REFRESH_DEADLINE_MS);
    const refreshed = await pending;
    cookieWriter()(FRESH, {});

    // Signed out, a save would send the founder to sign in and lose the typed answer. A refresh
    // that completes late is left to the action's own client, as for a page.
    expect(refreshed).toEqual({ cookies: [], headers: {} });
    expect(incoming.cookies.get('sb-test-auth-token')?.value).toBe('old');
    expect(log.warn).toHaveBeenCalledWith('proxy.refresh_timeout', {
      stage: 'action',
      requestId: 'fra1::abc',
    });
  });

  it('waits the whole deadline before giving up', async () => {
    fakeClient(never);
    let settled = false;

    const pending = refreshSession(request()).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(REFRESH_DEADLINE_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(settled).toBe(true);
  });

  it('keeps a session already refreshed when only the check after it is slow', async () => {
    fakeClient((setAll) => {
      setAll(FRESH, {});
      return never();
    });
    const incoming = request();

    const pending = refreshSession(incoming);
    await vi.advanceTimersByTimeAsync(REFRESH_DEADLINE_MS);
    const refreshed = await pending;

    expect(refreshed.cookies).toEqual(FRESH);
    expect(incoming.cookies.get('sb-test-auth-token')?.value).toBe('fresh');
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('ignores a refresh that completes after the page went on signed out', async () => {
    fakeClient(never);
    const incoming = request();

    const pending = refreshSession(incoming);
    await vi.advanceTimersByTimeAsync(REFRESH_DEADLINE_MS);
    const refreshed = await pending;
    cookieWriter()(FRESH, {});

    expect(refreshed.cookies).toEqual([]);
    expect(incoming.cookies.has('sb-test-auth-token')).toBe(false);
  });
});

describe('applyRefreshedSession', () => {
  it('sends the refreshed cookies hardened, with the headers that keep CDNs from caching', () => {
    const response = NextResponse.next();

    applyRefreshedSession(response, {
      cookies: FRESH,
      headers: { 'Cache-Control': 'private, no-cache, no-store' },
    });

    expect(response.cookies.get('sb-test-auth-token')).toMatchObject({
      value: 'fresh',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-cache, no-store');
  });
});
