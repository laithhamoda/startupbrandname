import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import { PATH_HEADER } from './next-path';
import { finishSignIn, requireAccount } from './session';
import { SIGNUP_INTENT_COOKIE, serializeSignupIntent, type SignupIntent } from './signup-intent';

const jar = vi.hoisted(() => new Map<string, string>());
const requestHeaders = vi.hoisted(() => new Headers());

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      delete: (name: string) => jar.delete(name),
    }),
  headers: () => Promise.resolve(requestHeaders),
}));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** A client whose RPCs answer from `results`; the profile query answers `profile`. */
function fakeClient(
  results: Record<string, { data?: unknown; error?: unknown }>,
  profile: unknown = null,
) {
  const rpc = vi.fn((name: string) =>
    Promise.resolve({ data: null, error: null, ...results[name] }),
  );
  const signOut = vi.fn(() => Promise.resolve({ error: null }));
  const client = {
    rpc,
    auth: { signOut },
    from: () => ({
      select: () => ({ maybeSingle: () => Promise.resolve({ data: profile, error: null }) }),
    }),
  } as unknown as SupabaseServerClient;
  return { client, rpc, signOut };
}

function answeredSignup(intent: Partial<SignupIntent> = {}) {
  jar.set(
    SIGNUP_INTENT_COOKIE,
    serializeSignupIntent({
      country: 'JO',
      locale: 'ar',
      hasProject: true,
      crossborder: false,
      ...intent,
    }),
  );
  jar.set('sb-project-auth-token', 'session');
}

/** The target of a redirect() thrown by `action`, read from its digest. */
async function redirectTarget(action: Promise<unknown>): Promise<string> {
  const error: unknown = await action.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  const digest = (error as { digest?: string } | null)?.digest ?? '';
  return digest.split(';')[2] ?? '';
}

beforeEach(() => {
  jar.clear();
  requestHeaders.delete(PATH_HEADER);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('requireAccount', () => {
  function signedOut() {
    const client = { auth: { getClaims: () => Promise.resolve({ data: null }) } };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      client as unknown as SupabaseServerClient,
    );
  }

  it('sends a signed-out visitor to sign-in with the way back to the page', async () => {
    signedOut();
    requestHeaders.set(PATH_HEADER, '/ar/projects/0b6f4a52-5f2e-4c8e-9a51-2d0c1c0e7d11/q/A7');

    expect(await redirectTarget(requireAccount('ar'))).toBe(
      '/ar/login?next=%2Far%2Fprojects%2F0b6f4a52-5f2e-4c8e-9a51-2d0c1c0e7d11%2Fq%2FA7',
    );
  });

  it('never carries a path that is not one of ours', async () => {
    signedOut();
    requestHeaders.set(PATH_HEADER, '//evil.example/ar');

    expect(await redirectTarget(requireAccount('en'))).toBe('/en/login');
  });
});

describe('finishSignIn', () => {
  it('records the signup answers once, then goes on', async () => {
    answeredSignup();
    const { client, rpc } = fakeClient({ complete_onboarding: { data: 'completed' } });

    expect(await finishSignIn(client, 'ar')).toBe('/ar/projects');
    expect(rpc).toHaveBeenCalledWith(
      'complete_onboarding',
      expect.objectContaining({ p_country_code: 'JO' }),
    );
    expect(jar.has(SIGNUP_INTENT_COOKIE)).toBe(false);
  });

  it('goes on without a signup cookie', async () => {
    const { client, rpc } = fakeClient({});
    expect(await finishSignIn(client, 'en', '/en/account')).toBe('/en/account');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends the user to the onboarding gate when recording the answers fails', async () => {
    answeredSignup();
    const { client } = fakeClient({
      complete_onboarding: { error: { code: '57014', message: 'canceling statement' } },
    });

    // The code is used up: the page after it (here the projects) sends a profile-less account to
    // the gate, which asks again.
    expect(await finishSignIn(client, 'ar')).toBe('/ar/projects');
    expect(jar.has(SIGNUP_INTENT_COOKIE)).toBe(false);
    expect(log.error).toHaveBeenCalledWith('auth.onboarding_failed', {
      code: '57014',
      stage: 'sign_in',
    });
  });

  it('deletes a new account whose signup cookie names a closed country', async () => {
    vi.stubEnv('MARKET_DZ_ENABLED', 'false');
    answeredSignup({ country: 'DZ' });
    const { client, rpc, signOut } = fakeClient({});

    expect(await finishSignIn(client, 'ar')).toBe('/ar/not-available');
    expect(rpc).not.toHaveBeenCalledWith('complete_onboarding', expect.anything());
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    expect(signOut).toHaveBeenCalled();
    expect(jar.has('sb-project-auth-token')).toBe(false);
  });

  it('leaves an existing account alone when a stale cookie names a closed country', async () => {
    vi.stubEnv('MARKET_DZ_ENABLED', 'false');
    answeredSignup({ country: 'DZ' });
    const { client, rpc } = fakeClient({}, { country_code: 'JO', locale: 'ar' });

    expect(await finishSignIn(client, 'ar')).toBe('/ar/projects');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('records an Algerian signup while the market is open', async () => {
    answeredSignup({ country: 'DZ' });
    const { client, rpc } = fakeClient({ complete_onboarding: { data: 'completed' } });

    expect(await finishSignIn(client, 'ar')).toBe('/ar/projects');
    expect(rpc).toHaveBeenCalledWith(
      'complete_onboarding',
      expect.objectContaining({ p_country_code: 'DZ' }),
    );
  });
});
