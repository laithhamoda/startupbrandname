import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { launchSpotOf, loadLaunchWindow } from './spot';

const logError = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@/lib/log', () => ({ log: { error: logError } }));

/** A client whose `rpc` answers `result` whatever it is asked. */
function client(result: { data: unknown; error: { code: string } | null }) {
  return { rpc: vi.fn(() => Promise.resolve(result)) } as unknown as SupabaseServerClient;
}

const ROW = {
  spots_total: 500,
  spots_taken: 120,
  spots_left: 380,
  ends_at: '2027-02-03T20:59:59+00:00',
  open: true,
};

afterEach(() => {
  logError.mockClear();
});

describe('launchSpotOf (D-332, D-333)', () => {
  it.each(['active', 'kept', 'none'] as const)('answers %s as the database says', async (spot) => {
    expect(await launchSpotOf(client({ data: spot, error: null }))).toBe(spot);
  });

  it('asks for the signed-in account’s spot', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: 'none', error: null }));
    await launchSpotOf({ rpc } as unknown as SupabaseServerClient);
    expect(rpc).toHaveBeenCalledWith('my_launch_spot');
  });

  it('holds nothing when the read fails, and logs it', async () => {
    expect(await launchSpotOf(client({ data: null, error: { code: 'XX000' } }))).toBe('none');
    expect(logError).toHaveBeenCalledWith('launch.spot_read_failed', { code: 'XX000' });
  });

  it.each([null, 'admin', 7, { spot: 'active' }])(
    'holds nothing for the answer %j',
    async (data) => {
      expect(await launchSpotOf(client({ data, error: null }))).toBe('none');
    },
  );
});

describe('loadLaunchWindow (D-332)', () => {
  it('reads the counts, the end date and whether the window is open', async () => {
    expect(await loadLaunchWindow(client({ data: [ROW], error: null }))).toEqual({
      spotsTotal: 500,
      spotsTaken: 120,
      spotsLeft: 380,
      endsAt: new Date('2027-02-03T20:59:59Z'),
      open: true,
    });
  });

  it('reads a missing end date as null: the window is closed then', async () => {
    const window = await loadLaunchWindow(
      client({ data: [{ ...ROW, ends_at: null, open: false }], error: null }),
    );
    expect(window).toMatchObject({ endsAt: null, open: false });
  });

  it('answers null, logged, when the read fails', async () => {
    expect(await loadLaunchWindow(client({ data: null, error: { code: '42501' } }))).toBeNull();
    expect(logError).toHaveBeenCalledWith('launch.window_read_failed', { code: '42501' });
  });

  it.each([[[]], [[ROW, ROW]], [[{ ...ROW, spots_left: -1 }]], [null], ['x']])(
    'answers null, logged, for a shape it does not know: %j',
    async (data) => {
      expect(await loadLaunchWindow(client({ data, error: null }))).toBeNull();
      expect(logError).toHaveBeenCalledWith('launch.window_read_failed', { code: 'shape' });
    },
  );
});
