import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { submitOnboarding } from './actions';

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => jar.set(name, value),
      delete: (name: string) => jar.delete(name),
    }),
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** A signed-in client without a profile; its RPCs answer from `results`. */
function signedIn(results: Record<string, { data?: unknown; error?: unknown }> = {}) {
  const rpc = vi.fn((name: string) =>
    Promise.resolve({ data: null, error: null, ...results[name] }),
  );
  const client = {
    rpc,
    auth: {
      getClaims: () => Promise.resolve({ data: { claims: { sub: 'user-1' } } }),
      signOut: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
    }),
  };
  vi.mocked(createSupabaseServerClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
  );
  return { rpc };
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
