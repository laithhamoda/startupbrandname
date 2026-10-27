import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireAccount } from '@/lib/auth/session';
import { log } from '@/lib/log';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { activateVoucher } from './voucher-actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers({ 'x-real-ip': '203.0.113.7' })),
}));
vi.mock('@/lib/auth/session', () => ({ requireAccount: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const IDLE = { status: 'idle' } as const;
const ENV = { PADDLE_WEBHOOK_SECRET: 'whsec_x', SUPABASE_SECRET_KEY: 'secret-key' };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** A signed-in account whose activate_voucher answers `result`. */
function database(result: { data?: unknown; error?: { code: string } | null }) {
  const rpc = vi.fn(() =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }),
  );
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<
    typeof createSupabaseAdminClient
  >);
  vi.mocked(requireAccount).mockResolvedValue({
    user: { id: 'user-1' },
  } as unknown as Awaited<ReturnType<typeof requireAccount>>);
  return rpc;
}

function env() {
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('activateVoucher (D-325)', () => {
  it('asks for the 18+ box before anything else', async () => {
    env();
    const rpc = database({ data: 'activated' });
    expect(await activateVoucher('en', IDLE, form({ code: 'VIVAD908AEEB' }))).toEqual({
      status: 'adult_required',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('names the account and a hash of the network, never the address', async () => {
    env();
    const rpc = database({ data: 'activated' });
    const result = await activateVoucher(
      'ar',
      IDLE,
      form({ code: ' viva-d908 aeeb', adult: 'on' }),
    );
    expect(result).toEqual({ status: 'activated' });
    expect(rpc).toHaveBeenCalledWith('activate_voucher', {
      p_user: 'user-1',
      p_ip_hash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
      p_code: ' viva-d908 aeeb',
      p_adult_confirmed: true,
    });
    expect(JSON.stringify(vi.mocked(log.info).mock.calls)).not.toContain('D908');
  });

  it.each(['invalid', 'locked', 'in_use'])('passes %s on', async (answer) => {
    env();
    database({ data: answer });
    expect(await activateVoucher('en', IDLE, form({ code: 'x', adult: 'on' }))).toEqual({
      status: answer,
    });
  });

  it('counts a missing code field as a wrong code', async () => {
    env();
    const rpc = database({ data: 'invalid' });
    await activateVoucher('en', IDLE, form({ adult: 'on' }));
    expect(rpc).toHaveBeenCalledWith(
      'activate_voucher',
      expect.objectContaining({ p_code: '' }) as object,
    );
  });

  it('reports a database error and an unknown answer as an error, never a success', async () => {
    env();
    database({ error: { code: 'XX000' } });
    expect(await activateVoucher('en', IDLE, form({ code: 'x', adult: 'on' }))).toEqual({
      status: 'error',
    });
    expect(log.error).toHaveBeenCalledWith('vouchers.activate_failed', { code: 'XX000' });

    database({ data: 'maybe' });
    expect(await activateVoucher('en', IDLE, form({ code: 'x', adult: 'on' }))).toEqual({
      status: 'error',
    });
  });

  it('is closed while the server secrets are missing', async () => {
    expect(await activateVoucher('en', IDLE, form({ code: 'x', adult: 'on' }))).toEqual({
      status: 'error',
    });
  });

  it('answers an error when the call throws', async () => {
    env();
    vi.mocked(requireAccount).mockRejectedValue(new Error('boom'));
    expect(await activateVoucher('en', IDLE, form({ code: 'x', adult: 'on' }))).toEqual({
      status: 'error',
    });
  });
});
