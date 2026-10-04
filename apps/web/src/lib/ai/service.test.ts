import { randomUUID } from 'node:crypto';
import type { AiClient, ReviewOutput } from '@sbn/ai';
import type { Answers } from '@sbn/question-bank';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { AI_BUDGET_MS, type AiContext, RETRY_AFTER_FAILURE_MS, reviewWithAi } from './service';

// The promises of the AI review (ARCH-9): the stand-in never answers on production, nothing that
// identifies the founder leaves (rule 5), a stored result is reused (rule 4), every call is
// reserved and recorded (D-146), the save has one time budget (D-150), failures fall back to the
// fixed checks and are not repeated at once (D-151), and every skip is logged (D-152).

const reviewText = vi.hoisted(() => vi.fn<AiClient['reviewText']>());

vi.mock('@sbn/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sbn/ai')>()),
  anthropicClient: () => ({ reviewText }),
  fakeClient: () => ({ reviewText }),
}));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const MODEL = 'claude-haiku-4-5-20251001';
const PRICE = {
  input: 1,
  output: 5,
  cache_write: 1.25,
  cache_read: 0.1,
  source_url: 'https://platform.claude.com/docs/en/about-claude/pricing',
  checked_at: '2026-09-28',
};
const IDEA = 'أقدّم صيانة دورية لمكيّفات المطاعم الصغيرة';

interface Result {
  data?: unknown;
  error?: unknown;
}

interface Db {
  rpc: Record<string, Result>;
  settings: Result;
  lookupError: unknown;
  recordError: unknown;
  /** What record_ai_run() received, which the next lookup finds by its input hash. */
  runs: Record<string, unknown>[];
}

/** A Supabase client that answers like the database, from `overrides` where given. */
function database(overrides: Partial<Omit<Db, 'runs'>> = {}) {
  const db: Db = {
    settings: {
      data: [
        { key: 'ai.model.fast', value: MODEL },
        { key: 'ai.prices', value: { [MODEL]: PRICE } },
      ],
    },
    lookupError: null,
    recordError: null,
    runs: [],
    ...overrides,
    rpc: {
      crossborder_consent_state: { data: 'current' },
      reserve_ai_run: { data: { reservation: randomUUID(), reason: 'ok' } },
      ...overrides.rpc,
    },
  };
  const rpc = vi.fn((name: string, args: Record<string, unknown> = {}) => {
    if (name === 'record_ai_run') {
      if (!db.recordError) db.runs.push(args);
      return Promise.resolve({ data: db.runs.length, error: db.recordError });
    }
    const result = db.rpc[name];
    // A function this database does not have, as PostgREST answers.
    if (!result) return Promise.resolve({ data: null, error: { code: 'PGRST202' } });
    return Promise.resolve({ data: null, error: null, ...result });
  });
  const from = vi.fn((table: string) => {
    if (table === 'settings') {
      return { select: () => ({ in: () => Promise.resolve({ error: null, ...db.settings }) }) };
    }
    const filters = new Map<string, unknown>();
    const query = {
      eq: (column: string, value: unknown) => {
        filters.set(column, value);
        return query;
      },
      order: () => query,
      limit: () => query,
      maybeSingle: () => {
        const run = db.runs.findLast((row) => row.p_input_hash === filters.get('input_hash'));
        return Promise.resolve({
          data: run ? { output: run.p_output } : null,
          error: db.lookupError,
        });
      },
    };
    return { select: () => query };
  });
  return { db, rpc, from, supabase: { rpc, from } as unknown as SupabaseServerClient };
}

function context(supabase: SupabaseServerClient, answers: Answers = {}): AiContext {
  return {
    supabase,
    identity: { email: 'laith@example.com', names: ['ليث'] },
    projectId: randomUUID(),
    answers,
  };
}

const withIdea: Answers = { B1: { status: 'answered', value: IDEA } };

function review(output: Partial<ReviewOutput> | Record<string, unknown>) {
  return {
    input: {
      language: 'msa',
      msa: '',
      confirmation: '',
      violations: [],
      coherent: null,
      ...output,
    },
    usage: { inputTokens: 900, outputTokens: 80, cacheWriteTokens: 0, cacheReadTokens: 0 },
  };
}

const reserveCalls = (rpc: ReturnType<typeof database>['rpc']) =>
  rpc.mock.calls.filter(([name]) => name === 'reserve_ai_run').length;

beforeEach(() => {
  vi.stubEnv('AI_PROVIDER', 'fake');
  vi.stubEnv('VERCEL_ENV', undefined);
  reviewText.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('when AI is off', () => {
  it.each([
    ['the stand-in on production', { AI_PROVIDER: 'fake', VERCEL_ENV: 'production' }],
    ['AI_PROVIDER=off', { AI_PROVIDER: 'off' }],
    ['the API without a key', { AI_PROVIDER: 'anthropic' }],
  ])('%s never calls the model or the database', async (_case, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const { supabase, rpc, from } = database();

    expect(await reviewWithAi(context(supabase), 'B1', IDEA)).toBeNull();
    expect(reviewText).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(log.debug).toHaveBeenCalledWith('ai.skipped', { reason: 'off', questionId: 'B1' });
  });
});

describe('consent (D-147)', () => {
  it.each([
    ['outdated', 'consent_outdated'],
    ['none', 'no_consent'],
  ])('a consent that is %s keeps to the fixed checks', async (state, reason) => {
    const { supabase, rpc, from } = database({
      rpc: { crossborder_consent_state: { data: state } },
    });

    expect(await reviewWithAi(context(supabase), 'B1', IDEA)).toBeNull();
    expect(reviewText).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(reserveCalls(rpc)).toBe(0);
    expect(log.debug).toHaveBeenCalledWith('ai.skipped', { reason, questionId: 'B1' });
  });

  it('keeps to the fixed checks when the consent cannot be read', async () => {
    const { supabase } = database({
      rpc: { crossborder_consent_state: { data: null, error: { code: '08006' } } },
    });

    expect(await reviewWithAi(context(supabase), 'B1', IDEA)).toBeNull();
    expect(reviewText).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith('ai.error', {
      code: '08006',
      stage: 'consent',
      questionId: 'B1',
    });
  });

  it.each([
    ['the previous schema', { data: null, error: { code: 'PGRST202' } }],
    // The reservation migration applied, the consent one not (yet): an old consent must not count.
    ['a database migrated in part', { data: { reservation: randomUUID(), reason: 'ok' } }],
  ])('stays off on %s, whatever has_crossborder_consent() says', async (_case, reserve) => {
    const { supabase, rpc } = database({
      rpc: {
        crossborder_consent_state: { data: null, error: { code: 'PGRST202' } },
        has_crossborder_consent: { data: true },
        reserve_ai_run: reserve,
      },
    });

    expect(await reviewWithAi(context(supabase), 'B1', IDEA)).toBeNull();
    expect(reviewText).not.toHaveBeenCalled();
    expect(reserveCalls(rpc)).toBe(0);
    expect(rpc).not.toHaveBeenCalledWith('has_crossborder_consent');
    expect(log.warn).toHaveBeenCalledWith('ai.skipped', {
      reason: 'previous_schema',
      questionId: 'B1',
    });
    expect(log.error).not.toHaveBeenCalled();
  });
});

describe('settings', () => {
  it('turns AI off for a model without a price, rather than paying for a refused record', async () => {
    const { supabase } = database({
      settings: { data: [{ key: 'ai.model.fast', value: 'claude-unpriced' }] },
    });

    expect(await reviewWithAi(context(supabase), 'B1', IDEA)).toBeNull();
    expect(reviewText).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith('ai.skipped', {
      reason: 'no_settings',
      questionId: 'B1',
    });
  });

  it('keeps to the fixed checks when the settings cannot be read', async () => {
    const { supabase } = database({ settings: { data: null, error: { code: '08006' } } });

    expect(await reviewWithAi(context(supabase), 'B1', IDEA)).toBeNull();
    expect(log.error).toHaveBeenCalledWith('ai.error', {
      code: '08006',
      stage: 'settings',
      questionId: 'B1',
    });
  });
});

describe('de-identification (rule 5)', () => {
  it('sends no email, name or phone number of the founder', async () => {
    reviewText.mockResolvedValue(review({ coherent: true }));
    const { supabase } = database();

    await reviewWithAi(
      context(supabase),
      'B1',
      'أنا ليث، أقدّم صيانة المكيّفات للمطاعم. للتواصل LAITH@example.com أو 0791234567',
    );

    const sent = reviewText.mock.calls[0]?.[1].answer;
    expect(sent).toBe('أنا [name1]، أقدّم صيانة المكيّفات للمطاعم. للتواصل [email1] أو [phone1]');
  });

  it('gives the rewrite back in the founder’s own words, and stores it de-identified', async () => {
    const { supabase, db } = database();
    reviewText.mockResolvedValue(
      review({
        language: 'dialect',
        msa: 'أريد أن أقدّم الصيانة، والتواصل على [phone1]',
        confirmation: 'فهمت أنك تريد أن تقدّم الصيانة، والتواصل على [phone1].',
        coherent: true,
      }),
    );

    const result = await reviewWithAi(
      context(supabase),
      'B1',
      'بدي أقدّم الصيانة، والتواصل على 0791234567',
    );

    expect(result).toMatchObject({
      msa: 'أريد أن أقدّم الصيانة، والتواصل على 0791234567',
      confirmation: 'فهمت أنك تريد أن تقدّم الصيانة، والتواصل على 0791234567.',
    });
    expect(db.runs[0]?.p_output).toMatchObject({
      msa: 'أريد أن أقدّم الصيانة، والتواصل على [phone1]',
    });
  });
});

describe('reservations and records (D-146)', () => {
  it('records a call against its reservation, with no cost from the app', async () => {
    const reservation = randomUUID();
    const { supabase, db } = database({
      rpc: { reserve_ai_run: { data: { reservation, reason: 'ok' } } },
    });
    reviewText.mockResolvedValue(review({ coherent: true }));

    await reviewWithAi(context(supabase), 'B1', IDEA);

    expect(db.runs).toHaveLength(1);
    expect(db.runs[0]).toMatchObject({
      p_reservation: reservation,
      p_tool_id: 'review_text',
      p_model: MODEL,
      p_tokens_in: 900,
      p_tokens_out: 80,
    });
    expect(db.runs[0]).not.toHaveProperty('p_cost_usd');
  });

  it('keeps no copy of an answer that was not rewritten (PRIV-5)', async () => {
    const { supabase, db } = database();
    reviewText.mockResolvedValue(review({ msa: IDEA, coherent: true }));

    expect(await reviewWithAi(context(supabase), 'B1', IDEA)).toMatchObject({
      msa: IDEA,
      coherent: true,
    });
    expect(db.runs[0]?.p_output).toMatchObject({ msa: '', confirmation: '' });
  });

  it.each(['user_limit', 'global_cap', 'disabled'])(
    'stops at a reservation refused for %s, and logs why',
    async (reason) => {
      const { supabase, db } = database({
        rpc: { reserve_ai_run: { data: { reservation: null, reason } } },
      });

      expect(await reviewWithAi(context(supabase), 'B1', IDEA)).toBeNull();
      expect(reviewText).not.toHaveBeenCalled();
      expect(db.runs).toHaveLength(0);
      expect(log.info).toHaveBeenCalledWith('ai.skipped', { reason, questionId: 'B1' });
    },
  );

  it('still returns the review when recording it fails, and logs the failure', async () => {
    const { supabase } = database({ recordError: { code: '42501' } });
    reviewText.mockResolvedValue(review({ coherent: true }));

    expect(await reviewWithAi(context(supabase), 'B1', IDEA)).toMatchObject({ coherent: true });
    expect(log.error).toHaveBeenCalledWith('ai.error', {
      code: '42501',
      stage: 'record',
      questionId: 'B1',
    });
  });
});

describe('reuse (rule 4, D-151)', () => {
  it('reuses a stored review without a reservation or a model call', async () => {
    const { supabase, rpc } = database();
    reviewText.mockResolvedValue(review({ coherent: true }));
    const founder = context(supabase);

    await reviewWithAi(founder, 'B1', IDEA);
    expect(await reviewWithAi(founder, 'B1', IDEA)).toMatchObject({ coherent: true });

    expect(reviewText).toHaveBeenCalledTimes(1);
    expect(reserveCalls(rpc)).toBe(1);
  });

  it('checks the idea first, and reviews another answer only for a coherent idea (D-072)', async () => {
    const { supabase } = database();
    reviewText.mockResolvedValue(review({ coherent: false }));

    expect(await reviewWithAi(context(supabase, withIdea), 'B2', 'المطاعم تعاني')).toBeNull();
    expect(reviewText).toHaveBeenCalledTimes(1);
    expect(reviewText.mock.calls[0]?.[1].ideaCheck).toBe(true);
    expect(log.debug).toHaveBeenCalledWith('ai.skipped', {
      reason: 'idea_unclear',
      questionId: 'B2',
    });
  });

  it('pays for an unusable B1 output once, across two saves', async () => {
    const { supabase, db, rpc } = database();
    reviewText.mockResolvedValue(review({ language: 'klingon' }));
    const founder = context(supabase, withIdea);

    expect(await reviewWithAi(founder, 'B2', 'المطاعم تعاني')).toBeNull();
    expect(await reviewWithAi(founder, 'B3', 'أصحاب المطاعم الصغيرة')).toBeNull();

    expect(reviewText).toHaveBeenCalledTimes(1);
    expect(reserveCalls(rpc)).toBe(1);
    expect(db.runs.map((run) => run.p_output)).toEqual([{ unusable: true }]);
    expect(log.info).toHaveBeenCalledWith('ai.skipped', {
      reason: 'unusable_output',
      questionId: 'B1',
    });
  });

  it('skips the model when the stored reviews cannot be read, so nothing is paid twice', async () => {
    const { supabase, rpc } = database({ lookupError: { code: '08006' } });

    expect(await reviewWithAi(context(supabase), 'B1', IDEA)).toBeNull();
    expect(reviewText).not.toHaveBeenCalled();
    expect(reserveCalls(rpc)).toBe(0);
    expect(log.error).toHaveBeenCalledWith('ai.error', {
      code: '08006',
      stage: 'cache',
      questionId: 'B1',
    });
  });

  it('falls back when the model fails, and waits before trying the same input again', async () => {
    const { supabase } = database();
    reviewText.mockRejectedValue(new TypeError('fetch failed'));
    const founder = context(supabase);

    expect(await reviewWithAi(founder, 'B1', IDEA)).toBeNull();
    expect(log.error).toHaveBeenCalledWith('ai.error', {
      errorName: 'TypeError',
      stage: 'model',
      questionId: 'B1',
    });

    expect(await reviewWithAi(founder, 'B1', IDEA)).toBeNull();
    expect(reviewText).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith('ai.skipped', {
      reason: 'recent_failure',
      questionId: 'B1',
    });

    const later = Date.now() + RETRY_AFTER_FAILURE_MS + 1;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    await reviewWithAi(founder, 'B1', IDEA);
    expect(reviewText).toHaveBeenCalledTimes(2);
  });
});

describe('the time budget (D-150)', () => {
  it('is one 8-second signal for the whole save, shared by the B1 check and the answer', async () => {
    const budget = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(budget.signal);
    const { supabase, rpc } = database();
    // The idea check uses up the budget.
    reviewText.mockImplementation(() => {
      budget.abort();
      return Promise.resolve(review({ coherent: true }));
    });

    expect(await reviewWithAi(context(supabase, withIdea), 'B2', 'المطاعم تعاني')).toBeNull();

    expect(AI_BUDGET_MS).toBe(8_000);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(AI_BUDGET_MS);
    expect(reviewText).toHaveBeenCalledExactlyOnceWith(MODEL, expect.anything(), {
      signal: budget.signal,
    });
    // No reservation is spent on a review that has no time left.
    expect(reserveCalls(rpc)).toBe(1);
    expect(log.info).toHaveBeenCalledWith('ai.skipped', {
      reason: 'budget_spent',
      questionId: 'B2',
    });
  });

  it('ends a review that runs out of time, and logs it as a timeout', async () => {
    const budget = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(budget.signal);
    const { supabase } = database();
    reviewText.mockImplementation(
      (_model, _input, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    );

    const pending = reviewWithAi(context(supabase), 'B1', IDEA);
    await vi.waitFor(() => {
      expect(reviewText).toHaveBeenCalled();
    });
    budget.abort();

    expect(await pending).toBeNull();
    expect(log.warn).toHaveBeenCalledWith('ai.skipped', { reason: 'timeout', questionId: 'B1' });
    expect(log.error).not.toHaveBeenCalled();
  });
});
