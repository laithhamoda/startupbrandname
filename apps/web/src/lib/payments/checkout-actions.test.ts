import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireAccount } from '@/lib/auth/session';
import { log } from '@/lib/log';
import { projectPlanOf } from './account-plan';
import { beginCheckout, beginMentorPackCheckout } from './checkout-actions';

vi.mock('@/lib/auth/session', () => ({ requireAccount: vi.fn() }));
vi.mock('./account-plan', () => ({ projectPlanOf: vi.fn() }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const PROJECT = 'ab100000-0000-4000-8000-000000000001';
const REF = '0f8e3a52-6c1d-4b8a-9e2f-3d4c5b6a7980';
const ENV = {
  PADDLE_CLIENT_TOKEN: 'test_abc',
  PADDLE_PRICE_STRATEGIST: 'pri_strategist',
  PADDLE_PRICE_COMMANDER: 'pri_commander',
  PADDLE_PRICE_UPGRADE: 'pri_upgrade',
  PADDLE_PRICE_MENTOR_PACK: 'pri_pack',
  MENTOR_PACK_ENABLED: 'true',
};

/** A signed-in account whose start_checkout answers `result`. */
function account(result: { data?: string; error?: { code: string } | null } = {}) {
  const rpc = vi.fn(() =>
    Promise.resolve({ data: result.data ?? REF, error: result.error ?? null }),
  );
  vi.mocked(requireAccount).mockResolvedValue({
    supabase: { rpc },
    user: { id: 'u', email: 'founder@example.test' },
  } as unknown as Awaited<ReturnType<typeof requireAccount>>);
  return rpc;
}

function adult(): FormData {
  const data = new FormData();
  data.set('adult', 'on');
  return data;
}

function env(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('beginCheckout (D-317, D-320)', () => {
  it('opens a package for the project at its price', async () => {
    env(ENV);
    const rpc = account();
    vi.mocked(projectPlanOf).mockResolvedValue('free');
    expect(await beginCheckout('en', 'strategist', PROJECT, adult())).toEqual({
      status: 'ready',
      priceId: 'pri_strategist',
      checkoutRef: REF,
      email: 'founder@example.test',
      clientToken: 'test_abc',
      environment: 'sandbox',
    });
    expect(rpc).toHaveBeenCalledWith('start_checkout', {
      p_plan_id: 'strategist',
      p_project_id: PROJECT,
      p_adult_confirmed: true,
    });
  });

  it('opens nothing for a project that already has the package', async () => {
    env(ENV);
    const rpc = account();
    vi.mocked(projectPlanOf).mockResolvedValue('commander');
    expect(await beginCheckout('en', 'commander', PROJECT, adult())).toEqual({ status: 'owned' });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('beginMentorPackCheckout (D-322)', () => {
  it('opens the pack for any project of the account', async () => {
    env(ENV);
    const rpc = account();
    expect(await beginMentorPackCheckout('en', PROJECT, adult())).toMatchObject({
      status: 'ready',
      priceId: 'pri_pack',
      checkoutRef: REF,
    });
    expect(rpc).toHaveBeenCalledWith('start_checkout', {
      p_plan_id: 'mentor_pack',
      p_project_id: PROJECT,
      p_adult_confirmed: true,
    });
  });

  it('needs the 18+ confirmation (D-086)', async () => {
    env(ENV);
    expect(await beginMentorPackCheckout('en', PROJECT, new FormData())).toEqual({
      status: 'adult_required',
    });
  });

  it('is closed until the pack is on sale, and for an address that is not a project', async () => {
    env({ ...ENV, MENTOR_PACK_ENABLED: 'false' });
    expect(await beginMentorPackCheckout('en', PROJECT, adult())).toEqual({ status: 'closed' });
    env(ENV);
    expect(await beginMentorPackCheckout('en', 'not-a-project', adult())).toEqual({
      status: 'closed',
    });
  });

  it('says when the daily limit is reached, and logs any other refusal', async () => {
    env(ENV);
    account({ error: { code: '54000' } });
    expect(await beginMentorPackCheckout('en', PROJECT, adult())).toEqual({ status: 'limit' });
    account({ error: { code: '42501' } });
    expect(await beginMentorPackCheckout('en', PROJECT, adult())).toEqual({ status: 'error' });
    expect(log.error).toHaveBeenCalledWith('payments.checkout_failed', {
      code: '42501',
      stage: 'start',
    });
  });

  it('logs a thrown error', async () => {
    env(ENV);
    vi.mocked(requireAccount).mockRejectedValue(new TypeError('down'));
    expect(await beginMentorPackCheckout('en', PROJECT, adult())).toEqual({ status: 'error' });
    expect(log.error).toHaveBeenCalled();
  });
});
