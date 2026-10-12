import { ENGINE_VERSION, type TaxRule } from '@sbn/engine';
import { sampleAnswers } from '@sbn/question-bank/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import {
  analyseProject,
  pricingOptionsOf,
  referenceDateOf,
  runInputsOf,
  runSource,
} from './analyse';
import { inputHash } from './input-hash';
import { loadRunSource } from './load';
import { recordEngineRun } from './record';
import { summaryOf } from './summary';
import { PROJECT, REFERENCE_DATE, runOf, sampleSource } from './testing';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./load', () => ({ loadRunSource: vi.fn() }));
vi.mock('./record', () => ({ recordEngineRun: vi.fn() }));

const client = {} as SupabaseServerClient;
const now = new Date('2026-10-12T23:30:00Z');

afterEach(() => {
  vi.clearAllMocks();
});

describe('referenceDateOf', () => {
  it('is the day in UTC, so that month 1 is the month after it (D-184)', () => {
    expect(referenceDateOf(now)).toBe('2026-10-12');
    expect(referenceDateOf(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-31');
  });
});

describe('pricingOptionsOf (D-189)', () => {
  const withD5 = (text: string) =>
    sampleSource({}, { ...sampleAnswers(), D5: { status: 'answered', value: text } });

  it('does not allow a premium without a D5 answer', () => {
    const answers = sampleAnswers();
    delete answers.D5;
    expect(pricingOptionsOf(sampleSource({}, answers))).toEqual({ premiumAllowed: false });
    expect(pricingOptionsOf(sampleSource({}, { ...answers, D5: { status: 'unknown' } }))).toEqual({
      premiumAllowed: false,
    });
  });

  it('allows a premium when the difference is measurable, and not when it is vague', () => {
    expect(pricingOptionsOf(withD5('نصل خلال ساعتين بدل ثلاثة أيام عند المنافسين'))).toEqual({
      premiumAllowed: true,
    });
    expect(pricingOptionsOf(withD5('جودة أفضل وخدمة أحسن بكثير من غيرنا تماما'))).toEqual({
      premiumAllowed: false,
    });
  });
});

describe('runSource', () => {
  it('runs the engine on a calculable project', async () => {
    const outcome = await runSource(sampleSource(), REFERENCE_DATE);
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') expect(outcome.run.engineVersion).toBe(ENGINE_VERSION);
  });

  it('gives the reasons for answers that cannot be calculated, never a guess', async () => {
    const outcome = await runSource(sampleSource({}, {}), REFERENCE_DATE);
    expect(outcome.status).toBe('not_calculable');
    if (outcome.status === 'not_calculable') {
      expect(outcome.reasons.map((reason) => reason.code)).toContain('missing_answer');
    }
  });

  it('is deterministic: the same inputs give an equal run', async () => {
    const [first, second] = await Promise.all([
      runSource(sampleSource(), REFERENCE_DATE),
      runSource(sampleSource(), REFERENCE_DATE),
    ]);
    expect(first).toEqual(second);
    expect(first).toEqual({
      status: 'ok',
      run: runOf(sampleSource(), pricingOptionsOf(sampleSource())),
    });
  });

  it('is failed, and logged without the cause’s text, when the engine refuses a rule', async () => {
    const malformed: TaxRule = {
      id: 'x',
      countryCode: 'JO',
      legalForm: 'sole',
      regime: '',
      levy: 'income_tax',
      kind: 'tax',
      basis: 'turnover',
      rate: { num: 1n, den: 20n },
      brackets: [],
      fixedAmount: null,
      minimum: null,
      turnoverCeiling: null,
      paymentMonth: 4,
      currency: 'JOD',
      effectiveFrom: '2026-01-01',
      sourceUrl: 'https://example.test/rule',
      lastVerified: null,
      status: 'unverified',
    };
    const outcome = await runSource(sampleSource({ taxRules: [malformed] }), REFERENCE_DATE);
    expect(outcome).toEqual({ status: 'failed' });
    expect(log.error).toHaveBeenCalledWith('engine.run_failed', {
      code: 'invalid_param',
      errorName: 'EngineError',
      projectId: PROJECT.id,
    });
  });
});

describe('analyseProject (rule 4, D-238)', () => {
  const recordedAs = (outcome: 'recorded' | 'exists' | 'failed') => {
    vi.mocked(recordEngineRun).mockResolvedValue(outcome);
  };

  it('is null for a project that is not the account’s, and runs nothing', async () => {
    vi.mocked(loadRunSource).mockResolvedValue(null);
    expect(await analyseProject(client, PROJECT.id, now)).toBeNull();
    expect(recordEngineRun).not.toHaveBeenCalled();
  });

  it('runs a calculable project and records its summary under the hash of its inputs', async () => {
    const source = sampleSource();
    vi.mocked(loadRunSource).mockResolvedValue(source);
    recordedAs('recorded');

    const analysis = await analyseProject(client, PROJECT.id, now);

    const hash = inputHash(runInputsOf(source, '2026-10-12'));
    expect(analysis).toMatchObject({ source, inputHash: hash, recorded: 'recorded' });
    expect(analysis?.outcome.status).toBe('ok');
    expect(recordEngineRun).toHaveBeenCalledTimes(1);
    expect(recordEngineRun).toHaveBeenCalledWith(client, {
      projectId: PROJECT.id,
      inputHash: hash,
      engineVersion: ENGINE_VERSION,
      summary: summaryOf(runOf(source, pricingOptionsOf(source))),
    });
  });

  it('keeps the same hash while the inputs and the month are unchanged, and a new one when not', async () => {
    const hashOf = async (source: ReturnType<typeof sampleSource>, at: Date) => {
      vi.mocked(loadRunSource).mockResolvedValue(source);
      recordedAs('exists');
      return (await analyseProject(client, PROJECT.id, at))?.inputHash;
    };
    const first = await hashOf(sampleSource(), now);
    expect(await hashOf(sampleSource(), new Date('2026-10-03T08:00:00Z'))).toBe(first);
    expect(await hashOf(sampleSource(), new Date('2026-11-01T08:00:00Z'))).not.toBe(first);
    const edited = sampleSource(
      {},
      { ...sampleAnswers(), F1: { status: 'answered', value: { amount: 31, currency: 'JOD' } } },
    );
    expect(await hashOf(edited, now)).not.toBe(first);
  });

  it('passes on that the row already exists, and still gives the run', async () => {
    vi.mocked(loadRunSource).mockResolvedValue(sampleSource());
    recordedAs('exists');
    const analysis = await analyseProject(client, PROJECT.id, now);
    expect(analysis?.recorded).toBe('exists');
    expect(analysis?.outcome.status).toBe('ok');
  });

  it('renders anyway when recording fails', async () => {
    vi.mocked(loadRunSource).mockResolvedValue(sampleSource());
    recordedAs('failed');
    const analysis = await analyseProject(client, PROJECT.id, now);
    expect(analysis?.recorded).toBe('failed');
    expect(analysis?.outcome.status).toBe('ok');
  });

  it('records nothing for answers that cannot be calculated yet', async () => {
    vi.mocked(loadRunSource).mockResolvedValue(sampleSource({}, {}));
    const analysis = await analyseProject(client, PROJECT.id, now);
    expect(analysis?.outcome.status).toBe('not_calculable');
    expect(analysis?.recorded).toBe('skipped');
    expect(recordEngineRun).not.toHaveBeenCalled();
  });

  it('records nothing when the tax rules could not be read, as its hash would name rules it never saw', async () => {
    vi.mocked(loadRunSource).mockResolvedValue(sampleSource({ taxRulesRead: false }));
    const analysis = await analyseProject(client, PROJECT.id, now);
    expect(analysis?.outcome.status).toBe('ok');
    expect(analysis?.recorded).toBe('skipped');
    expect(recordEngineRun).not.toHaveBeenCalled();
  });
});
