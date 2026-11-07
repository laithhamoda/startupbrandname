import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allowAuthAttempt } from '@/lib/auth/rate-limit';
import { completeOnboarding, getSessionUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { startVisit } from './actions';

vi.mock('@/lib/auth/session', () => ({ completeOnboarding: vi.fn(), getSessionUser: vi.fn() }));
vi.mock('@/lib/auth/rate-limit', () => ({ allowAuthAttempt: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock('@/env/server', () => ({ getServerEnv: () => ({ MARKET_DZ_ENABLED: true }) }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const PROJECT = '6f1c1f1e-7d4b-4c55-9a51-0f6f5d2b9e10';

function form(extra: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values = {
    title: 'صيانة مكيّفات المطاعم',
    country: 'JO',
    currency: 'JOD',
    terms: 'on',
    ...extra,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

/** The target of a redirect() thrown by `action`, read from its digest; '' when none. */
async function redirectTarget(action: Promise<unknown>): Promise<string> {
  const error: unknown = await action.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  return ((error as { digest?: string } | null)?.digest ?? '').split(';')[2] ?? '';
}

const signInAnonymously = vi.fn();
const rpc = vi.fn();
const limit = vi.fn();
const client = {
  auth: { signInAnonymously },
  rpc,
  from: () => ({ select: () => ({ order: () => ({ limit }) }) }),
};

beforeEach(() => {
  vi.mocked(createSupabaseServerClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
  );
  vi.mocked(getSessionUser).mockResolvedValue(null);
  vi.mocked(allowAuthAttempt).mockResolvedValue(true);
  vi.mocked(completeOnboarding).mockResolvedValue('completed');
  signInAnonymously.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: PROJECT, error: null });
  limit.mockResolvedValue({ data: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('startVisit (D-350)', () => {
  it('names the fields that are missing and signs nobody in', async () => {
    const result = await startVisit('ar', { status: 'idle' }, form({ title: '', terms: '' }));
    expect(result).toEqual({ status: 'error', error: 'invalid', invalid: ['title', 'terms'] });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs the visitor in anonymously, records the answers and opens the first of the 64 questions', async () => {
    const target = await redirectTarget(
      startVisit('ar', { status: 'idle' }, form({ crossborder: 'on' })),
    );
    expect(target).toMatch(new RegExp(`^/ar/projects/${PROJECT}/q/`));
    expect(allowAuthAttempt).toHaveBeenCalledWith('start', expect.any(String));
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(completeOnboarding).toHaveBeenCalledWith(client, {
      country: 'JO',
      locale: 'ar',
      hasProject: true,
      crossborder: true,
    });
    expect(rpc).toHaveBeenCalledWith('create_project', {
      p_title: 'صيانة مكيّفات المطاعم',
      p_country_code: 'JO',
      p_currency: 'JOD',
      p_mode: 'full',
    });
  });

  it('records no cross-border consent when it is not ticked', async () => {
    await redirectTarget(startVisit('ar', { status: 'idle' }, form()));
    expect(vi.mocked(completeOnboarding).mock.calls[0]?.[1].crossborder).toBe(false);
  });

  it('stops before Supabase when the network is over its limit', async () => {
    vi.mocked(allowAuthAttempt).mockResolvedValue(false);
    expect(await startVisit('ar', { status: 'idle' }, form())).toEqual({
      status: 'error',
      error: 'limited',
    });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('says so when Supabase refuses an anonymous sign-in', async () => {
    signInAnonymously.mockResolvedValue({ error: { code: 'anonymous_provider_disabled' } });
    expect(await startVisit('ar', { status: 'idle' }, form())).toEqual({
      status: 'error',
      error: 'unavailable',
    });
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it('sends an account to its own new-project page', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: 'u',
      email: 'a@b.test',
      isAnonymous: false,
      names: [],
    });
    expect(await redirectTarget(startVisit('ar', { status: 'idle' }, form()))).toBe(
      '/ar/projects/new',
    );
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('does not sign in again a visitor who already began, and takes them back to their project', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: 'v',
      email: null,
      isAnonymous: true,
      names: [],
    });
    rpc.mockResolvedValue({ data: null, error: { code: 'SB001' } });
    limit.mockResolvedValue({ data: [{ id: PROJECT }] });
    expect(await redirectTarget(startVisit('ar', { status: 'idle' }, form()))).toBe(
      `/ar/projects/${PROJECT}`,
    );
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(allowAuthAttempt).not.toHaveBeenCalled();
  });

  it('reports a failed creation', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } });
    expect(await startVisit('ar', { status: 'idle' }, form())).toEqual({
      status: 'error',
      error: 'failed',
    });
  });
});
