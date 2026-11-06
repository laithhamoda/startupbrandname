import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLaunchWindow } from '@/lib/launch/spot';
import { GET } from './route';

vi.mock('server-only', () => ({}));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));
vi.mock('@/env/client', () => ({
  getClientEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  }),
}));
vi.mock('@/lib/launch/spot', () => ({ loadLaunchWindow: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/launch/window (D-331, D-344)', () => {
  it('answers the real numbers, cached for a minute at the edge', async () => {
    vi.mocked(loadLaunchWindow).mockResolvedValue({
      spotsTotal: 500,
      spotsTaken: 40,
      spotsLeft: 460,
      endsAt: new Date('2027-02-03T20:59:59Z'),
      open: true,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=60');
    expect(await response.json()).toEqual({
      open: true,
      spotsLeft: 460,
      spotsTotal: 500,
      endsAt: '2027-02-03T20:59:59.000Z',
    });
  });

  it('answers a missing end date as null', async () => {
    vi.mocked(loadLaunchWindow).mockResolvedValue({
      spotsTotal: 500,
      spotsTaken: 500,
      spotsLeft: 0,
      endsAt: null,
      open: false,
    });

    const body = (await (await GET()).json()) as { endsAt: unknown; open: unknown };
    expect(body).toMatchObject({ endsAt: null, open: false });
  });

  it('answers 503, never cached and with no number, when the window cannot be read', async () => {
    vi.mocked(loadLaunchWindow).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'unavailable' });
  });
});
