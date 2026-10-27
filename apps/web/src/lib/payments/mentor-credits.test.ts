import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { mentorCreditsOf, packArrived } from './mentor-credits';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const PROJECT = 'ab100000-0000-4000-8000-000000000001';
const REF = '0f8e3a52-6c1d-4b8a-9e2f-3d4c5b6a7980';

/** A client whose mentor_credits reads answer `result`, recording the filters. */
function client(result: { data: unknown; error: { code: string } | null }) {
  const filters: unknown[][] = [];
  const query = {
    eq: (...args: unknown[]) => {
      filters.push(['eq', ...args]);
      return query;
    },
    is: (...args: unknown[]) => {
      filters.push(['is', ...args]);
      return Promise.resolve(result);
    },
    maybeSingle: () => Promise.resolve(result),
  };
  const supabase = { from: () => ({ select: () => query }) } as unknown as SupabaseServerClient;
  return { supabase, filters };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('mentorCreditsOf (D-322)', () => {
  it('adds up the credits of the project that are not revoked', async () => {
    const { supabase, filters } = client({
      data: [{ messages: 10 }, { messages: 10 }],
      error: null,
    });
    expect(await mentorCreditsOf(supabase, PROJECT)).toBe(20);
    expect(filters).toEqual([
      ['eq', 'project_id', PROJECT],
      ['is', 'revoked_at', null],
    ]);
  });

  it('counts none when the read fails, and logs it', async () => {
    const { supabase } = client({ data: null, error: { code: '42501' } });
    expect(await mentorCreditsOf(supabase, PROJECT)).toBe(0);
    expect(log.error).toHaveBeenCalledWith('payments.credits_read_failed', { code: '42501' });
  });
});

describe('packArrived (D-322)', () => {
  it('finds the credit of the checkout', async () => {
    expect(await packArrived(client({ data: { id: 'c' }, error: null }).supabase, REF)).toBe(true);
    expect(await packArrived(client({ data: null, error: null }).supabase, REF)).toBe(false);
  });

  it('says not yet when the read fails', async () => {
    const { supabase } = client({ data: null, error: { code: '42501' } });
    expect(await packArrived(supabase, REF)).toBe(false);
    expect(log.error).toHaveBeenCalled();
  });
});
