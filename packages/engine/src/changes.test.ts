import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { assess } from './assessment';
import {
  CHANGE_RULES,
  suggestChanges,
  type Change,
  type LeverShift,
  type SuggestedChanges,
} from './changes';
import { defaultFigure } from './figure';
import { flatAnswers, flatProvenance, jodItems, real, runFlat } from './flat-vector';
import { createEngineParams } from './params';
import { makeRate, type Rate } from './rate';
import { serialiseRun } from './serialise';
import type { ProvenanceBySteps } from './input';
import type { ProjectionAdjustments } from './projection';

/*
 * The hand-checked vectors of D-228 (D-260, D-261), all on the flat curve of 400 units a month,
 * fixed costs of 1,000 a month, set-up costs of 3,000, A5 of 5,000 to 8,000, A7 of three to six
 * months, H5 of 12 months, E7 of 500, cash payment and no payroll, marketing, seasonality,
 * inflation or tax, in dinars with three decimals (1,000 minor units to the dinar).
 */

const jod = (amount: number) => ({ amount, currency: 'JOD' });
const d4 = (...prices: number[]) =>
  real({ items: prices.map((price, index) => ({ name: `C${String(index)}`, price: jod(price) })) });
const none = { rules: [] };
const rate = (num: bigint, den: bigint): Rate => makeRate(num, den);

/** The minor units of a lever's start and end values, which are all the tests below need. */
const minors = (shift: LeverShift): [bigint, bigint] =>
  shift.unit === 'money' ? [shift.from.value.minor, shift.to.value.minor] : [0n, 0n];
/** The answers without one question, as if it had never been answered. */
const without = (answers: Answers, id: string): Answers =>
  Object.fromEntries(Object.entries(answers).filter(([key]) => key !== id));
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value');
  return value;
}
const levers = (change: Change): string[] => change.shifts.map((shift) => shift.lever);
const summary = (result: SuggestedChanges): string[] =>
  result.changes.map((change) => levers(change).join('+'));

/**
 * What the engine says about a change when the founder's answers are changed by it: the money levers
 * through the answers F1, F3 and F5 and the adapter, the fixed cost and the sales through the
 * adjustments of the projection. It does not use the search's own path, so it is an independent check.
 */
function verdictAfter(
  base: Answers,
  change: Change,
  provenance: ProvenanceBySteps = flatProvenance(),
): string {
  let answers: Answers = { ...base };
  let adjustments: ProjectionAdjustments = {};
  for (const shift of change.shifts) {
    if (shift.unit === 'money') {
      // Whole thousandths of a dinar, so the division is exact.
      const major = Number(shift.to.value.minor) / 1000;
      if (shift.lever === 'price') answers = { ...answers, F1: real(jod(major)) };
      else if (shift.lever === 'variable_cost')
        answers = { ...answers, F3: real(jodItems(['x', major])) };
      else answers = { ...answers, F5: real(jodItems(['x', major])) };
    } else if (shift.lever === 'fixed_costs') {
      adjustments = { ...adjustments, fixedCostMultiplier: shift.to.value };
    } else adjustments = { ...adjustments, salesMultiplier: shift.to.value };
  }
  const input = runFlat(answers, provenance).input;
  return assess(input, none, createEngineParams(), {}, adjustments).verdict.verdict.value;
}

/** Vector A: price 10 against a variable cost of 12, a loan named, competitors at 11 and 14. */
const stopAnswers = flatAnswers({
  F1: real(jod(10)),
  F3: real(jodItems(['x', 12])),
  H3: real({ values: ['loan'] }),
  D4: d4(11, 14),
});

/** Vector B: price 8 and set-up costs of 9,000 (7 of 10 criteria, no blocker). */
const reviseAnswers = flatAnswers({
  F1: real(jod(8)),
  F5: real(jodItems(['x', 9000])),
  D4: d4(11, 14),
});

describe('suggestChanges for a go', () => {
  it('needs no change and spends no evaluation', () => {
    const run = runFlat();
    const result = suggestChanges(run);
    expect(result.status).toBe('none_needed');
    expect(result.verdict.value).toBe('go');
    expect(result.changes).toEqual([]);
    expect(result.rethink).toEqual([]);
    expect(result.evaluations).toBe(0);
    expect(result.complete).toBe(true);
    expect(result.goBlockedBy).toBeNull();
    expect(result.marketCeiling).toBeNull();
    expect(result.parameters.map((figure) => figure.value)).toEqual([160]);
  });
});

describe('vector A: a stop with a negative margin', () => {
  const run = runFlat(stopAnswers);
  const result = suggestChanges(run);

  it('starts from a stop with one blocker, the margin', () => {
    expect(run.verdict.verdict.value).toBe('stop');
    expect(run.verdict.blockers.map((blocker) => blocker.code)).toEqual(['margin_not_positive']);
    expect(result.status).toBe('suggested');
    expect(result.marketCeiling?.value.minor).toBe(14_000n);
  });

  it('returns exactly three changes, smallest effort first', () => {
    // Variable cost alone: 400 x (10 - VC) - 1,000 >= 0 gives 7.500, minus 37.5 percent (effort 3/8).
    // Both levers by t: 400 x (10(1 + t) - 12(1 - t)) - 1,000 >= 0 needs t >= 20.45 percent, so 21 percent
    // (effort 42 percent). Price alone: 400 x (P - 12) - 1,000 >= 0 gives 14.500, plus 45 percent.
    expect(summary(result)).toEqual(['variable_cost', 'price+variable_cost', 'price']);
    expect(result.changes.map((change) => change.effort.value)).toEqual([
      rate(3n, 8n),
      rate(21n, 50n),
      rate(9n, 20n),
    ]);
  });

  it('lowers the variable cost to 7.500', () => {
    const [change] = result.changes;
    const [shift] = change?.shifts ?? [];
    expect(shift && minors(shift)).toEqual([12_000n, 7_500n]);
    expect(shift?.relativeChange.value).toEqual(rate(-3n, 8n));
    expect(change?.premium).toBe(false);
  });

  it('moves price and variable cost by the same 21 percent', () => {
    // Price 10 x 1.21 = 12.100 and variable cost 12 x 0.79 = 9.480 leave 400 x 2.62 - 1,000 = 48 a month.
    const change = result.changes[1];
    expect(change?.shifts.map(minors)).toEqual([
      [10_000n, 12_100n],
      [12_000n, 9_480n],
    ]);
    expect(change?.shifts.map((shift) => shift.relativeChange.value)).toEqual([
      rate(21n, 100n),
      rate(-21n, 100n),
    ]);
    expect(change?.premium).toBe(false);
  });

  it('raises the price to 14.500, above the largest competitor price, and says premium', () => {
    const change = result.changes[2];
    const [shift] = change?.shifts ?? [];
    expect(shift && minors(shift)).toEqual([10_000n, 14_500n]);
    expect(change?.premium).toBe(true);
  });

  it('judges every change by the engine: none leaves a blocker and each is a go here', () => {
    for (const change of result.changes) {
      expect(change.outcome.verdict.value).toBe('go');
      expect(change.reachesThreshold).toBe(true);
      expect(verdictAfter(stopAnswers, change)).toBe(change.outcome.verdict.value);
    }
  });

  it('is exact at the boundary: one minor unit less does not remove the blocker', () => {
    // At 7.500 the profit is 400 x 2.5 - 1,000 = 0, which is a break-even month (a profit of zero or
    // more); at 7.501 it is 400 x 2.499 - 1,000 = -0.4 a month, so there is no break-even at all.
    const at = (cost: number) => runFlat({ ...stopAnswers, F3: real(jodItems(['x', cost])) });
    expect(at(7.5).verdict.verdict.value).not.toBe('stop');
    expect(at(7.501).verdict.blockers.map((blocker) => blocker.code)).toEqual([
      'no_break_even_in_window',
    ]);
  });

  it('gives each figure the provenance of an assumption that names the founder input it moved', () => {
    const [change] = result.changes;
    const [shift] = change?.shifts ?? [];
    for (const figure of [shift?.to, shift?.relativeChange, change?.effort]) {
      expect(figure?.source).toBe('assumption');
      expect(figure?.validated).toBe(false);
    }
    expect(shift?.to.inputs).toContainEqual({ kind: 'answer', id: 'F3' });
    expect(shift?.to.inputs).toContainEqual({ kind: 'rule', id: CHANGE_RULES.shift });
    expect(change?.outcome.verdict.inputs).toContainEqual({
      kind: 'rule',
      id: CHANGE_RULES.outcome,
    });
  });

  it('counts its evaluations inside the budget', () => {
    expect(result.complete).toBe(true);
    expect(result.evaluations).toBeGreaterThan(0);
    expect(result.evaluations).toBeLessThanOrEqual(160);
  });

  it('never searches a lever that cannot mend a margin that is not positive', () => {
    // Fixed costs, sales and set-up costs alone, or together, cannot remove the margin blocker.
    for (const change of result.changes) {
      expect(levers(change).some((lever) => lever === 'price' || lever === 'variable_cost')).toBe(
        true,
      );
    }
    expect(result.rethink).toEqual([]);
  });
});

describe('vector B: a revise', () => {
  const run = runFlat(reviseAnswers);
  const result = suggestChanges(run);

  it('starts from 7 of 10 and no blocker', () => {
    expect(run.verdict.verdict.value).toBe('revise');
    expect(run.feasibility.passed).toBe(7);
    expect(run.feasibility.evaluated).toBe(10);
    expect(run.verdict.blockers).toEqual([]);
  });

  it('suggests the price, the set-up costs and the variable cost, by effort', () => {
    expect(summary(result)).toEqual(['price', 'setup_costs', 'variable_cost']);
    expect(result.rethink).toEqual([]);
    expect(result.complete).toBe(true);
  });

  it('raises the price to 8.567, which the conservative scenario needs', () => {
    // 240 x (P - 4.4) >= 1,000 gives P >= 8.5667, so 8.567: plus 7.09 percent.
    const [price] = result.changes;
    const [shift] = price?.shifts ?? [];
    expect(shift && minors(shift)).toEqual([8_000n, 8_567n]);
    expect(shift?.relativeChange.value).toEqual(rate(567n, 8000n));
    expect(price?.outcome.passed).toBe(8);
    expect(price?.premium).toBe(false);
  });

  it('cuts the set-up costs to 8,000.000, which fixes two criteria at once', () => {
    // The funding need and the set-up costs fall within the capital of 8,000: 9 of 10, minus 11.11 percent.
    const setup = result.changes[1];
    const [shift] = setup?.shifts ?? [];
    expect(shift && minors(shift)).toEqual([9_000_000n, 8_000_000n]);
    expect(shift?.relativeChange.value).toEqual(rate(-1n, 9n));
    expect(setup?.outcome.passed).toBe(9);
    expect(setup?.outcome.evaluated).toBe(10);
    expect(setup?.outcome.score?.value).toEqual(rate(9n, 10n));
  });

  it('lowers the variable cost to 3.484, the last value whose conservative month still pays', () => {
    // 1.1 x VC <= 3.8333 gives VC <= 3.4848: 3.484 passes (a profit of 0.224 a month) and 3.485 does not.
    const vc = result.changes[2];
    const [shift] = vc?.shifts ?? [];
    expect(shift && minors(shift)).toEqual([4_000n, 3_484n]);
    expect(vc?.outcome.passed).toBe(8);
    const profit = (cost: number): number => 240 * (8 - 1.1 * cost) - 1000;
    expect(profit(3.484)).toBeGreaterThan(0);
    expect(profit(3.485)).toBeLessThan(0);
  });

  it('reaches the go line with each, judged by the engine', () => {
    for (const change of result.changes) {
      expect(change.reachesThreshold).toBe(true);
      expect(change.outcome.verdict.value).toBe('go');
      expect(verdictAfter(reviseAnswers, change)).toBe('go');
    }
  });

  it('would need 20 percent more sales, which is the fourth by effort and not returned', () => {
    // 240 x 1.2 x (8 - 4.4) = 1,036.8 >= 1,000 on the 5 percent grid; 15 percent gives 993.6.
    const sales = (factor: bigint) =>
      assess(
        run.input,
        none,
        createEngineParams(),
        {},
        {
          salesMultiplier: rate(factor, 100n),
        },
      ).feasibility.passed;
    expect(sales(115n)).toBe(7);
    expect(sales(120n)).toBe(8);
  });
});

describe('vector D: the fixed cost and the sales', () => {
  // 400 units at 10 with a variable cost of 7 earn 1,200 a month against fixed costs of 1,500: a loss
  // of 300 with no break-even, which is a blocker. The price must reach 10.75 (400 x 3.75 = 1,500), the
  // variable cost 6.25, the fixed costs 1,200 (minus 20 percent, a profit of 0) and the sales 500 units (plus 25 percent).
  const answers = flatAnswers({
    F3: real(jodItems(['x', 7])),
    F4: real(jodItems(['x', 1500])),
    D4: d4(11, 14),
  });
  const run = runFlat(answers);
  const result = suggestChanges(run);

  it('starts from a stop because no month breaks even', () => {
    expect(run.verdict.blockers.map((blocker) => blocker.code)).toEqual([
      'no_break_even_in_window',
    ]);
  });

  it('returns the price, the variable cost and the fixed costs; the sales come fourth', () => {
    expect(summary(result)).toEqual(['price', 'variable_cost', 'fixed_costs']);
    const [price, vc, fixed] = result.changes;
    expect(price?.shifts.map(minors)).toEqual([[10_000n, 10_750n]]);
    expect(vc?.shifts.map(minors)).toEqual([[7_000n, 6_250n]]);
    // Fixed costs go down to a tenth of a percent: exactly 80.0 percent of 1,500 is 1,200.
    const [shift] = fixed?.shifts ?? [];
    expect(shift?.unit).toBe('factor');
    expect(shift?.from.value).toEqual(rate(1n, 1n));
    expect(shift?.to.value).toEqual(rate(4n, 5n));
    expect(shift?.relativeChange.value).toEqual(rate(-1n, 5n));
  });

  it('leaves the sales lever out of the three but reaches it on the 5 percent grid', () => {
    const grid = (percent: bigint) =>
      assess(
        run.input,
        none,
        createEngineParams(),
        {},
        {
          salesMultiplier: rate(percent, 100n),
        },
      ).verdict.verdict.value;
    expect(grid(120n)).toBe('stop');
    expect(grid(125n)).not.toBe('stop');
  });

  it('agrees with the engine for each change', () => {
    for (const change of result.changes) {
      expect(verdictAfter(answers, change)).toBe(change.outcome.verdict.value);
    }
  });
});

describe('fewer than three changes', () => {
  it('fills the places with the largest drivers of the tornado when one lever mends a stop', () => {
    // A set-up cost of 17,000 is above twice the capital (2 x 8,000 = 16,000) with no outside money:
    // only the set-up costs can fall to 16,000, and exactly twice the capital is not a blocker.
    const answers = flatAnswers({
      F5: real(jodItems(['x', 17000])),
      H3: real({ values: ['self', 'family'] }),
    });
    const run = runFlat(answers);
    expect(run.verdict.verdict.value).toBe('stop');
    const result = suggestChanges(run);
    expect(summary(result)).toEqual(['setup_costs']);
    const [shift] = result.changes[0]?.shifts ?? [];
    expect(shift && minors(shift)).toEqual([17_000_000n, 16_000_000n]);
    expect(result.changes[0]?.outcome.verdict.value).toBe('go');
    // The year-1 swings of the tornado are 19,200 (price), 11,520 (sales), 7,680 (variable cost) and
    // 4,800 (fixed costs); set-up costs are not in it. Two places are left for the first two.
    expect(result.rethink.map((item) => item.lever)).toEqual(['price', 'sales']);
    expect(result.rethink.map((item) => item.rank)).toEqual([1, 2]);
    expect(result.rethink.map((item) => item.swing.value.minor)).toEqual([
      19_200_000n,
      11_520_000n,
    ]);
    expect(result.rethink[0]?.swing.source).toBe('assumption');
  });

  it('lists three rethink items and no change when nothing inside the bounds works', () => {
    // A variable cost of 30 against a price of 10: doubling the price (20) and halving the cost (15)
    // still leave a negative margin, and both together by 50 percent make 15 and 15: a margin of 0.
    const run = runFlat(
      flatAnswers({ F3: real(jodItems(['x', 30])), H3: real({ values: ['loan'] }) }),
    );
    expect(run.verdict.verdict.value).toBe('stop');
    const result = suggestChanges(run);
    expect(result.changes).toEqual([]);
    expect(result.rethink).toHaveLength(3);
    expect(result.rethink.map((item) => item.rank)).toEqual(
      [...result.rethink.map((item) => item.rank)].sort((a, b) => a - b),
    );
    expect(result.complete).toBe(true);
  });

  it('does not list a rethink item for a revise', () => {
    const run = runFlat(reviseAnswers);
    expect(suggestChanges(run).rethink).toEqual([]);
  });
});

describe('the budget of evaluations', () => {
  it('returns what it found and says so when the budget runs out', () => {
    const run = runFlat(stopAnswers);
    const result = suggestChanges(run, none, {
      changeSearchBudget: defaultFigure('test', 12),
    });
    expect(result.complete).toBe(false);
    expect(result.evaluations).toBe(12);
    expect(result.parameters.map((figure) => figure.value)).toEqual([12]);
    expect(result.changes.length).toBeLessThan(3);
  });

  it('keeps the changes found before it ran out', () => {
    const run = runFlat(stopAnswers);
    const full = suggestChanges(run);
    // The price is searched first; with a budget just above what it needs it is kept.
    const part = suggestChanges(run, none, {
      changeSearchBudget: defaultFigure('test', 30),
    });
    expect(part.complete).toBe(false);
    expect(part.changes.length).toBeGreaterThan(0);
    for (const change of part.changes) {
      expect(full.changes.map((other) => levers(other).join('+'))).toContain(
        levers(change).join('+'),
      );
    }
  });

  it('is complete with exactly the budget it needs', () => {
    const run = runFlat(stopAnswers);
    const needed = suggestChanges(run).evaluations;
    const exact = suggestChanges(run, none, {
      changeSearchBudget: defaultFigure('test', needed),
    });
    expect(exact.complete).toBe(true);
    expect(exact.evaluations).toBe(needed);
    const short = suggestChanges(run, none, {
      changeSearchBudget: defaultFigure('test', needed - 1),
    });
    expect(short.complete).toBe(false);
  });

  it('refuses a budget out of its range', () => {
    const run = runFlat(stopAnswers);
    expect(() =>
      suggestChanges(run, none, { changeSearchBudget: defaultFigure('test', 0) }),
    ).toThrow(/changes.search_budget/);
  });
});

describe('the sales lever with a late-paying customer (D-248)', () => {
  // More sales can need more working capital: with credit the variable cost is paid before the cash
  // arrives, so the verdict is not monotone in the sales. At 125 percent the project is a revise;
  // at 130 percent the funding need is above the capital by so much that it is a stop again.
  const answers = flatAnswers({
    F1: real(jod(12)),
    F3: real(jodItems(['x', 10])),
    F4: real(jodItems(['x', 500])),
    F5: real(jodItems(['x', 1000])),
    F7: real('credit'),
    F6: real({ month1: 200, month6: 200, month12: 200 }),
    A5: real({ min: 2000, max: 2000, currency: 'JOD' }),
    E7: real(5000),
    H3: real({ values: ['self'] }),
  });
  const run = runFlat(answers);
  const at = (percent: bigint): string =>
    assess(
      run.input,
      none,
      createEngineParams(),
      {},
      {
        salesMultiplier: rate(percent, 100n),
      },
    ).verdict.verdict.value;

  it('is not monotone: a larger volume is a revise and a larger one is a stop again', () => {
    expect(run.verdict.verdict.value).toBe('stop');
    expect(at(125n)).toBe('revise');
    expect(at(130n)).toBe('stop');
    expect(at(200n)).toBe('stop');
  });

  it('finds the smallest volume on the 5 percent grid that leaves the stop, by walking it', () => {
    const result = suggestChanges(run);
    const sales = result.changes.find((change) => levers(change).join('+') === 'sales');
    const [shift] = sales?.shifts ?? [];
    expect(shift?.unit).toBe('factor');
    expect(shift?.to.value).toEqual(rate(5n, 4n));
    expect(shift?.relativeChange.value).toEqual(rate(1n, 4n));
    expect(sales?.outcome.verdict.value).toBe('revise');
    expect(sales?.reachesThreshold).toBe(false);
    expect(verdictAfter(answers, must(sales))).toBe('revise');
  });
});

describe('the premium flag (D-260)', () => {
  it('is set only for a price above the largest D4 price', () => {
    // Competitors at 11 and 14.5: the price that mends the margin is 14.500, which is not above 14.500.
    const run = runFlat({ ...stopAnswers, D4: d4(11, 14.5) });
    const result = suggestChanges(run);
    const price = result.changes.find((change) => levers(change).join('+') === 'price');
    const [shift] = price?.shifts ?? [];
    expect(shift && minors(shift)).toEqual([10_000n, 14_500n]);
    expect(result.marketCeiling?.value.minor).toBe(14_500n);
    expect(price?.premium).toBe(false);
    // A competitor at 14.499 makes the same price one minor unit above the market.
    const above = suggestChanges(runFlat({ ...stopAnswers, D4: d4(11, 14.499) }));
    expect(above.changes.find((change) => levers(change).join('+') === 'price')?.premium).toBe(
      true,
    );
  });

  it('marks a pair as premium when its price is above the market', () => {
    const run = runFlat({ ...stopAnswers, D4: d4(11, 12) });
    const result = suggestChanges(run);
    const pair = result.changes.find(
      (change) => levers(change).join('+') === 'price+variable_cost',
    );
    expect(pair?.shifts[0] && minors(pair.shifts[0])).toEqual([10_000n, 12_100n]);
    expect(pair?.premium).toBe(true);
  });

  it('is never set without a known competitor price: the price then has no market bound', () => {
    const withoutD4 = without(stopAnswers, 'D4');
    const run = runFlat(withoutD4);
    const result = suggestChanges(run);
    expect(result.marketCeiling).toBeNull();
    const price = result.changes.find((change) => levers(change).join('+') === 'price');
    const [shift] = price?.shifts ?? [];
    expect(shift && minors(shift)).toEqual([10_000n, 14_500n]);
    expect(result.changes.every((change) => !change.premium)).toBe(true);
  });
});

describe('confidence and the go line', () => {
  const low = flatProvenance({ F1: 'low', F3: 'low', F5: 'low' });

  it('says that no change lifts a revise held back by low confidence', () => {
    const run = runFlat(flatAnswers({ F1: real(jod(8)) }), low);
    expect(run.verdict.verdict.value).toBe('revise');
    expect(run.verdict.holdBacks).toContain('confidence_low');
    const result = suggestChanges(run);
    expect(result.status).toBe('suggested');
    expect(result.goBlockedBy).toBe('confidence_low');
    expect(result.changes).toEqual([]);
    expect(result.rethink).toEqual([]);
    expect(result.evaluations).toBe(0);
  });

  it('reports only a change that leaves the stop, never one that reaches go, with low confidence', () => {
    const run = runFlat(stopAnswers, low);
    expect(run.verdict.verdict.value).toBe('stop');
    const result = suggestChanges(run);
    expect(result.goBlockedBy).toBeNull();
    expect(result.changes).toHaveLength(3);
    for (const change of result.changes) {
      expect(change.reachesThreshold).toBe(false);
      expect(change.outcome.verdict.value).toBe('revise');
    }
    // The smallest change that only removes the blocker: the margin must be positive and the project
    // must break even, which is a variable cost of 7.500 as in the plain vector.
    const [shift] = result.changes[0]?.shifts ?? [];
    expect(shift && minors(shift)).toEqual([12_000n, 7_500n]);
  });
});

describe('purity', () => {
  it('gives deeply equal results twice and does not touch the run', () => {
    const run = runFlat(stopAnswers);
    const before = serialiseRun(run);
    const first = suggestChanges(run);
    const second = suggestChanges(run);
    expect(second).toEqual(first);
    expect(serialiseRun(run)).toBe(before);
  });

  it('does not write to a deeply frozen run', () => {
    const run = runFlat(reviseAnswers);
    const freeze = (value: unknown): void => {
      if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
      Object.freeze(value);
      for (const inner of Object.values(value)) freeze(inner);
    };
    freeze(run);
    expect(suggestChanges(run).changes).toHaveLength(3);
  });

  it('uses the tax context and the pricing options it is given', () => {
    const run = runFlat(reviseAnswers);
    const result = suggestChanges(run, none, {}, { premiumAllowed: true });
    expect(result.status).toBe('suggested');
  });
});

describe('vector E: the sales reach the go line', () => {
  // Price 8, variable cost 4, 100 units a month and fixed costs of 300 earn 100 a month; set-up costs of
  // 9,000 against a capital of 1,500 and a loan. Six criteria pass (6 of 10): the funding need, the
  // set-up costs, the conservative scenario (60 x 3.6 - 300 = -84) and the payback (90 months) fail.
  const answers = flatAnswers({
    F1: real(jod(8)),
    F4: real(jodItems(['x', 300])),
    F5: real(jodItems(['x', 9000])),
    F6: real({ month1: 100, month6: 100, month12: 100 }),
    A5: real({ min: 1500, max: 1500, currency: 'JOD' }),
    H3: real({ values: ['loan'] }),
  });
  const run = runFlat(answers);
  const result = suggestChanges(run);

  it('starts from a revise at 6 of 10', () => {
    expect(run.verdict.verdict.value).toBe('revise');
    expect(run.feasibility.passed).toBe(6);
  });

  it('needs two criteria to pass at once: the conservative scenario and the payback', () => {
    // Price: 60 x (P - 4.4) - 300 >= 0 gives 9.4, but the payback of 9,000 within 36 months needs a
    // monthly profit of 250, 100 x (P - 4) - 300 >= 250, so 9.5. Variable cost: 60 x (8 - 1.1 VC) >= 300
    // gives 2.727 and 100 x (8 - VC) - 300 >= 250 gives 2.5. Sales: 4 x units - 300 >= 250 needs 137.5 units,
    // so 140 on the 5 percent grid (135 units earn 240 and take 37.5 months).
    expect(summary(result)).toEqual(['price', 'variable_cost', 'sales']);
    expect(result.changes.map((change) => change.shifts.map(minors))).toEqual([
      [[8_000n, 9_500n]],
      [[4_000n, 2_500n]],
      [[0n, 0n]],
    ]);
    const [shift] = result.changes[2]?.shifts ?? [];
    expect(shift?.to.value).toEqual(rate(7n, 5n));
    for (const change of result.changes) {
      expect(change.outcome.passed).toBe(8);
      expect(change.reachesThreshold).toBe(true);
      expect(verdictAfter(answers, change)).toBe('go');
    }
  });
});

describe('a stop that the set-up costs only half mend', () => {
  // Price 8, variable cost 4, 100 units and fixed costs of 300 earn 100 a month. Set-up costs of 17,000
  // are above twice the capital of 8,000 with no outside money: a blocker. 16,000 removes it but the
  // project stays at 6 of 10 (the payback is 160 months); no set-up cost within the bound reaches go.
  const answers = flatAnswers({
    F1: real(jod(8)),
    F4: real(jodItems(['x', 300])),
    F5: real(jodItems(['x', 17000])),
    F6: real({ month1: 100, month6: 100, month12: 100 }),
  });
  const run = runFlat(answers);
  const result = suggestChanges(run);

  it('reports the smallest change that leaves the stop when go is out of reach', () => {
    expect(run.verdict.verdict.value).toBe('stop');
    const [setup] = result.changes;
    expect(setup?.shifts.map(minors)).toEqual([[17_000_000n, 16_000_000n]]);
    expect(setup?.reachesThreshold).toBe(false);
    expect(setup?.outcome.verdict.value).toBe('revise');
    expect(setup?.outcome.passed).toBe(6);
  });

  it('makes up the three with pairs that reach go', () => {
    // Price and set-up costs by 30 percent: 10.400 earns 100 x 6.4 - 300 = 340 a month and 11,900 is
    // paid back in 35 months; at 29 percent 12,070 would take 36.4. Variable cost with set-up costs needs 43.
    expect(summary(result)).toEqual([
      'setup_costs',
      'price+setup_costs',
      'variable_cost+setup_costs',
    ]);
    expect(result.changes[1]?.shifts.map(minors)).toEqual([
      [8_000n, 10_400n],
      [17_000_000n, 11_900_000n],
    ]);
    expect(result.changes[2]?.shifts.map(minors)).toEqual([
      [4_000n, 2_280n],
      [17_000_000n, 9_690_000n],
    ]);
    for (const change of result.changes.slice(1)) {
      expect(change.reachesThreshold).toBe(true);
      expect(verdictAfter(answers, change)).toBe('go');
    }
    expect(result.rethink).toEqual([]);
  });
});

describe('tiny changes', () => {
  it('rounds the fixed cost to a tenth of a percent and leaves the sales grid out of reach', () => {
    // Fixed costs of 1,205 against 400 x 3 = 1,200: the price needs 10.0125 (10.013), the variable cost
    // 6.9875 (6.987) and the fixed costs a factor of 0.99585, which is 99.5 percent on a tenth of a percent.
    // The three are under 1 percent, and the first rung of the sales grid is 5 percent: not searched.
    const answers = flatAnswers({
      F3: real(jodItems(['x', 7])),
      F4: real(jodItems(['x', 1205])),
    });
    const result = suggestChanges(runFlat(answers));
    expect(summary(result)).toEqual(['price', 'variable_cost', 'fixed_costs']);
    expect(result.changes[0]?.shifts.map(minors)).toEqual([[10_000n, 10_013n]]);
    expect(result.changes[1]?.shifts.map(minors)).toEqual([[7_000n, 6_987n]]);
    expect(result.changes[2]?.shifts[0]?.to.value).toEqual(rate(199n, 200n));
    for (const change of result.changes) {
      expect(verdictAfter(answers, change)).toBe(change.outcome.verdict.value);
    }
  });

  it('puts a price before a variable cost when their efforts are equal', () => {
    // A margin of zero (price = variable cost = 10) needs 2.5 more: the price to 12.500 or the variable
    // cost to 7.500 is 25 percent either way.
    const answers = flatAnswers({
      F3: real(jodItems(['x', 10])),
      H3: real({ values: ['loan'] }),
    });
    const result = suggestChanges(runFlat(answers));
    expect(summary(result).slice(0, 2)).toEqual(['price', 'variable_cost']);
    expect(result.changes[0]?.effort.value).toEqual(rate(1n, 4n));
    expect(result.changes[1]?.effort.value).toEqual(rate(1n, 4n));
  });
});

describe('levers a project does not have', () => {
  it('has no fixed-cost lever without fixed costs: a positive margin is all it needs', () => {
    const answers = flatAnswers({
      F3: real(jodItems(['x', 12])),
      F4: real(jodItems(['x', 0])),
      H3: real({ values: ['loan'] }),
    });
    const result = suggestChanges(runFlat(answers));
    expect(summary(result)).toEqual(['variable_cost', 'price+variable_cost', 'price']);
    expect(result.changes[0]?.shifts.map(minors)).toEqual([[12_000n, 9_999n]]);
    expect(result.changes[2]?.shifts.map(minors)).toEqual([[10_000n, 12_001n]]);
  });

  it('has no sales lever without sales: nothing mends a project that sells nothing', () => {
    const run = runFlat(flatAnswers({ F6: real({ month1: 0, month6: 0, month12: 0 }) }));
    expect(run.verdict.verdict.value).toBe('stop');
    const result = suggestChanges(run);
    expect(result.changes).toEqual([]);
    expect(result.rethink.map((item) => item.lever)).toEqual(['fixed_costs']);
    expect(result.rethink.map((item) => item.rank)).toEqual([1]);
  });

  it('has no set-up lever without set-up costs', () => {
    const withoutSetup = without(
      flatAnswers({
        F3: real(jodItems(['x', 12])),
        H3: real({ values: ['loan'] }),
      }),
      'F5',
    );
    const result = suggestChanges(runFlat(withoutSetup));
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.every((change) => !levers(change).includes('setup_costs'))).toBe(true);
  });
});

describe('the sales walk with low confidence', () => {
  // 100 units at a margin of 5 earn 500 a month against fixed costs of 1,000: the price needs 15
  // (+50 percent), the fixed costs half (1,000 to 500, a profit of 0) and the sales double (200 units earn
  // 1,000). The variable cost would have to reach 0, below its bound of half. With low confidence go cannot
  // be reached, so the walk stops at the first volume that leaves the stop.
  const answers = flatAnswers({
    F1: real(jod(10)),
    F3: real(jodItems(['x', 5])),
    F4: real(jodItems(['x', 1000])),
    F5: real(jodItems(['x', 1000])),
    F6: real({ month1: 100, month6: 100, month12: 100 }),
    A5: real({ min: 3000, max: 3000, currency: 'JOD' }),
    E7: real(5000),
  });

  it('reports the sales that only remove the blocker', () => {
    const low = flatProvenance({ F1: 'low', F3: 'low', F5: 'low' });
    const run = runFlat(answers, low);
    expect(run.verdict.verdict.value).toBe('stop');
    const result = suggestChanges(run);
    expect(summary(result)).toEqual(['price', 'fixed_costs', 'sales']);
    const sales = result.changes[2];
    expect(sales?.shifts[0]?.to.value).toEqual(rate(2n, 1n));
    expect(sales?.reachesThreshold).toBe(false);
    expect(sales?.outcome.verdict.value).toBe('revise');
    expect(verdictAfter(answers, must(sales), low)).toBe('revise');
  });
});

describe('errors', () => {
  it('lets an error of the pipeline through instead of calling it a spent budget', () => {
    const run = runFlat(stopAnswers);
    const broken = {
      get premiumAllowed(): boolean {
        throw new Error('boom');
      },
    };
    expect(() => suggestChanges(run, none, {}, broken)).toThrow('boom');
  });
});
