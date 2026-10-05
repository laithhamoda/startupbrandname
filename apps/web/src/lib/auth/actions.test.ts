import { revalidatePath } from 'next/cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  deleteAccount,
  setCrossborderConsent,
  startGoogleLogin,
  submitOnboarding,
  updatePreferences,
  verifyEmailCode,
} from './actions';

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => jar.set(name, value),
      delete: (name: string) => jar.delete(name),
    }),
  headers: () => Promise.resolve(new Headers({ host: 'localhost:3000' })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock('./google', () => ({ googleSignInAvailable: () => Promise.resolve(true) }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * A signed-in client without a profile; its RPCs answer from `results`. `writes` holds the error
 * of the profile update and of the auth metadata update, if they fail.
 */
function signedIn(
  results: Record<string, { data?: unknown; error?: unknown }> = {},
  writes: { profile?: unknown; metadata?: unknown } = {},
) {
  const rpc = vi.fn((name: string) =>
    Promise.resolve({ data: null, error: null, ...results[name] }),
  );
  const verifyOtp = vi.fn(() => Promise.resolve({ data: {}, error: null }));
  const signInWithOAuth = vi.fn(() =>
    Promise.resolve({ data: { url: 'http://127.0.0.1:54321/auth/v1/authorize' }, error: null }),
  );
  const updateUser = vi.fn<(attributes: unknown) => Promise<{ error: unknown }>>(() =>
    Promise.resolve({ error: writes.metadata ?? null }),
  );
  const update = vi.fn<(values: unknown) => { eq: () => Promise<{ error: unknown }> }>(() => ({
    eq: () => Promise.resolve({ error: writes.profile ?? null }),
  }));
  const client = {
    rpc,
    auth: {
      getClaims: () => Promise.resolve({ data: { claims: { sub: 'user-1' } } }),
      signOut: () => Promise.resolve({ error: null }),
      updateUser,
      verifyOtp,
      signInWithOAuth,
    },
    from: () => ({
      select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      update,
    }),
  };
  vi.mocked(createSupabaseServerClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
  );
  return { rpc, verifyOtp, signInWithOAuth, updateUser, update };
}

function codeForm(code: string, next?: string): FormData {
  const form = new FormData();
  form.set('email', 'founder@example.test');
  form.set('code', code);
  if (next !== undefined) form.set('next', next);
  return form;
}

function preferencesForm(country: string, language: string): FormData {
  const form = new FormData();
  form.set('country', country);
  form.set('language', language);
  return form;
}

function gateForm(country: string): FormData {
  const form = new FormData();
  form.set('country', country);
  form.set('project', 'yes');
  form.set('terms', 'on');
  return form;
}

/** The target of a redirect() thrown by an action, read from its digest. */
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
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('verifyEmailCode', () => {
  it.each(['12345678', '١٢٣٤٥٦٧٨', '۱۲۳۴۵۶۷۸', '1234-5678', ' 1234 5678 ', '١٢٣٤ ٥٦٧٨'])(
    'reads %j as the code 12345678',
    async (typed) => {
      const { verifyOtp } = signedIn();

      expect(await redirectTarget(verifyEmailCode('ar', { status: 'idle' }, codeForm(typed)))).toBe(
        '/ar/projects',
      );
      expect(verifyOtp).toHaveBeenCalledWith({
        email: 'founder@example.test',
        token: '12345678',
        type: 'email',
      });
    },
  );

  it.each(['12345', '', 'abcdefgh', '12345678901'])(
    'refuses %j without asking Supabase',
    async (typed) => {
      const { verifyOtp } = signedIn();

      expect(await verifyEmailCode('ar', { status: 'idle' }, codeForm(typed))).toEqual({
        status: 'error',
        error: 'invalidCode',
      });
      expect(verifyOtp).not.toHaveBeenCalled();
    },
  );

  it('goes back to the page that asked for sign-in', async () => {
    signedIn();
    const form = codeForm('12345678', '/en/projects/0b6f4a52-5f2e-4c8e-9a51-2d0c1c0e7d11/q/A7');

    expect(await redirectTarget(verifyEmailCode('en', { status: 'idle' }, form))).toBe(
      '/en/projects/0b6f4a52-5f2e-4c8e-9a51-2d0c1c0e7d11/q/A7',
    );
  });

  it.each(['https://evil.example/ar', '//evil.example/ar', '/ar/projects?x=1'])(
    'goes to the projects instead of %j',
    async (next) => {
      signedIn();

      expect(
        await redirectTarget(verifyEmailCode('ar', { status: 'idle' }, codeForm('12345678', next))),
      ).toBe('/ar/projects');
    },
  );
});

describe('startGoogleLogin', () => {
  it('asks Google to come back to the page that asked for sign-in', async () => {
    const { signInWithOAuth } = signedIn();

    await redirectTarget(startGoogleLogin('en', '/en/account'));
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: 'http://localhost:3000/auth/callback?next=%2Fen%2Faccount',
        }) as unknown,
      }),
    );
  });

  it('comes back to the projects for a page that is not one of ours', async () => {
    const { signInWithOAuth } = signedIn();

    await redirectTarget(startGoogleLogin('ar', 'https://evil.example/ar'));
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: 'http://localhost:3000/auth/callback?next=%2Far%2Fprojects',
        }) as unknown,
      }),
    );
  });
});

describe('submitOnboarding', () => {
  it('records the answers and opens the projects', async () => {
    const { rpc } = signedIn({ complete_onboarding: { data: 'completed' } });

    expect(await redirectTarget(submitOnboarding('ar', { status: 'idle' }, gateForm('JO')))).toBe(
      '/ar/projects',
    );
    expect(rpc).toHaveBeenCalledWith('complete_onboarding', expect.anything());
  });

  it('shows a form error instead of crashing when the database fails', async () => {
    signedIn({ complete_onboarding: { error: { code: '57014', message: 'timeout' } } });

    expect(await submitOnboarding('ar', { status: 'idle' }, gateForm('JO'))).toEqual({
      status: 'error',
      error: 'failed',
    });
    expect(log.error).toHaveBeenCalledWith('auth.onboarding_failed', {
      code: '57014',
      stage: 'gate',
    });
  });

  it('deletes the account for a closed country and explains why', async () => {
    vi.stubEnv('MARKET_DZ_ENABLED', 'false');
    const { rpc } = signedIn();

    expect(await redirectTarget(submitOnboarding('en', { status: 'idle' }, gateForm('DZ')))).toBe(
      '/en/not-available',
    );
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    expect(rpc).not.toHaveBeenCalledWith('complete_onboarding', expect.anything());
  });

  it('keeps the form when the account for a closed country cannot be deleted', async () => {
    vi.stubEnv('MARKET_DZ_ENABLED', 'false');
    signedIn({ delete_my_account: { error: { code: '40001' } } });

    expect(await submitOnboarding('ar', { status: 'idle' }, gateForm('DZ'))).toEqual({
      status: 'error',
      error: 'failed',
    });
  });
});

describe('updatePreferences', () => {
  it('saves the country and the language of the sign-in emails', async () => {
    const { update, updateUser } = signedIn();

    expect(await updatePreferences('ar', { status: 'idle' }, preferencesForm('DZ', 'ar'))).toEqual({
      status: 'saved',
    });
    expect(update).toHaveBeenCalledWith({ country_code: 'DZ', locale: 'ar' });
    expect(updateUser).toHaveBeenCalledWith({ data: { locale: 'ar' } });
    expect(revalidatePath).toHaveBeenCalledWith('/ar/account');
  });

  it('opens the account page in the new language', async () => {
    signedIn();

    expect(
      await redirectTarget(
        updatePreferences('ar', { status: 'idle' }, preferencesForm('JO', 'en')),
      ),
    ).toBe('/en/account');
  });

  it('reports a profile that could not be saved, and leaves the emails alone', async () => {
    const { updateUser } = signedIn({}, { profile: { code: '42501' } });

    expect(await updatePreferences('en', { status: 'idle' }, preferencesForm('JO', 'en'))).toEqual({
      status: 'error',
    });
    expect(log.error).toHaveBeenCalledWith('account.preferences_failed', {
      code: '42501',
      stage: 'profile',
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('reports an email language that could not be saved instead of "saved"', async () => {
    signedIn({}, { metadata: { code: 'unexpected_failure', status: 500 } });

    expect(await updatePreferences('ar', { status: 'idle' }, preferencesForm('JO', 'ar'))).toEqual({
      status: 'error',
    });
    expect(log.error).toHaveBeenCalledWith('account.preferences_failed', {
      code: 'unexpected_failure',
      status: 500,
      stage: 'auth_metadata',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses a country or language that does not exist without writing', async () => {
    const { update } = signedIn();

    expect(await updatePreferences('ar', { status: 'idle' }, preferencesForm('XX', 'ar'))).toEqual({
      status: 'error',
    });
    expect(await updatePreferences('ar', { status: 'idle' }, preferencesForm('JO', 'fr'))).toEqual({
      status: 'error',
    });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('setCrossborderConsent', () => {
  it('records the new choice', async () => {
    const { rpc } = signedIn();

    expect(await setCrossborderConsent('ar', false)).toEqual({ status: 'saved' });
    expect(rpc).toHaveBeenCalledWith(
      'set_crossborder_consent',
      expect.objectContaining({ p_given: false }),
    );
  });

  it('reports a failure to the form instead of throwing', async () => {
    signedIn({ set_crossborder_consent: { error: { code: '42501' } } });

    expect(await setCrossborderConsent('en', true)).toEqual({ status: 'error' });
    expect(log.error).toHaveBeenCalledWith('account.consent_failed', { code: '42501' });
  });
});

describe('deleteAccount', () => {
  it('deletes the account and says goodbye', async () => {
    const { rpc } = signedIn();

    expect(await redirectTarget(deleteAccount('en'))).toBe('/en/goodbye');
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
  });

  it('keeps the dialog when nothing could be deleted', async () => {
    signedIn({ delete_my_account: { error: { code: '57014' } } });

    expect(await deleteAccount('ar')).toEqual({ status: 'error' });
    expect(log.error).toHaveBeenCalledWith('account.delete_failed', {
      code: '57014',
      reason: 'requested',
    });
  });
});
