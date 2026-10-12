import { describe, expect, it } from 'vitest';
import { assess } from './assessment';
import { flatAnswers, flatProvenance, jodItems, real, runFlat } from './flat-vector';
import { createEngineParams } from './params';
import { makeRate } from './rate';
import { conservativeScenario, scenarioAnalysis } from './scenarios';

const params = createEngineParams();
const none = { rules: [] };
const jod = (units: number) => BigInt(units) * 1000n;

/*
 * The shared pipeline of the verdict (D-228): on the founder's own numbers it is what `runEngine`
 * reports, and with adjustments it is the same code judging a project with a change.
 */
describe('assess on the founder own numbers', () => {
  const run = runFlat();

  it('gives the pieces of the verdict that runEngine reports', () => {
    const judged = assess(run.input, none, params);
    expect(judged.projection).toEqual(run.projection);
    expect(judged.economics.unitEconomics).toEqual(run.unitEconomics);
    expect(judged.economics.pricing).toEqual(run.pricing);
    expect(judged.tax).toEqual(run.cash.tax);
    expect(judged.cashFlow).toEqual(run.cash.cashFlow);
    expect(judged.feasibility).toEqual(run.feasibility);
    expect(judged.confidence).toEqual(run.confidence);
    expect(judged.blockers).toEqual(run.verdict.blockers);
    expect(judged.verdict).toEqual(run.verdict);
  });

  it('takes the conservative scenario of the caller when it has one', () => {
    const conservative = scenarioAnalysis(run.input, none, params).conservative;
    expect(assess(run.input, none, params, {}, {}, conservative)).toEqual(
      assess(run.input, none, params),
    );
  });
});

/*
 * The conservative scenario on top of a change already made (D-228): months 1 to 3 sell nothing,
 * then 400 x 0.6 = 240 units a month at a variable cost of 4 x 1.1 = 4.4, so a month earns
 * 240 x 5.6 - 1,000 = 344 and the first year 9 x 344 - 3,000 = 96.
 */
describe('the conservative scenario with a base change', () => {
  const { input } = runFlat();
  const firstYear = (base: Parameters<typeof conservativeScenario>[3]) =>
    conservativeScenario(input, none, params, base).firstYearOperatingProfit.value.minor;

  it('is the scenario of scenarioAnalysis without a base', () => {
    expect(conservativeScenario(input, none, params, {})).toEqual(
      scenarioAnalysis(input, none, params).conservative,
    );
    expect(firstYear({})).toBe(jod(96));
  });

  it('multiplies the sales factor by the sales of the base: 480 units earn 480 x 5.6 - 1,000 = 1,688', () => {
    // -3,000 for the three empty months, then 9 x 1,688.
    expect(firstYear({ salesMultiplier: makeRate(2n, 1n) })).toBe(jod(12_192));
  });

  it('applies the fixed-cost multiplier of the base: 240 x 5.6 - 500 = 844 a month', () => {
    // -3 x 500 + 9 x 844.
    expect(firstYear({ fixedCostMultiplier: makeRate(1n, 2n) })).toBe(jod(6_096));
  });

  it('multiplies the variable-cost factor of the base: 4 x 0.55 = 2.2 a unit, 240 x 7.8 - 1,000 = 872', () => {
    // -3,000 + 9 x 872.
    expect(firstYear({ cogsMultiplier: makeRate(1n, 2n) })).toBe(jod(4_848));
  });

  it('adds the launch delay of the base to the scenario: four empty months, then 344 a month', () => {
    // -4 x 1,000 + 8 x 344.
    expect(firstYear({ launchDelayMonths: 1 })).toBe(jod(-1_248));
  });
});

describe('assess with an adjustment', () => {
  it('judges more sales and lower fixed costs by the same rules: the conservative break-even moves', () => {
    // Set-up 9,000 and a price of 8 (the borderline case): the conservative scenario loses 136 a
    // month. With twice the sales it earns 480 x 3.6 - 1,000 = 728, so it breaks even in month 4.
    const answers = flatAnswers({
      F1: real({ amount: 8, currency: 'JOD' }),
      F5: real(jodItems(['تأسيس', 9000])),
    });
    const { input } = runFlat(answers, flatProvenance());
    const before = assess(input, none, params);
    const after = assess(input, none, params, {}, { salesMultiplier: makeRate(2n, 1n) });
    const conservative = (judged: typeof before) =>
      judged.feasibility.criteria.find((criterion) => criterion.id === 'conservative_break_even')
        ?.status;
    expect(conservative(before)).toBe('fail');
    expect(conservative(after)).toBe('pass');
  });
});
