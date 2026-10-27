import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAffiliate,
  endSubscription,
  grantSubscription,
  issueBatch,
  payCommissions,
} from './actions';
import { requireAdmin } from './guard';

const ID = '0f8e3a52-6c1d-4b8a-9e2f-3d4c5b6a7980';
const IDLE = { status: 'idle' } as const;

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === 'NEXT_NOT_FOUND') throw error;
  },
}));
vi.mock('./guard', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function admin(result: { data?: unknown; error?: { code: string } | null } = {}) {
  const rpc = vi.fn(() =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }),
  );
  vi.mocked(requireAdmin).mockResolvedValue({
    supabase: { rpc },
  } as unknown as Awaited<ReturnType<typeof requireAdmin>>);
  return rpc;
}

function form(fields: Record<string, string | undefined>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('issueBatch (D-328)', () => {
  it('issues the batch and returns the codes once', async () => {
    const rpc = admin({ data: ['VIVA00000001', 'VIVA00000002'] });
    const result = await issueBatch(
      'en',
      IDLE,
      form({ type: 'course_12m', count: '2', affiliate: ID, note: ' Oct ' }),
    );
    expect(result).toEqual({ status: 'done', output: 'VIVA00000001\nVIVA00000002', count: 2 });
    expect(rpc).toHaveBeenCalledWith('admin_issue_batch', {
      p_type: 'course_12m',
      p_count: 2,
      p_affiliate: ID,
      p_note: 'Oct',
    });
  });

  it('sends neither an affiliate nor a note that were left empty', async () => {
    const rpc = admin({ data: ['VIVA00000001'] });
    await issueBatch('en', IDLE, form({ type: 'course_12m', count: '1', affiliate: '', note: '' }));
    expect(rpc).toHaveBeenCalledWith('admin_issue_batch', { p_type: 'course_12m', p_count: 1 });
  });

  it.each([
    { type: 'Bad Type', count: '1' },
    { type: 'course_12m', count: '0' },
    { type: 'course_12m', count: '1001' },
    { type: 'course_12m', count: 'x' },
    { type: 'course_12m', count: '1', affiliate: 'not-an-id' },
  ])('refuses %j without asking the database', async (fields) => {
    const rpc = admin();
    expect(await issueBatch('en', IDLE, form(fields))).toEqual({
      status: 'error',
      reason: 'invalid',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['42501', 'denied'],
    ['22023', 'invalid'],
    ['23514', 'invalid'],
    ['XX000', 'failed'],
  ])('explains the database code %s as %s', async (code, reason) => {
    admin({ error: { code } });
    expect(await issueBatch('en', IDLE, form({ type: 'course_12m', count: '1' }))).toEqual({
      status: 'error',
      reason,
    });
  });
});

describe('createAffiliate', () => {
  it('turns dollars into cents', async () => {
    const rpc = admin();
    expect(await createAffiliate('en', IDLE, form({ name: ' Viva Rise ', amount: '2.5' }))).toEqual(
      {
        status: 'done',
      },
    );
    expect(rpc).toHaveBeenCalledWith('admin_create_affiliate', {
      p_name: 'Viva Rise',
      p_amount_usd_cents: 250,
    });
  });

  it.each([
    { name: '', amount: '2' },
    { name: 'x', amount: '0' },
    { name: 'x', amount: '2.555' },
    { name: 'x', amount: 'free' },
  ])('refuses %j', async (fields) => {
    const rpc = admin();
    expect((await createAffiliate('en', IDLE, form(fields))).status).toBe('error');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('payCommissions and endSubscription', () => {
  it('marks the commissions paid and says how many', async () => {
    const rpc = admin({ data: 3 });
    expect(await payCommissions('en', ID)).toEqual({ status: 'done', count: 3 });
    expect(rpc).toHaveBeenCalledWith('admin_pay_commissions', { p_affiliate: ID });
  });

  it('ends a subscription', async () => {
    const rpc = admin();
    expect(await endSubscription('en', ID)).toEqual({ status: 'done' });
    expect(rpc).toHaveBeenCalledWith('admin_end_subscription', { p_id: ID });
  });

  it('refuses an id that is not one', async () => {
    const rpc = admin();
    expect(await payCommissions('en', 'x')).toMatchObject({ status: 'error', reason: 'invalid' });
    expect(await endSubscription('en', 'x')).toMatchObject({ status: 'error', reason: 'invalid' });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('grantSubscription', () => {
  it('gives a package for a project', async () => {
    const rpc = admin();
    const result = await grantSubscription(
      'en',
      IDLE,
      form({ email: ' Founder@Example.test ', plan: 'strategist', project: ID, days: '365' }),
    );
    expect(result).toEqual({ status: 'done' });
    expect(rpc).toHaveBeenCalledWith('admin_grant_subscription', {
      p_email: 'founder@example.test',
      p_plan_id: 'strategist',
      p_days: 365,
      p_project_id: ID,
    });
  });

  it('gives the course plan without a project', async () => {
    const rpc = admin();
    await grantSubscription(
      'en',
      IDLE,
      form({ email: 'a@example.test', plan: 'course', project: '', days: '30' }),
    );
    expect(rpc).toHaveBeenCalledWith('admin_grant_subscription', {
      p_email: 'a@example.test',
      p_plan_id: 'course',
      p_days: 30,
    });
  });

  it.each([
    { email: 'nope', plan: 'course', days: '30' },
    { email: 'a@example.test', plan: 'gold', days: '30' },
    { email: 'a@example.test', plan: 'course', days: '0' },
    { email: 'a@example.test', plan: 'course', days: '731' },
    { email: 'a@example.test', plan: 'course', days: '30', project: 'x' },
  ])('refuses %j', async (fields) => {
    const rpc = admin();
    expect(await grantSubscription('en', IDLE, form(fields))).toEqual({
      status: 'error',
      reason: 'invalid',
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('the guard', () => {
  it('lets a refusal of the guard through, so the page answers 404', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('NEXT_NOT_FOUND'));
    await expect(payCommissions('en', ID)).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('reports any other failure as failed', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('boom'));
    expect(await payCommissions('en', ID)).toEqual({ status: 'error', reason: 'failed' });
  });
});
