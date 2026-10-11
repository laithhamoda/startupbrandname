import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import {
  CRITERION_IDS,
  scoreCriteria,
  type Criterion,
  type CriterionId,
  type CriterionStatus,
} from './feasibility';
import { defaultFigure } from './figure';
import { flatAnswers, flatProvenance, jodItems, real, runFlat } from './flat-vector';
import { makeRate } from './rate';
import type { EngineRun } from './run';

const statusOf = (run: EngineRun, id: CriterionId): CriterionStatus => {
  const found = run.feasibility.criteria.find((criterion) => criterion.id === id);
  if (found === undefined) throw new Error(`no criterion ${id}`);
  return found.status;
};

const criterion = (run: EngineRun, id: CriterionId): Criterion => {
  const found = run.feasibility.criteria.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no criterion ${id}`);
  return found;
};

const statuses = (run: EngineRun): Record<CriterionId, CriterionStatus> =>
  Object.fromEntries(
    run.feasibility.criteria.map((candidate) => [candidate.id, candidate.status]),
  ) as Record<CriterionId, CriterionStatus>;

const withAnswers = (more: Answers, overrides = {}): EngineRun =>
  runFlat(flatAnswers(more), flatProvenance(), overrides);

/** A project of the flat vector that sells 100 units a month: it never covers 1,000 of fixed costs. */
const NEVER = { F6: real({ month1: 100, month6: 100, month12: 100 }) };

/** A subscription of the flat vector: 5% churn, marketing M a month. */
const subscription = (marketing: number): Answers => ({
  F2: real('subscription'),
  'F2.1': real(5),
  'F4.1': real({ amount: marketing, currency: 'JOD' }),
});

describe('the flat vector: every evaluated criterion passes', () => {
  // Base: 400 x 6 - 1,000 = 1,400 a month, break-even month 1, funding need 3,000 (month 0), floor
  // 4 + 1,000 / 400 = 6.5 against a price of 10, conservative break-even month 4, cumulative cash
  // -3,000 -1,600 -200 +1,200 so payback is 3 months, BE units ceil(1,000 / 6) = 167 against 500.
  const run = runFlat();

  it('lists the 11 criteria of D-227 in order', () => {
    expect(run.feasibility.criteria.map((candidate) => candidate.id)).toEqual(CRITERION_IDS);
    expect(CRITERION_IDS).toEqual([
      'margin_positive',
      'break_even_within_window',
      'break_even_within_target',
      'break_even_within_runway',
      'funding_within_capital',
      'setup_within_capital',
      'price_above_floor',
      'ltv_cac_at_minimum',
      'conservative_break_even',
      'payback_within_window',
      'break_even_units_within_capacity',
    ]);
  });

  it('passes ten criteria and leaves LTV / CAC out because the project is no subscription', () => {
    expect(statuses(run)).toEqual({
      margin_positive: 'pass',
      break_even_within_window: 'pass',
      break_even_within_target: 'pass',
      break_even_within_runway: 'pass',
      funding_within_capital: 'pass',
      setup_within_capital: 'pass',
      price_above_floor: 'pass',
      ltv_cac_at_minimum: 'not_evaluated',
      conservative_break_even: 'pass',
      payback_within_window: 'pass',
      break_even_units_within_capacity: 'pass',
    });
    expect(criterion(run, 'ltv_cac_at_minimum').reason).toBe('not_applicable');
    expect(criterion(run, 'margin_positive').reason).toBeNull();
  });

  it('scores passed over evaluated as an exact rate: 10 of 10 is 100 percent', () => {
    expect(run.feasibility.evaluated).toBe(10);
    expect(run.feasibility.passed).toBe(10);
    expect(run.feasibility.score?.value).toEqual(makeRate(1n, 1n));
    expect(run.feasibility.notes).toEqual([]);
  });

  it('agrees with the numbers the other analyses already have', () => {
    expect(run.unitEconomics.status === 'ok' && run.unitEconomics.breakEvenMonth.value).toBe(1);
    expect(run.cash.cashFlow.status === 'ok' && run.cash.cashFlow.fundingNeed.value.minor).toBe(
      3_000_000n,
    );
    expect(run.pricing.floor?.value.minor).toBe(6_500n);
    expect(run.scenarios.conservative.breakEvenMonth.value).toBe(4);
    expect(run.cash.cashFlow.status === 'ok' && run.cash.cashFlow.payback.value).toBe(3);
    // No alert of T8 or T7 is raised, so the criteria and the alerts say the same thing.
    expect(run.alerts.filter((alert) => alert.origin === 'economics')).toEqual([]);
  });

  it('lists the answers, defaults and rule each criterion used, as references', () => {
    expect(criterion(run, 'margin_positive').inputs).toEqual(
      expect.arrayContaining([
        { kind: 'answer', id: 'F1' },
        { kind: 'answer', id: 'F3' },
        { kind: 'rule', id: 'feasibility.margin_positive' },
      ]),
    );
    expect(criterion(run, 'break_even_within_target').inputs).toContainEqual({
      kind: 'answer',
      id: 'H5',
    });
    expect(criterion(run, 'break_even_within_runway').inputs).toContainEqual({
      kind: 'answer',
      id: 'A7',
    });
    expect(criterion(run, 'break_even_within_window').inputs).toContainEqual({
      kind: 'default',
      id: 'feasibility.window_months',
    });
    expect(criterion(run, 'funding_within_capital').inputs).toContainEqual({
      kind: 'answer',
      id: 'A5',
    });
    expect(criterion(run, 'break_even_units_within_capacity').inputs).toContainEqual({
      kind: 'answer',
      id: 'E7',
    });
  });

  it('gives the score the combined provenance of the criteria it counted', () => {
    expect(run.feasibility.score).toMatchObject({ source: 'assumption', validated: false });
    expect(run.feasibility.score?.inputs).toContainEqual({ kind: 'rule', id: 'feasibility.score' });
  });
});

describe('each criterion on its own', () => {
  it('margin above zero: a variable cost of 12 makes the margin minus 2', () => {
    const run = withAnswers({ F3: real(jodItems(['M', 12])) });
    expect(statusOf(run, 'margin_positive')).toBe('fail');
    // With no break-even at all, every criterion that needs one fails against a limit that is set.
    expect(statusOf(run, 'break_even_within_window')).toBe('fail');
    expect(statusOf(run, 'break_even_within_target')).toBe('fail');
    expect(statusOf(run, 'break_even_within_runway')).toBe('fail');
    expect(statusOf(run, 'break_even_units_within_capacity')).toBe('fail');
    expect(statusOf(run, 'ltv_cac_at_minimum')).toBe('not_evaluated');
    expect(run.feasibility.score?.value).toEqual(makeRate(1n, 10n));
  });

  it('a margin of exactly zero is not above zero', () => {
    expect(statusOf(withAnswers({ F3: real(jodItems(['M', 10])) }), 'margin_positive')).toBe(
      'fail',
    );
    expect(statusOf(withAnswers({ F3: real(jodItems(['M', 9.999])) }), 'margin_positive')).toBe(
      'pass',
    );
  });

  it('leaves the limits of the founder out when H5 or A7 is unset, even without a break-even', () => {
    const run = withAnswers({ H5: { status: 'unknown' }, A7: { status: 'unknown' } });
    expect(statusOf(run, 'break_even_within_target')).toBe('not_evaluated');
    expect(criterion(run, 'break_even_within_target').reason).toBe('input_missing');
    expect(statusOf(run, 'break_even_within_runway')).toBe('not_evaluated');
    const blocked = withAnswers({ F3: real(jodItems(['M', 12])), H5: { status: 'unknown' } });
    expect(statusOf(blocked, 'break_even_within_target')).toBe('not_evaluated');
    expect(run.feasibility.evaluated).toBe(8);
  });

  // The ramp 0, 400, 400 reaches 240 units in month 4 (80 a month from month 2): 240 x 6 - 1,000 =
  // 440, while month 3 (160 units) earns 960 - 1,000 = -40. Break-even is month 4.
  it('reads A7 as the T8 alert does: month 4 is within 3 to 6 months and after "under 3"', () => {
    const ramp = { F6: real({ month1: 0, month6: 400, month12: 400 }) };
    const within = withAnswers({ ...ramp, A7: real('3to6') });
    expect(within.unitEconomics.status === 'ok' && within.unitEconomics.breakEvenMonth.value).toBe(
      4,
    );
    expect(statusOf(within, 'break_even_within_runway')).toBe('pass');
    expect(within.alerts.some((alert) => alert.code === 'break_even_month_above_runway')).toBe(
      false,
    );
    const late = withAnswers({ ...ramp, A7: real('lt3') });
    expect(statusOf(late, 'break_even_within_runway')).toBe('fail');
    expect(late.alerts.some((alert) => alert.code === 'break_even_month_above_runway')).toBe(true);
  });

  it('reads H5 as the T8 alert does, and a bound on the month itself passes', () => {
    // The ramp 0, 150, 400 breaks even in month 7 (month 6 has 150 units: 900 - 1,000 < 0).
    const ramp = { F6: real({ month1: 0, month6: 150, month12: 400 }) };
    expect(statusOf(withAnswers({ ...ramp, H5: real('m6') }), 'break_even_within_target')).toBe(
      'fail',
    );
    expect(statusOf(withAnswers({ ...ramp, H5: real('m12') }), 'break_even_within_target')).toBe(
      'pass',
    );
    const sixth = withAnswers({ F6: real({ month1: 0, month6: 400, month12: 400 }) });
    expect(statusOf(sixth, 'break_even_within_target')).toBe('pass');
    // Month 1 against "under 3 months": 1 is within 3.
    expect(statusOf(runFlat(), 'break_even_within_runway')).toBe('pass');
  });

  it('passes the top buckets, which no month in the horizon can break', () => {
    const run = withAnswers({ ...NEVER, H5: real('more'), A7: real('gt12') });
    expect(statusOf(run, 'break_even_within_target')).toBe('pass');
    expect(statusOf(run, 'break_even_within_runway')).toBe('pass');
    expect(run.alerts.some((alert) => alert.code === 'break_even_month_above_target')).toBe(false);
  });

  it('fails the limits when no break-even is reached and the bound lies inside the horizon', () => {
    const run = withAnswers({ ...NEVER, H5: real('m36'), A7: real('6to12') });
    expect(run.unitEconomics.status === 'ok' && run.unitEconomics.breakEvenMonth.value).toBeNull();
    expect(statusOf(run, 'break_even_within_window')).toBe('fail');
    expect(statusOf(run, 'break_even_within_target')).toBe('fail');
    expect(statusOf(run, 'break_even_within_runway')).toBe('fail');
    expect(statusOf(run, 'conservative_break_even')).toBe('fail');
    expect(statusOf(run, 'payback_within_window')).toBe('fail');
    expect(
      run.alerts.filter((alert) => alert.code.startsWith('break_even_month_above')).length,
    ).toBe(2);
  });

  it('does not call a limit broken that lies beyond a shorter projection', () => {
    const run = withAnswers(
      { ...NEVER, H5: real('m24') },
      { horizonMonths: defaultFigure('engine.horizon_months', 12) },
    );
    expect(statusOf(run, 'break_even_within_target')).toBe('not_evaluated');
    expect(criterion(run, 'break_even_within_target').reason).toBe('beyond_projection');
    // A bound inside the shorter projection is still broken by a missing break-even.
    expect(statusOf(run, 'break_even_within_runway')).toBe('fail');
  });

  it('reads months within the window, or the projection when that is shorter', () => {
    const ramp = { F6: real({ month1: 0, month6: 150, month12: 400 }) };
    const tight = withAnswers(ramp, {
      feasibilityWindowMonths: defaultFigure('feasibility.window_months', 6),
    });
    expect(statusOf(tight, 'break_even_within_window')).toBe('fail');
    const roomy = withAnswers(ramp, {
      feasibilityWindowMonths: defaultFigure('feasibility.window_months', 7),
    });
    expect(statusOf(roomy, 'break_even_within_window')).toBe('pass');
    const short = withAnswers(NEVER, {
      horizonMonths: defaultFigure('engine.horizon_months', 12),
    });
    expect(statusOf(short, 'break_even_within_window')).toBe('fail');
  });

  it('funding need within the largest capital of A5: equal passes, one minor unit more fails', () => {
    // The profit is positive from month 1, so the lowest cash is the set-up costs at month 0.
    expect(
      statusOf(withAnswers({ F5: real(jodItems(['S', 8000])) }), 'funding_within_capital'),
    ).toBe('pass');
    expect(
      statusOf(withAnswers({ F5: real(jodItems(['S', 8000.001])) }), 'funding_within_capital'),
    ).toBe('fail');
  });

  it('set-up costs within A5: equal passes, one minor unit more fails, like the alert', () => {
    const equal = withAnswers({ F5: real(jodItems(['S', 8000])) });
    expect(statusOf(equal, 'setup_within_capital')).toBe('pass');
    expect(equal.alerts.some((alert) => alert.code === 'setup_costs_above_capital')).toBe(false);
    const over = withAnswers({ F5: real(jodItems(['S', 8000.001])) });
    expect(statusOf(over, 'setup_within_capital')).toBe('fail');
    expect(over.alerts.some((alert) => alert.code === 'setup_costs_above_capital')).toBe(true);
  });

  it('leaves the capital criteria out without A5, or with A5 in another currency', () => {
    for (const a5 of [{ status: 'unknown' as const }, real({ min: 1, max: 2, currency: 'USD' })]) {
      const run = withAnswers({ A5: a5 });
      expect(statusOf(run, 'funding_within_capital')).toBe('not_evaluated');
      expect(statusOf(run, 'setup_within_capital')).toBe('not_evaluated');
      expect(criterion(run, 'setup_within_capital').reason).toBe('input_missing');
      expect(run.feasibility.evaluated).toBe(8);
    }
  });

  it('leaves the set-up and funding criteria out without F5, and the payback with them', () => {
    const run = withAnswers({ F5: { status: 'unknown' } });
    expect(statusOf(run, 'funding_within_capital')).toBe('not_evaluated');
    expect(statusOf(run, 'setup_within_capital')).toBe('not_evaluated');
    expect(statusOf(run, 'payback_within_window')).toBe('not_evaluated');
    expect(criterion(run, 'payback_within_window').inputs).toContainEqual({
      kind: 'answer',
      id: 'F5',
    });
    expect(run.feasibility.evaluated).toBe(7);
    // The other criteria are untouched: the score is out of the seven that were evaluated.
    expect(run.feasibility.passed).toBe(7);
  });

  it('price not below the T7 floor: 6.5 passes and 6.4 fails, like the alert', () => {
    const at = withAnswers({ F1: real({ amount: 6.5, currency: 'JOD' }) });
    expect(statusOf(at, 'price_above_floor')).toBe('pass');
    expect(at.alerts.some((alert) => alert.code === 'price_below_floor')).toBe(false);
    const below = withAnswers({ F1: real({ amount: 6.499, currency: 'JOD' }) });
    expect(statusOf(below, 'price_above_floor')).toBe('fail');
    expect(below.alerts.some((alert) => alert.code === 'price_below_floor')).toBe(true);
  });

  it('leaves the price criterion out when nothing is sold in year 1 (no floor)', () => {
    const run = withAnswers({ F6: real({ month1: 0, month6: 0, month12: 0 }) });
    expect(run.pricing.floor).toBeNull();
    expect(statusOf(run, 'price_above_floor')).toBe('not_evaluated');
    expect(criterion(run, 'price_above_floor').reason).toBe('not_applicable');
  });

  it('LTV / CAC of a subscription is judged against the minimum of 3', () => {
    // LTV = 6 / 5% = 120. CAC = marketing / 20 new customers (400 - 400 x 0.95).
    const good = withAnswers(subscription(400)); // CAC 20, ratio 6
    expect(statusOf(good, 'ltv_cac_at_minimum')).toBe('pass');
    expect(good.alerts.some((alert) => alert.code === 'ltv_to_cac_below_minimum')).toBe(false);
    const bad = withAnswers(subscription(1000)); // CAC 50, ratio 2.4
    expect(statusOf(bad, 'ltv_cac_at_minimum')).toBe('fail');
    expect(bad.alerts.some((alert) => alert.code === 'ltv_to_cac_below_minimum')).toBe(true);
    expect(good.feasibility.evaluated).toBe(11);
  });

  it('leaves LTV / CAC out when churn is unset (an answer missing) or zero (nothing to measure)', () => {
    const unset = withAnswers({ F2: real('subscription') });
    expect(statusOf(unset, 'ltv_cac_at_minimum')).toBe('not_evaluated');
    expect(criterion(unset, 'ltv_cac_at_minimum').reason).toBe('input_missing');
    const zero = withAnswers({ ...subscription(400), 'F2.1': real(0) });
    expect(criterion(zero, 'ltv_cac_at_minimum').reason).toBe('not_applicable');
  });

  it('leaves LTV / CAC out when the margin blocks T8', () => {
    const run = withAnswers({ ...subscription(400), F3: real(jodItems(['M', 12])) });
    expect(criterion(run, 'ltv_cac_at_minimum').reason).toBe('not_applicable');
  });

  it('break-even in the conservative scenario: months 1 to 3 empty, then 240 units at 4.4', () => {
    expect(statusOf(runFlat(), 'conservative_break_even')).toBe('pass');
    // Price 8: 240 x (8 - 4.4) = 864 against 1,000, so the conservative scenario never covers it
    // while the base (400 x 4 = 1,600) does.
    const run = withAnswers({ F1: real({ amount: 8, currency: 'JOD' }) });
    expect(statusOf(run, 'conservative_break_even')).toBe('fail');
    expect(statusOf(run, 'break_even_within_window')).toBe('pass');
  });

  it('payback within the window: 3 months in the vector, never when the cash stays below zero', () => {
    expect(statusOf(runFlat(), 'payback_within_window')).toBe('pass');
    expect(statusOf(withAnswers(NEVER), 'payback_within_window')).toBe('fail');
    const slow = withAnswers(
      { F5: real(jodItems(['S', 8000])) },
      { feasibilityWindowMonths: defaultFigure('feasibility.window_months', 5) },
    );
    // -8,000 + 1,400 x 5 = -1,000 after month 5 and +400 after month 6: payback is 6 months.
    expect(slow.cash.cashFlow.status === 'ok' && slow.cash.cashFlow.payback.value).toBe(6);
    expect(statusOf(slow, 'payback_within_window')).toBe('fail');
  });

  it('break-even units within E7: 167 against 500, and against 166', () => {
    expect(statusOf(runFlat(), 'break_even_units_within_capacity')).toBe('pass');
    const equal = withAnswers({ E7: real(167) });
    expect(statusOf(equal, 'break_even_units_within_capacity')).toBe('pass');
    expect(equal.alerts.some((alert) => alert.code === 'break_even_units_above_capacity')).toBe(
      false,
    );
    const over = withAnswers({ E7: real(166) });
    expect(statusOf(over, 'break_even_units_within_capacity')).toBe('fail');
    expect(over.alerts.some((alert) => alert.code === 'break_even_units_above_capacity')).toBe(
      true,
    );
  });

  it('leaves the capacity criterion out when E7 is missing', () => {
    const run = withAnswers({ E7: { status: 'unknown' } });
    expect(statusOf(run, 'break_even_units_within_capacity')).toBe('not_evaluated');
    expect(run.feasibility.evaluated).toBe(9);
  });
});

describe('the count', () => {
  const crit = (id: CriterionId, status: CriterionStatus): Criterion => ({
    id,
    status,
    reason: status === 'not_evaluated' ? 'input_missing' : null,
    source: 'user',
    confidence: 'high',
    validated: true,
    inputs: [{ kind: 'answer', id: 'F1' }],
  });

  it('counts only the evaluated criteria', () => {
    const result = scoreCriteria([
      crit('margin_positive', 'pass'),
      crit('break_even_within_window', 'fail'),
      crit('break_even_within_target', 'not_evaluated'),
    ]);
    expect(result.evaluated).toBe(2);
    expect(result.passed).toBe(1);
    expect(result.score?.value).toEqual(makeRate(1n, 2n));
  });

  it('gives no score and a note when nothing was evaluated, never a division by zero', () => {
    const result = scoreCriteria([
      crit('margin_positive', 'not_evaluated'),
      crit('price_above_floor', 'not_evaluated'),
    ]);
    expect(result.score).toBeNull();
    expect(result.evaluated).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.notes).toEqual([{ code: 'no_criterion_evaluated' }]);
    expect(scoreCriteria([]).score).toBeNull();
  });

  it('keeps 6 of 8 as the exact rate 3/4 and 0 passed as 0', () => {
    const list = (passed: number, failed: number) => [
      ...Array.from({ length: passed }, () => crit('margin_positive', 'pass')),
      ...Array.from({ length: failed }, () => crit('margin_positive', 'fail')),
    ];
    expect(scoreCriteria(list(6, 2)).score?.value).toEqual(makeRate(3n, 4n));
    expect(scoreCriteria(list(0, 3)).score?.value).toEqual(makeRate(0n, 1n));
  });
});
