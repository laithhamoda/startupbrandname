import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { overallConfidence } from './confidence';
import { scoreCriteria, type Criterion, type CriterionStatus } from './feasibility';
import { defaultFigure, type FigureConfidence } from './figure';
import { flatAnswers, flatProvenance, jodItems, real, runFlat } from './flat-vector';
import { DEFAULT_ENGINE_PARAMS, createEngineParams } from './params';
import { makeRate } from './rate';
import type { EngineRun } from './run';
import { verdictOf, type Blocker } from './verdict';

const withAnswers = (
  more: Answers,
  levels: Parameters<typeof flatProvenance>[0] = {},
  overrides = {},
): EngineRun => runFlat(flatAnswers(more), flatProvenance(levels), overrides);

const codes = (run: EngineRun): string[] => run.verdict.blockers.map((blocker) => blocker.code);

describe('the verdict of the flat vector', () => {
  it('is go: every evaluated criterion passes, the score is 100 percent and confidence is high', () => {
    const run = runFlat();
    expect(run.verdict.verdict.value).toBe('go');
    expect(run.verdict.blockers).toEqual([]);
    expect(run.verdict.holdBacks).toEqual([]);
    expect(run.confidence.level.value).toBe('high');
    expect(run.feasibility.score?.value).toEqual(makeRate(1n, 1n));
  });

  it('is go with medium confidence and revise with low confidence', () => {
    // Three of the five pivotal figures at medium or high: 60 percent is medium.
    const medium = withAnswers({}, { F1: 'low', F5: 'low' });
    expect(medium.confidence.level.value).toBe('medium');
    expect(medium.verdict.verdict.value).toBe('go');
    // Two of five: 40 percent is low, so a perfect score is only revise.
    const low = withAnswers({}, { F1: 'low', F3: 'low', F5: 'low' });
    expect(low.confidence.level.value).toBe('low');
    expect(low.feasibility.score?.value).toEqual(makeRate(1n, 1n));
    expect(low.verdict.verdict.value).toBe('revise');
    expect(low.verdict.holdBacks).toEqual(['confidence_low']);
  });

  it('lists what it used, with the weakest provenance of its inputs', () => {
    const run = runFlat();
    expect(run.verdict.verdict.inputs).toEqual(
      expect.arrayContaining([
        { kind: 'rule', id: 'verdict.verdict' },
        { kind: 'default', id: 'verdict.go_score_line' },
        { kind: 'rule', id: 'feasibility.score' },
        { kind: 'rule', id: 'confidence.overall' },
      ]),
    );
    expect(run.verdict.verdict.source).toBe('assumption');
  });
});

describe('the blockers', () => {
  it('stops a project whose margin is zero or less, whatever its score (variable cost 12)', () => {
    const run = withAnswers({ F3: real(jodItems(['M', 12])), H3: real({ values: ['loan'] }) });
    expect(codes(run)).toEqual(['margin_not_positive']);
    expect(run.verdict.verdict.value).toBe('stop');
    // The margin is minus 2, and the blocker is not repeated as "no break-even".
    expect(run.unitEconomics.status).toBe('blocked');
    expect(run.verdict.blockers[0]?.inputs).toContainEqual({ kind: 'answer', id: 'F3' });
  });

  it('stops a margin of exactly zero', () => {
    expect(codes(withAnswers({ F3: real(jodItems(['M', 10])) }))).toContain('margin_not_positive');
  });

  it('stops a project that stays stopped whatever its score', () => {
    // 10 of 10 criteria would pass if the margin were not the blocker: forced by a score of 100%.
    const run = withAnswers({ F3: real(jodItems(['M', 12])) });
    const forced = verdictOf(
      run.verdict.blockers,
      scoreCriteria(passing(10)),
      run.confidence,
      DEFAULT_ENGINE_PARAMS,
    );
    expect(forced.verdict.value).toBe('stop');
  });

  it('stops a project with no break-even within 36 months in the base case', () => {
    const run = withAnswers({
      F6: real({ month1: 100, month6: 100, month12: 100 }),
      H3: real({ values: ['grant'] }),
    });
    expect(run.unitEconomics.status).toBe('ok');
    expect(codes(run)).toEqual(['no_break_even_in_window']);
    expect(run.verdict.verdict.value).toBe('stop');
  });

  it('reads a shorter window: month 4 is a blocker when the window is 2 months', () => {
    const ramp = { F6: real({ month1: 0, month6: 400, month12: 400 }) };
    expect(codes(withAnswers(ramp))).toEqual([]);
    const tight = withAnswers(
      ramp,
      {},
      {
        feasibilityWindowMonths: defaultFigure('feasibility.window_months', 3),
      },
    );
    expect(codes(tight)).toEqual(['no_break_even_in_window']);
    // The break-even of the base case is in month 4, 3 months is the window.
    expect(tight.verdict.verdict.value).toBe('stop');
  });

  describe('a funding need above twice the largest capital, when H3 names only self and family', () => {
    // The profit is positive from month 1, so the lowest cash is minus the set-up costs at month 0.
    const need = (setup: number, h3: Answers['H3'] = real({ values: ['self'] })) =>
      withAnswers({ F5: real(jodItems(['S', setup])), H3: h3 });

    it('is not a blocker at exactly twice the capital, and is one minor unit more', () => {
      const exact = need(16000);
      expect(
        exact.cash.cashFlow.status === 'ok' && exact.cash.cashFlow.fundingNeed.value.minor,
      ).toBe(16_000_000n);
      expect(codes(exact)).toEqual([]);
      const over = need(16000.001);
      expect(over.cash.cashFlow.status === 'ok' && over.cash.cashFlow.fundingNeed.value.minor).toBe(
        16_000_001n,
      );
      expect(codes(over)).toEqual(['funding_need_above_capital_multiple']);
      expect(over.verdict.verdict.value).toBe('stop');
      expect(over.verdict.blockers[0]?.inputs).toEqual(
        expect.arrayContaining([
          { kind: 'answer', id: 'A5' },
          { kind: 'answer', id: 'H3' },
          { kind: 'default', id: 'verdict.funding_multiple' },
        ]),
      );
    });

    it('is a blocker for family money as well as savings', () => {
      expect(codes(need(17000, real({ values: ['self', 'family'] })))).toEqual([
        'funding_need_above_capital_multiple',
      ]);
    });

    it.each(['loan', 'investor', 'grant', 'competition'])(
      'is not a blocker when H3 names a %s',
      (source) => {
        expect(codes(need(17000, real({ values: ['self', source] })))).toEqual([]);
        expect(need(17000, real({ values: [source] })).verdict.verdict.value).not.toBe('stop');
      },
    );

    it('never stops a project over an unanswered H3 (null), or without A5 or F5', () => {
      expect(codes(need(17000, { status: 'unknown' }))).toEqual([]);
      expect(codes(withAnswers({ F5: real(jodItems(['S', 17000])), H3: undefined }))).toEqual([]);
      expect(
        codes(withAnswers({ F5: real(jodItems(['S', 17000])), A5: { status: 'unknown' } })),
      ).toEqual([]);
      expect(codes(withAnswers({ F5: { status: 'unknown' } }))).toEqual([]);
    });

    it('takes the multiple from the parameters', () => {
      const run = need(17000);
      const wider = runFlat(flatAnswers({ F5: real(jodItems(['S', 17000])) }), flatProvenance(), {
        fundingBlockerMultiple: defaultFigure('verdict.funding_multiple', makeRate(5n, 2n)),
      });
      expect(codes(run)).toEqual(['funding_need_above_capital_multiple']);
      expect(codes(wider)).toEqual([]);
    });
  });

  it('lists several blockers in the order margin, break-even, funding', () => {
    const run = withAnswers({
      F6: real({ month1: 0, month6: 0, month12: 0 }),
      F5: real(jodItems(['S', 20000])),
    });
    expect(codes(run)).toEqual(['no_break_even_in_window', 'funding_need_above_capital_multiple']);
  });
});

/** `n` criteria that pass, only for the thresholds of the verdict. */
function passing(count: number, failing = 0, skipped = 0): Criterion[] {
  const make = (status: CriterionStatus): Criterion => ({
    id: 'margin_positive',
    status,
    reason: status === 'not_evaluated' ? 'input_missing' : null,
    source: 'user',
    confidence: 'high',
    validated: true,
    inputs: [{ kind: 'answer', id: 'F1' }],
  });
  return [
    ...Array.from({ length: count }, () => make('pass')),
    ...Array.from({ length: failing }, () => make('fail')),
    ...Array.from({ length: skipped }, () => make('not_evaluated')),
  ];
}

describe('the go line', () => {
  const confidence = overallConfidence(
    // The confidence of a perfect vector: high.
    runFlat().input,
    DEFAULT_ENGINE_PARAMS,
  );
  const verdict = (count: number, failing: number, params = DEFAULT_ENGINE_PARAMS) =>
    verdictOf([], scoreCriteria(passing(count, failing)), confidence, params);

  it('is go at exactly 75 percent: passed x 4 >= evaluated x 3', () => {
    expect(verdict(6, 2).verdict.value).toBe('go'); // 6 x 4 = 24 = 8 x 3
    expect(verdict(3, 1).verdict.value).toBe('go');
    expect(verdict(9, 3).verdict.value).toBe('go');
  });

  it('is revise one criterion fewer, and holds the score back', () => {
    const result = verdict(5, 3); // 5 x 4 = 20 < 8 x 3 = 24
    expect(result.verdict.value).toBe('revise');
    expect(result.holdBacks).toEqual(['score_below_line']);
    expect(verdict(7, 3).verdict.value).toBe('revise'); // 70 percent
    expect(verdict(8, 3).verdict.value).toBe('revise'); // 8 x 4 = 32 < 11 x 3 = 33
  });

  it('is go at 100 percent and revise at 0', () => {
    expect(verdict(10, 0).verdict.value).toBe('go');
    expect(verdict(0, 5).verdict.value).toBe('revise');
  });

  it('leaves criteria that were not evaluated out of both sides of the line', () => {
    const result = verdictOf(
      [],
      scoreCriteria(passing(3, 1, 7)),
      confidence,
      DEFAULT_ENGINE_PARAMS,
    );
    expect(result.verdict.value).toBe('go');
  });

  it('is revise, with no score, when nothing was evaluated', () => {
    const result = verdictOf(
      [],
      scoreCriteria(passing(0, 0, 4)),
      confidence,
      DEFAULT_ENGINE_PARAMS,
    );
    expect(result.verdict.value).toBe('revise');
    expect(result.holdBacks).toEqual(['no_score']);
  });

  it('reads the line from the parameters', () => {
    const strict = createEngineParams({ goScoreLine: defaultFigure('g', makeRate(4n, 5n)) });
    expect(verdict(3, 1, strict).verdict.value).toBe('revise'); // 75 percent < 80 percent
    expect(verdict(4, 1, strict).verdict.value).toBe('go'); // exactly 80 percent
  });

  it('is stop whenever a blocker holds, whatever the score', () => {
    const blocker: Blocker = {
      code: 'margin_not_positive',
      source: 'user',
      confidence: 'high',
      validated: true,
      inputs: [{ kind: 'answer', id: 'F1' }],
    };
    const result = verdictOf(
      [blocker],
      scoreCriteria(passing(10, 0)),
      confidence,
      DEFAULT_ENGINE_PARAMS,
    );
    expect(result.verdict.value).toBe('stop');
    expect(result.blockers).toEqual([blocker]);
    expect(result.holdBacks).toEqual([]);
  });

  it('needs medium or high confidence even at 100 percent', () => {
    const low = overallConfidence(
      withAnswers({}, { F1: 'low', F3: 'low', F4: 'low' }).input,
      DEFAULT_ENGINE_PARAMS,
    );
    const result = verdictOf([], scoreCriteria(passing(10, 0)), low, DEFAULT_ENGINE_PARAMS);
    expect(result.verdict.value).toBe('revise');
    expect(result.holdBacks).toEqual(['confidence_low']);
    const both = verdictOf([], scoreCriteria(passing(1, 5)), low, DEFAULT_ENGINE_PARAMS);
    expect(both.holdBacks).toEqual(['score_below_line', 'confidence_low']);
  });
});

describe('determinism', () => {
  it('gives the same verdict for the same answers', () => {
    const levels: Record<string, FigureConfidence> = { F1: 'medium' };
    const first = withAnswers({}, levels);
    const second = withAnswers({}, levels);
    expect(first.verdict).toEqual(second.verdict);
    expect(first.feasibility).toEqual(second.feasibility);
  });
});
