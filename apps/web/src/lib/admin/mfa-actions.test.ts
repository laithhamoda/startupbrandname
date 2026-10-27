import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireAccount } from '@/lib/auth/session';
import { log } from '@/lib/log';
import { adminStatusOf } from './guard';
import { startEnrollment, verifyAdminCode } from './mfa-actions';

const FACTOR = '0f8e3a52-6c1d-4b8a-9e2f-3d4c5b6a7980';
const IDLE = { status: 'idle' } as const;

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${path}` });
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
  },
}));
vi.mock('@/lib/auth/session', () => ({ requireAccount: vi.fn() }));
vi.mock('./guard', () => ({ adminStatusOf: vi.fn() }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

interface Factors {
  totp: { id: string }[];
  all: { id: string; factor_type: string }[];
}

function account(
  options: {
    status?: 'none' | 'needs_mfa' | 'admin';
    factors?: Factors;
    listError?: { code: string };
    enrollError?: { code: string };
    verifyError?: { code: string };
    auditError?: { code: string };
  } = {},
) {
  const mfa = {
    listFactors: vi.fn(() =>
      Promise.resolve({
        data: options.factors ?? { totp: [], all: [] },
        error: options.listError ?? null,
      }),
    ),
    unenroll: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    enroll: vi.fn(() =>
      Promise.resolve({
        data: options.enrollError
          ? null
          : { id: FACTOR, totp: { qr_code: '<svg a="b"/>', secret: 'SECRET' } },
        error: options.enrollError ?? null,
      }),
    ),
    challengeAndVerify: vi.fn(() =>
      Promise.resolve({ data: {}, error: options.verifyError ?? null }),
    ),
  };
  const rpc = vi.fn(() => Promise.resolve({ data: null, error: options.auditError ?? null }));
  vi.mocked(requireAccount).mockResolvedValue({
    supabase: { auth: { mfa }, rpc },
  } as unknown as Awaited<ReturnType<typeof requireAccount>>);
  vi.mocked(adminStatusOf).mockResolvedValue(options.status ?? 'needs_mfa');
  return { mfa, rpc };
}

function form(code: string): FormData {
  const data = new FormData();
  data.set('code', code);
  return data;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('startEnrollment (D-327)', () => {
  it('creates the factor and returns the QR code as a data URL', async () => {
    const { mfa } = account();
    const result = await startEnrollment('en');
    expect(result).toEqual({
      status: 'ready',
      factorId: FACTOR,
      qr: `data:image/svg+xml;utf-8,${encodeURIComponent('<svg a="b"/>')}`,
      secret: 'SECRET',
    });
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'authenticator' });
  });

  it('removes the unverified leftovers of an abandoned setup first', async () => {
    const { mfa } = account({
      factors: { totp: [], all: [{ id: 'old', factor_type: 'totp' }] },
    });
    await startEnrollment('en');
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'old' });
  });

  it('never adds a second factor next to a verified one', async () => {
    const { mfa } = account({ factors: { totp: [{ id: 'f' }], all: [] } });
    expect(await startEnrollment('en')).toEqual({ status: 'enrolled' });
    expect(mfa.enroll).not.toHaveBeenCalled();
  });

  it.each(['none', 'admin'] as const)('refuses an account whose status is %s', async (status) => {
    const { mfa } = account({ status });
    expect(await startEnrollment('en')).toEqual({ status: 'error' });
    expect(mfa.enroll).not.toHaveBeenCalled();
  });

  it('reports the failure of the list or of the enrollment', async () => {
    account({ listError: { code: 'x' } });
    expect(await startEnrollment('en')).toEqual({ status: 'error' });
    account({ enrollError: { code: 'y' } });
    expect(await startEnrollment('en')).toEqual({ status: 'error' });
    expect(log.error).toHaveBeenCalledTimes(2);
  });
});

describe('verifyAdminCode (D-327)', () => {
  it('verifies, records the entry and lands on the admin area', async () => {
    const { mfa, rpc } = account();
    await expect(verifyAdminCode('ar', FACTOR, IDLE, form('123 456'))).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;/ar/admin',
    });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: FACTOR, code: '123456' });
    expect(rpc).toHaveBeenCalledWith('admin_enter');
  });

  it.each(['12345', 'abcdef', '1234567', ''])(
    'rejects the code "%s" without asking',
    async (code) => {
      const { mfa } = account();
      expect(await verifyAdminCode('en', FACTOR, IDLE, form(code))).toEqual({ status: 'invalid' });
      expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
    },
  );

  it('rejects a factor that is not an id', async () => {
    account();
    expect(await verifyAdminCode('en', 'nope', IDLE, form('123456'))).toEqual({
      status: 'invalid',
    });
  });

  it('tells a wrong code from an outage', async () => {
    account({ verifyError: { code: 'mfa_verification_failed' } });
    expect(await verifyAdminCode('en', FACTOR, IDLE, form('123456'))).toEqual({
      status: 'invalid',
    });
    account({ verifyError: { code: 'unexpected_failure' } });
    expect(await verifyAdminCode('en', FACTOR, IDLE, form('123456'))).toEqual({ status: 'error' });
  });

  it('does not let the admin in when the audit entry fails', async () => {
    account({ auditError: { code: '42501' } });
    expect(await verifyAdminCode('en', FACTOR, IDLE, form('123456'))).toEqual({ status: 'error' });
  });

  it('answers an error for an account that is not waiting for the second step', async () => {
    const { mfa } = account({ status: 'none' });
    expect(await verifyAdminCode('en', FACTOR, IDLE, form('123456'))).toEqual({ status: 'error' });
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });
});
