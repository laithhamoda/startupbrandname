import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { finishSignIn } from '@/lib/auth/session';
import { log } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { GET } from './route';

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ finishSignIn: vi.fn() }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** A client whose code exchange answers `exchange`. */
function client(exchange: () => Promise<{ error: unknown }>) {
  const fake = { auth: { exchangeCodeForSession: vi.fn(exchange) } };
  vi.mocked(createSupabaseServerClient).mockResolvedValue(
    fake as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
  );
  return fake;
}

/** Calls the callback with `query` and returns the target of the redirect it throws. */
async function callback(query: string): Promise<string> {
  const error: unknown = await GET(
    new NextRequest(`http://localhost:3000/auth/callback?${query}`),
  ).then(
    () => null,
    (thrown: unknown) => thrown,
  );
  const digest = (error as { digest?: string } | null)?.digest ?? '';
  return digest.split(';')[2] ?? '';
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /auth/callback', () => {
  it('finishes sign-in and goes on to the page that asked for it', async () => {
    const fake = client(() => Promise.resolve({ error: null }));
    vi.mocked(finishSignIn).mockResolvedValue('/en/account');

    expect(await callback('code=abc&next=/en/account')).toBe('/en/account');
    expect(fake.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(finishSignIn).toHaveBeenCalledWith(fake, 'en', '/en/account');
  });

  it('goes back to sign-in when Google sent no code', async () => {
    expect(await callback('next=/en/projects')).toBe('/en/login?error=google');
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('goes back to sign-in when Supabase refuses the code', async () => {
    client(() => Promise.resolve({ error: { code: 'bad_code_verifier', status: 400 } }));

    expect(await callback('code=abc&next=/en/projects')).toBe('/en/login?error=google');
    expect(log.warn).toHaveBeenCalledWith('auth.google_exchange_failed', {
      code: 'bad_code_verifier',
      status: 400,
    });
    expect(finishSignIn).not.toHaveBeenCalled();
  });

  it('goes back to sign-in instead of a bare 500 when the exchange throws', async () => {
    client(() => Promise.reject(new TypeError('fetch failed')));

    expect(await callback('code=abc&next=/en/projects')).toBe('/en/login?error=google');
    expect(log.error).toHaveBeenCalledWith('auth.google_callback_failed', {
      errorName: 'TypeError',
    });
  });

  it('keeps the page to come back to when Google sign-in fails', async () => {
    client(() => Promise.reject(new TypeError('fetch failed')));

    expect(await callback('code=abc&next=/en/account')).toBe(
      '/en/login?error=google&next=%2Fen%2Faccount',
    );
    expect(await callback('next=/ar/projects/abc-123')).toBe(
      '/ar/login?error=google&next=%2Far%2Fprojects%2Fabc-123',
    );
  });

  it('goes back to sign-in when the Supabase client cannot be created', async () => {
    vi.mocked(createSupabaseServerClient).mockRejectedValue(new Error('cookies unavailable'));

    expect(await callback('code=abc')).toBe('/ar/login?error=google');
    expect(log.error).toHaveBeenCalledWith('auth.google_callback_failed', expect.anything());
  });

  it('lets a redirect from inside the sign-in through', async () => {
    client(() => Promise.resolve({ error: null }));
    vi.mocked(finishSignIn).mockImplementation(() => redirect('/ar/onboarding'));

    expect(await callback('code=abc')).toBe('/ar/onboarding');
    expect(log.error).not.toHaveBeenCalled();
  });

  it('never sends the user to another site', async () => {
    const fake = client(() => Promise.resolve({ error: null }));
    vi.mocked(finishSignIn).mockImplementation((_client, locale, next) =>
      Promise.resolve(next ?? `/${locale}/projects`),
    );

    expect(await callback('code=abc&next=https://evil.example/en')).toBe('/ar/projects');
    expect(finishSignIn).toHaveBeenCalledWith(fake, 'ar', '/ar/projects');
  });
});
