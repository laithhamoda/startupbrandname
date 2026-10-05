import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { googleEnabledIn, googleSignInAvailable } from './google';

const settings = (google: boolean) => ({
  external: { google, email: true },
  disable_signup: false,
});

describe('googleEnabledIn', () => {
  it('reads the Google flag from Supabase settings', () => {
    expect(googleEnabledIn(settings(true))).toBe(true);
    expect(googleEnabledIn(settings(false))).toBe(false);
  });

  it.each([null, {}, { external: {} }, { external: { google: 'yes' } }, 'text'])(
    'treats %j as Google being off',
    (value) => {
      expect(googleEnabledIn(value)).toBe(false);
    },
  );
});

describe('googleSignInAvailable', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('AUTH_GOOGLE_ENABLED', 'true');
    vi.stubEnv('AUTH_GOOGLE_VERIFY_PROVIDER', 'true');
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('stays hidden, without asking Supabase, when the environment switch is off', async () => {
    vi.stubEnv('AUTH_GOOGLE_ENABLED', 'false');
    expect(await googleSignInAvailable()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows when Supabase has Google enabled', async () => {
    fetchMock.mockResolvedValue(Response.json(settings(true)));
    expect(await googleSignInAvailable()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/settings',
      expect.objectContaining({ headers: { apikey: 'sb_publishable_test' } }),
    );
  });

  it('stays hidden when Supabase has Google disabled (the mismatch this guards against)', async () => {
    fetchMock.mockResolvedValue(Response.json(settings(false)));
    expect(await googleSignInAvailable()).toBe(false);
  });

  it('stays hidden when Supabase answers with an error', async () => {
    fetchMock.mockResolvedValue(new Response('unavailable', { status: 503 }));
    expect(await googleSignInAvailable()).toBe(false);
  });

  it('stays hidden when Supabase cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    expect(await googleSignInAvailable()).toBe(false);
  });

  it('skips the check when tests turn it off', async () => {
    vi.stubEnv('AUTH_GOOGLE_VERIFY_PROVIDER', 'false');
    expect(await googleSignInAvailable()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
