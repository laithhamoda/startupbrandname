import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRateLimitEnv } from '@/env/server';
import { log } from '@/lib/log';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { addressHash, allowAuthAttempt, subjectHash } from './rate-limit';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers({ 'x-real-ip': '203.0.113.9' })),
}));
vi.mock('next/navigation', () => ({
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
  },
}));
vi.mock('@/env/server', () => ({ getRateLimitEnv: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** A database whose `check_auth_attempt` answers `result`. */
function database(result: { data: unknown; error: { code: string } | null }) {
  const rpc = vi.fn(() => Promise.resolve(result));
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<
    typeof createSupabaseAdminClient
  >);
  vi.mocked(getRateLimitEnv).mockReturnValue({ supabaseSecretKey: 'secret-for-tests' });
  return rpc;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('hashes', () => {
  it('are keyed, stable and never the plain value', () => {
    const hash = subjectHash('Founder@Example.test ', 'key-1');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(subjectHash('founder@example.test', 'key-1'));
    expect(hash).not.toBe(subjectHash('founder@example.test', 'key-2'));
    expect(hash).not.toContain('founder');
  });

  it('keep a mailbox and a network apart even for the same text', () => {
    expect(subjectHash('203.0.113.9', 'key')).not.toBe(addressHash('203.0.113.9', 'key'));
  });
});

describe('allowAuthAttempt (D-340)', () => {
  it('lets the attempt go on when the database allows it, sending only hashes', async () => {
    const rpc = database({ data: true, error: null });

    expect(await allowAuthAttempt('code', 'founder@example.test')).toBe(true);
    const args = (rpc.mock.calls[0] as unknown as [string, Record<string, string>])[1];
    expect(args.p_kind).toBe('code');
    expect(JSON.stringify(args)).not.toContain('founder');
    expect(JSON.stringify(args)).not.toContain('203.0.113.9');
  });

  it('stops the attempt and logs one security event when the database refuses', async () => {
    database({ data: false, error: null });

    expect(await allowAuthAttempt('verify', 'founder@example.test')).toBe(false);
    expect(log.warn).toHaveBeenCalledWith('auth.rate_limited', {
      stage: 'verify',
      reason: 'app_limit',
    });
  });

  it('fails open without the secret key, so sign-in works where it is not set', async () => {
    vi.mocked(getRateLimitEnv).mockReturnValue(null);

    expect(await allowAuthAttempt('code', 'founder@example.test')).toBe(true);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('fails open, and logs, when the database cannot answer', async () => {
    database({ data: null, error: { code: 'PGRST301' } });

    expect(await allowAuthAttempt('code', 'founder@example.test')).toBe(true);
    expect(log.error).toHaveBeenCalledWith('auth.limit_check_failed', { code: 'PGRST301' });
  });

  it('fails open when the call throws', async () => {
    vi.mocked(getRateLimitEnv).mockReturnValue({ supabaseSecretKey: 'secret-for-tests' });
    vi.mocked(createSupabaseAdminClient).mockImplementation(() => {
      throw new Error('network down');
    });

    expect(await allowAuthAttempt('claim', 'user-1')).toBe(true);
    expect(log.error).toHaveBeenCalled();
  });
});
