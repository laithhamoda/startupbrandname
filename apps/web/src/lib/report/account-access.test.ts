import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { accountAccess } from './account-access';

const logError = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@/lib/log', () => ({ log: { error: logError } }));

const NOW = new Date('2026-10-26T12:00:00Z');
const PROJECT = 'a0000000-0000-4000-8000-000000000001';
const OTHER = 'b0000000-0000-4000-8000-000000000002';

/** What `my_launch_spot()` answers: a spot, a failure, or something that is not a spot. */
type SpotAnswer = 'none' | 'active' | 'kept' | 'error' | 'junk';

/** A client whose subscriptions read answers `rows`, or fails, and whose launch spot is `spot`. */
function client(
  rows: readonly object[] | 'error' = [],
  spot: SpotAnswer = 'none',
): SupabaseServerClient {
  const result =
    rows === 'error' ? { data: null, error: { code: 'XX000' } } : { data: rows, error: null };
  const spotResult =
    spot === 'error' ? { data: null, error: { code: 'XX000' } } : { data: spot, error: null };
  return {
    from: () => ({ select: () => Promise.resolve(result) }),
    rpc: () => Promise.resolve(spotResult),
  } as unknown as SupabaseServerClient;
}

const preview = async (email: string | null, spot: SpotAnswer = 'none') =>
  (await accountAccess(client([], spot), email, PROJECT, NOW)).access.fullReportPreview;

afterEach(() => {
  vi.unstubAllEnvs();
  logError.mockClear();
});

describe('accountAccess (D-245, D-290, D-313, D-320)', () => {
  it('opens the full report to nobody by default', async () => {
    const { access, previewListValid } = await accountAccess(
      client(),
      'founder@example.test',
      PROJECT,
      NOW,
    );
    expect(access.fullReportPreview).toBe(false);
    expect(access.planId).toBe('free');
    expect(previewListValid).toBe(true);
  });

  it('opens it to an address on the preview list, whatever its case', async () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', 'Owner@Example.test');
    expect(await preview('owner@example.test')).toBe(true);
    expect(await preview('someone@example.test')).toBe(false);
  });

  it('opens it to an account with an active launch spot, with or without an address (D-332)', async () => {
    vi.stubEnv('EARLY_ACCESS_FULL_REPORT', 'true');
    expect(await preview('someone@example.test', 'active')).toBe(true);
    expect(await preview(null, 'active')).toBe(true);
  });

  it('opens it to nobody without an active spot, even while the launch switch is on', async () => {
    vi.stubEnv('EARLY_ACCESS_FULL_REPORT', 'true');
    for (const spot of ['none', 'kept', 'junk'] as const) {
      expect(await preview('someone@example.test', spot), spot).toBe(false);
    }
  });

  it('closes when the spot cannot be read, and says so', async () => {
    vi.stubEnv('EARLY_ACCESS_FULL_REPORT', 'true');
    expect(await preview('someone@example.test', 'error')).toBe(false);
    expect(logError).toHaveBeenCalledWith('launch.spot_read_failed', { code: 'XX000' });
  });

  it('does not ask for the spot while the launch switch is off', async () => {
    expect(await preview('someone@example.test', 'active')).toBe(false);
    expect(logError).not.toHaveBeenCalled();
  });

  it('reads the launch switch as on only for exactly "true"', async () => {
    for (const raw of ['yes', 'TRUE', '1', 'false', '']) {
      vi.stubEnv('EARLY_ACCESS_FULL_REPORT', raw);
      expect(await preview('someone@example.test', 'active'), raw).toBe(false);
    }
  });

  it('tells the caller about a malformed preview list, and early access still stands alone', async () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', 'owner@');
    expect(await accountAccess(client(), 'owner@example.test', PROJECT, NOW)).toMatchObject({
      previewListValid: false,
      access: { fullReportPreview: false },
    });
    vi.stubEnv('EARLY_ACCESS_FULL_REPORT', 'true');
    expect(
      await accountAccess(client([], 'active'), 'owner@example.test', PROJECT, NOW),
    ).toMatchObject({
      previewListValid: false,
      access: { fullReportPreview: true },
    });
  });

  it('opens what the account’s running package includes', async () => {
    const running = {
      plan_id: 'commander',
      status: 'active',
      starts_at: '2026-10-01T00:00:00Z',
      ends_at: '2027-10-01T00:00:00Z',
      project_id: null,
    };
    const { access } = await accountAccess(client([running]), 'buyer@example.test', PROJECT, NOW);
    expect(access.planId).toBe('commander');
    expect(access.entitlements.report).toBe('full');
  });

  it('opens a project with its own purchase, and not with another project’s (D-320)', async () => {
    const bought = (projectId: string) => ({
      plan_id: 'strategist',
      status: 'active',
      starts_at: '2026-10-01T00:00:00Z',
      ends_at: '2027-10-01T00:00:00Z',
      project_id: projectId,
    });
    const own = await accountAccess(client([bought(PROJECT)]), 'buyer@example.test', PROJECT, NOW);
    expect(own.access.planId).toBe('strategist');
    const other = await accountAccess(client([bought(OTHER)]), 'buyer@example.test', PROJECT, NOW);
    expect(other.access.planId).toBe('free');
  });

  it('falls back to the free package when the subscriptions cannot be read', async () => {
    const { access } = await accountAccess(client('error'), 'buyer@example.test', PROJECT, NOW);
    expect(access.planId).toBe('free');
  });
});
