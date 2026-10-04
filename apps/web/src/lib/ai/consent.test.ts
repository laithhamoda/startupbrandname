import { afterEach, describe, expect, it, vi } from 'vitest';
import { CROSSBORDER_VERSION } from '@/config/legal';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { accountConsentState, consentStateOrNull, crossborderConsentState } from './consent';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const USER = '6f1c1f1e-7d4b-4c55-9a51-0f6f5d2b9e10';
const PREVIOUS_SCHEMA = { crossborder_consent_state: { error: { code: 'PGRST202' } } };

/** A client whose RPCs answer from `results`, and whose consent_events lookup gives `latest`. */
function client(
  results: Record<string, { data?: unknown; error?: unknown }>,
  latest: { data?: unknown; error?: unknown } = {},
) {
  const rpc = vi.fn((name: string) =>
    Promise.resolve({ data: null, error: null, ...results[name] }),
  );
  const eq = vi.fn(() => query);
  const query = {
    eq,
    order: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve({ data: null, error: null, ...latest }),
  };
  const from = vi.fn(() => ({ select: () => query }));
  return { rpc, from, eq, supabase: { rpc, from } as unknown as SupabaseServerClient };
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

  it('gives null on the previous schema, and never asks the earlier function (D-155)', async () => {
    const { supabase, rpc } = client({
      ...PREVIOUS_SCHEMA,
      has_crossborder_consent: { data: true },
    });
    expect(await crossborderConsentState(supabase)).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('passes any other database error on', async () => {
    const failure = { code: '08006' };
    const { supabase, rpc } = client({ crossborder_consent_state: { error: failure } });
    await expect(crossborderConsentState(supabase)).rejects.toBe(failure);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('accountConsentState', () => {
  it('gives what the database counts, when it can', async () => {
    const { supabase, from } = client({ crossborder_consent_state: { data: 'outdated' } });
    expect(await accountConsentState(supabase, USER)).toBe('outdated');
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ['the current text', { action: 'given', text_version: CROSSBORDER_VERSION }, 'current'],
    ['an earlier text', { action: 'given', text_version: '2026-09-draft-1' }, 'outdated'],
    ['a withdrawal', { action: 'withdrawn', text_version: CROSSBORDER_VERSION }, 'none'],
    ['no event', null, 'none'],
  ])(
    'on the previous schema, compares the latest event with the text version: %s',
    async (_case, latest, state) => {
      const { supabase, from, eq } = client(PREVIOUS_SCHEMA, { data: latest });
      expect(await accountConsentState(supabase, USER)).toBe(state);
      expect(from).toHaveBeenCalledWith('consent_events');
      expect(eq).toHaveBeenCalledWith('user_id', USER);
      expect(eq).toHaveBeenCalledWith('kind', 'crossborder');
    },
  );

  it('throws when the consent events cannot be read', async () => {
    const failure = { code: '08006' };
    const { supabase } = client(PREVIOUS_SCHEMA, { error: failure });
    await expect(accountConsentState(supabase, USER)).rejects.toBe(failure);
  });
});

describe('consentStateOrNull', () => {
  it('gives null, and logs why, when the consent cannot be read', async () => {
    const { supabase } = client({ crossborder_consent_state: { error: { code: '08006' } } });
    expect(await consentStateOrNull(supabase)).toBeNull();
    expect(log.warn).toHaveBeenCalledWith('ai.consent_unreadable', { code: '08006' });
  });

  it('gives null on the previous schema, where the review is off', async () => {
    const { supabase } = client(PREVIOUS_SCHEMA);
    expect(await consentStateOrNull(supabase)).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('gives the state otherwise', async () => {
    const { supabase } = client({ crossborder_consent_state: { data: 'outdated' } });
    expect(await consentStateOrNull(supabase)).toBe('outdated');
  });
});
