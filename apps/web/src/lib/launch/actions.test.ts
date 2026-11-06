import { revalidatePath } from 'next/cache';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowAuthAttempt } from '@/lib/auth/rate-limit';
import { requireAccount } from '@/lib/auth/session';
import { log } from '@/lib/log';
import { claimLaunchSpot } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${path}` });
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
  },
}));
vi.mock('@/lib/auth/session', () => ({ requireAccount: vi.fn() }));
vi.mock('@/lib/auth/rate-limit', () => ({ allowAuthAttempt: vi.fn(() => Promise.resolve(true)) }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** An account whose `claim_launch_spot()` answers `data`, or fails with `error`. */
function account(data: unknown, error: { code: string } | null = null) {
  const rpc = vi.fn(() => Promise.resolve({ data, error }));
  vi.mocked(requireAccount).mockResolvedValue({
    supabase: { rpc },
    user: { id: 'user-1' },
  } as unknown as Awaited<ReturnType<typeof requireAccount>>);
  return rpc;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('claimLaunchSpot (D-332, D-334)', () => {
  it.each([
    ['granted', 'granted'],
    ['already', 'granted'],
    ['admin', 'granted'],
    ['closed', 'closed'],
    ['phone_used', 'used'],
    ['email_used', 'email_used'],
    ['email_blocked', 'email_blocked'],
    ['email_unverified', 'unverified'],
    ['phone_unverified', 'unverified'],
  ] as const)('shows the database answer %s as %s', async (answer, status) => {
    const rpc = account(answer);
    expect(await claimLaunchSpot('en')).toEqual({ status });
    expect(rpc).toHaveBeenCalledWith('claim_launch_spot');
  });

  it('refreshes the pages of the language, so the report opens at once', async () => {
    account('granted');
    await claimLaunchSpot('ar');
    expect(revalidatePath).toHaveBeenCalledWith('/ar', 'layout');
  });

  it('reports a failed call, logged', async () => {
    account(null, { code: 'XX000' });
    expect(await claimLaunchSpot('en')).toEqual({ status: 'error' });
    expect(log.error).toHaveBeenCalledWith('launch.claim_failed', { code: 'XX000' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reports an answer it does not know as a failure', async () => {
    account('something_new');
    expect(await claimLaunchSpot('en')).toEqual({ status: 'error' });
    expect(log.error).toHaveBeenCalledWith('launch.claim_failed', { code: 'answer' });
  });

  it('reports a thrown failure, and lets a redirect through', async () => {
    vi.mocked(requireAccount).mockRejectedValueOnce(new Error('boom'));
    expect(await claimLaunchSpot('en')).toEqual({ status: 'error' });
    vi.mocked(requireAccount).mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    await expect(claimLaunchSpot('en')).rejects.toThrow('NEXT_REDIRECT');
  });

  it('refuses a language the site does not have', async () => {
    await expect(claimLaunchSpot('xx')).rejects.toThrow();
    expect(requireAccount).not.toHaveBeenCalled();
  });
});

describe('claimLaunchSpot limit (D-340)', () => {
  it('answers with the ordinary error, and asks the database nothing, when the account claims too fast', async () => {
    const rpc = account('granted');
    vi.mocked(allowAuthAttempt).mockResolvedValueOnce(false);

    expect(await claimLaunchSpot('ar')).toEqual({ status: 'error' });
    expect(allowAuthAttempt).toHaveBeenCalledWith('claim', 'user-1');
    expect(rpc).not.toHaveBeenCalled();
  });
});
