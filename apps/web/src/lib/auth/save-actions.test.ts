import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requestSaveCode, startGoogleSave, verifySaveCode } from './actions';
import { allowAuthAttempt } from './rate-limit';

// Saving a visit begun without an account (D-354).

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: () => undefined,
      getAll: () => [],
      set: () => undefined,
      delete: () => undefined,
    }),
  headers: () => Promise.resolve(new Headers({ host: 'localhost:3000' })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock('./google', () => ({ googleSignInAvailable: () => Promise.resolve(true) }));
vi.mock('./rate-limit', () => ({ allowAuthAttempt: vi.fn(() => Promise.resolve(true)) }));
vi.mock('@/lib/report/delete-files', () => ({
  removeReportFiles: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const EMAIL = 'founder@example.test';

function client(
  claims: Record<string, unknown> | null,
  overrides: Partial<
    Record<'updateUser' | 'verifyOtp' | 'signInWithOtp' | 'linkIdentity', unknown>
  > = {},
) {
  const auth = {
    getClaims: () => Promise.resolve({ data: claims ? { claims } : null, error: null }),
    updateUser: vi.fn(() => Promise.resolve({ data: { user: { new_email: EMAIL } }, error: null })),
    verifyOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    linkIdentity: vi.fn(() =>
      Promise.resolve({ data: { url: 'http://127.0.0.1:54321/auth/v1/authorize' }, error: null }),
    ),
    ...overrides,
  };
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth,
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  return auth;
}

const visitor = { sub: 'visitor-1', is_anonymous: true };
const account = { sub: 'account-1', email: EMAIL };

function form(fields: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set('email', EMAIL);
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** The target of a redirect() thrown by an action, read from its digest. */
async function redirectTarget(action: Promise<unknown>): Promise<string> {
  const error: unknown = await action.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  return ((error as { digest?: string } | null)?.digest ?? '').split(';')[2] ?? '';
}

beforeEach(() => {
  vi.mocked(allowAuthAttempt).mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('requestSaveCode', () => {
  it('adds the email to the visitor’s own identity and says a code was sent', async () => {
    const auth = client(visitor);
    expect(await requestSaveCode('ar', { status: 'idle' }, form())).toEqual({
      status: 'sent',
      email: EMAIL,
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ email: EMAIL });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('refuses an address that is not one, and stops at the app limit before Supabase', async () => {
    const auth = client(visitor);
    expect(await requestSaveCode('ar', { status: 'idle' }, form({ email: 'nonsense' }))).toEqual({
      status: 'error',
      error: 'invalidEmail',
    });
    vi.mocked(allowAuthAttempt).mockResolvedValue(false);
    expect(await requestSaveCode('ar', { status: 'idle' }, form())).toEqual({
      status: 'error',
      error: 'rateLimited',
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('sends nobody who is not a visitor to the form: start for no session, projects for an account', async () => {
    client(null);
    expect(await redirectTarget(requestSaveCode('ar', { status: 'idle' }, form()))).toBe(
      '/ar/start',
    );
    const auth = client(account);
    expect(await redirectTarget(requestSaveCode('ar', { status: 'idle' }, form()))).toBe(
      '/ar/projects',
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('answers the same for an address that already has an account, and sends it a sign-in code', async () => {
    const auth = client(visitor, {
      updateUser: vi.fn(() =>
        Promise.resolve({ data: { user: null }, error: { code: 'email_exists', status: 422 } }),
      ),
    });
    expect(await requestSaveCode('ar', { status: 'idle' }, form())).toEqual({
      status: 'sent',
      email: EMAIL,
    });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: EMAIL,
      options: { shouldCreateUser: false },
    });
  });

  it('is loud when Supabase took the address without a confirmation, and still goes on', async () => {
    client(visitor, {
      updateUser: vi.fn(() => Promise.resolve({ data: { user: { email: EMAIL } }, error: null })),
    });
    expect(await requestSaveCode('ar', { status: 'idle' }, form())).toEqual({
      status: 'sent',
      email: EMAIL,
    });
    expect(log.error).toHaveBeenCalledWith('auth.save_without_confirmation', expect.anything());
  });

  it('reports a failure of Supabase as a code', async () => {
    client(visitor, {
      updateUser: vi.fn(() =>
        Promise.resolve({
          data: { user: null },
          error: { code: 'unexpected_failure', status: 500 },
        }),
      ),
    });
    expect(await requestSaveCode('ar', { status: 'idle' }, form())).toEqual({
      status: 'error',
      error: 'failed',
    });
  });
});

describe('verifySaveCode', () => {
  it('confirms the added email with the email_change code and goes to the projects', async () => {
    const auth = client(visitor);
    expect(
      await redirectTarget(verifySaveCode('ar', { status: 'idle' }, form({ code: '12345678' }))),
    ).toBe('/ar/projects');
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: EMAIL,
      token: '12345678',
      type: 'email_change',
    });
  });

  it('falls back to the sign-in code of an address that already had an account', async () => {
    const verifyOtp = vi
      .fn()
      .mockResolvedValueOnce({ data: {}, error: { code: 'otp_expired', status: 403 } })
      .mockResolvedValueOnce({ data: {}, error: null });
    client(visitor, { verifyOtp });
    expect(
      await redirectTarget(verifySaveCode('ar', { status: 'idle' }, form({ code: '12345678' }))),
    ).toBe('/ar/projects');
    expect(verifyOtp).toHaveBeenLastCalledWith({ email: EMAIL, token: '12345678', type: 'email' });
  });

  it('refuses a wrong code and a malformed one', async () => {
    client(visitor, {
      verifyOtp: vi.fn(() =>
        Promise.resolve({ data: {}, error: { code: 'otp_expired', status: 403 } }),
      ),
    });
    expect(await verifySaveCode('ar', { status: 'idle' }, form({ code: '00000000' }))).toEqual({
      status: 'error',
      error: 'invalidCode',
    });
    expect(await verifySaveCode('ar', { status: 'idle' }, form({ code: 'abc' }))).toEqual({
      status: 'error',
      error: 'invalidCode',
    });
  });

  it('stops at the app limit before Supabase is called', async () => {
    const auth = client(visitor);
    vi.mocked(allowAuthAttempt).mockResolvedValue(false);
    expect(await verifySaveCode('ar', { status: 'idle' }, form({ code: '12345678' }))).toEqual({
      status: 'error',
      error: 'rateLimited',
    });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});

describe('startGoogleSave', () => {
  it('links Google to the visitor’s own identity and goes to Google', async () => {
    const auth = client(visitor);
    expect(await redirectTarget(startGoogleSave('ar'))).toBe(
      'http://127.0.0.1:54321/auth/v1/authorize',
    );
    expect(auth.linkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback?next=%2Far%2Fprojects') as string,
        }) as unknown,
      }),
    );
  });

  it('sends nobody who is not a visitor to Google', async () => {
    client(null);
    expect(await redirectTarget(startGoogleSave('ar'))).toBe('/ar/start');
    const auth = client(account);
    expect(await redirectTarget(startGoogleSave('ar'))).toBe('/ar/projects');
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it('reports a refusal of Supabase', async () => {
    client(visitor, {
      linkIdentity: vi.fn(() =>
        Promise.resolve({ data: null, error: { code: 'identity_already_exists', status: 422 } }),
      ),
    });
    expect(await startGoogleSave('ar')).toEqual({ status: 'error', error: 'failed' });
  });
});
