import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { consentStateOrNull, crossborderConsentState } from './consent';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** A client whose RPCs answer from `results`. */
function client(results: Record<string, { data?: unknown; error?: unknown }>) {
  const rpc = vi.fn((name: string) =>
    Promise.resolve({ data: null, error: null, ...results[name] }),
  );
  return { rpc, supabase: { rpc } as unknown as SupabaseServerClient };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('crossborderConsentState (D-147)', () => {
  it.each(['current', 'outdated', 'none'])('reads a consent that is %s', async (state) => {
    const { supabase } = client({ crossborder_consent_state: { data: state } });
    expect(await crossborderConsentState(supabase)).toBe(state);
  });

  it('refuses an answer it does not know', async () => {
    const { supabase } = client({ crossborder_consent_state: { data: 'maybe' } });
    await expect(crossborderConsentState(supabase)).rejects.toThrow();
  });

  it('passes a database error on, a missing function included (D-191)', async () => {
    const missing = { code: 'PGRST202' };
    const { supabase, rpc } = client({ crossborder_consent_state: { error: missing } });
    await expect(crossborderConsentState(supabase)).rejects.toBe(missing);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('consentStateOrNull', () => {
  it('gives null, and logs why, when the consent cannot be read', async () => {
    const { supabase } = client({ crossborder_consent_state: { error: { code: '08006' } } });
    expect(await consentStateOrNull(supabase)).toBeNull();
    expect(log.error).toHaveBeenCalledWith('ai.consent_unreadable', { code: '08006' });
  });

  it('gives null, and logs it, when the function is missing', async () => {
    const { supabase } = client({ crossborder_consent_state: { error: { code: 'PGRST202' } } });
    expect(await consentStateOrNull(supabase)).toBeNull();
    expect(log.error).toHaveBeenCalledWith('ai.consent_unreadable', { code: 'PGRST202' });
  });

  it('gives the state otherwise', async () => {
    const { supabase } = client({ crossborder_consent_state: { data: 'outdated' } });
    expect(await consentStateOrNull(supabase)).toBe('outdated');
    expect(log.error).not.toHaveBeenCalled();
  });
});
