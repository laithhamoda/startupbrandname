import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireAccount } from '@/lib/auth/session';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { adminMfaPath, adminStatusOf, requireAdmin } from './guard';

const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

vi.mock('next/navigation', () => navigation);
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock('@/lib/auth/session', () => ({ requireAccount: vi.fn() }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function client(result: { data?: unknown; error?: { code: string } | null }) {
  return {
    rpc: vi.fn(() => Promise.resolve({ data: result.data ?? null, error: result.error ?? null })),
  } as unknown as SupabaseServerClient;
}

function account(result: Parameters<typeof client>[0]) {
  const supabase = client(result);
  vi.mocked(requireAccount).mockResolvedValue({
    supabase,
    user: { id: 'u' },
    profile: {},
  } as unknown as Awaited<ReturnType<typeof requireAccount>>);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('adminStatusOf (D-327)', () => {
  it.each(['none', 'needs_mfa', 'admin'] as const)('passes %s through', async (status) => {
    expect(await adminStatusOf(client({ data: status }))).toBe(status);
  });

  it.each([null, 'ADMIN', 'yes', true, 1])('reads %s as none', async (answer) => {
    expect(await adminStatusOf(client({ data: answer }))).toBe('none');
  });

  it('keeps the area closed when the database fails, and logs why', async () => {
    expect(await adminStatusOf(client({ error: { code: 'XX000' } }))).toBe('none');
    expect(log.error).toHaveBeenCalledWith('admin.status_failed', { code: 'XX000' });
  });
});

describe('requireAdmin', () => {
  it('lets an admin at aal2 in', async () => {
    account({ data: 'admin' });
    await expect(requireAdmin('en')).resolves.toMatchObject({ user: { id: 'u' } });
  });

  it('answers 404 to someone who is not an admin', async () => {
    account({ data: 'none' });
    await expect(requireAdmin('en')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it('sends an admin without the second step to the code page', async () => {
    account({ data: 'needs_mfa' });
    await expect(requireAdmin('ar')).rejects.toThrow('NEXT_REDIRECT /ar/admin/mfa');
  });

  it('closes the area on a database failure', async () => {
    account({ error: { code: 'XX000' } });
    await expect(requireAdmin('en')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('adminMfaPath', () => {
  it('keeps the language', () => {
    expect(adminMfaPath('en')).toBe('/en/admin/mfa');
  });
});
