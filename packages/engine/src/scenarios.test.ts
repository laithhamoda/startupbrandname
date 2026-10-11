import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { defaultFigure } from './figure';
import { engineInputFrom, type EngineInput, type ProjectContext } from './input';
import { makeMoney } from './money';
import { createEngineParams, DEFAULT_ENGINE_PARAMS } from './params';
import { makeRate, ONE_RATE, parseRate } from './rate';
import { scenarioAnalysis, T10_RULES, tornadoAnalysis, type ScenarioResult } from './scenarios';
import type { TaxRule } from './tax';

const project: ProjectContext = {
  country: 'JO',
  currency: 'JOD',
  mode: 'full',
  referenceDate: '2026-10-05',
};
const real = (value: unknown) => ({ status: 'answered' as const, value });
const items = (label: string, amount: number) => ({
  items: [{ label, amount, currency: 'JOD' }],
});
const jod = (units: number) => makeMoney(BigInt(units) * 1000n, 'JOD');

/**
 * The hand-checked vector of T10 (D-217, D-218): a flat curve of 400 units in months 1, 6 and 12,
 * a price of 10, a variable cost of 4 and fixed costs of 1,000 a month, with no payroll, marketing,
 * seasonality, inflation or tax, and set-up costs of 6,000.
 */
const flat = (more: Answers = {}): Answers => ({
  F1: real({ amount: 10, currency: 'JOD' }),
  F3: real(items('Materials', 4)),
  F4: real(items('Rent', 1000)),
  F5: real(items('Set-up', 6000)),
  F6: real({ month1: 400, month6: 400, month12: 400 }),
  ...more,
});

function inputOf(answers: Answers): EngineInput {
  const result = engineInputFrom(answers, {}, project);
  if (result.status !== 'ok') throw new Error(JSON.stringify(result.reasons));
  return result.input;
}

describe('the scenarios of the flat vector', () => {
  const input = inputOf(flat());
  const { conservative, base, optimistic } = scenarioAnalysis(input);

  // Base: revenue 400 x 10 = 4,000, COGS 400 x 4 = 1,600, fixed 1,000: 1,400 a month, 16,800 in year 1.
  it('the base scenario is the founder own numbers: 1,400 a month, 16,800 in year 1, break-even in month 1', () => {
    expect(base.kind).toBe('base');
    expect(base.salesMultiplier).toEqual(ONE_RATE);
    expect(base.vcMultiplier).toEqual(ONE_RATE);
    expect(base.launchDelayMonths).toBe(0);
    expect(base.firstYearOperatingProfit.value).toEqual(jod(16_800));
    expect(base.breakEvenMonth.value).toBe(1);
  });

  // Conservative: months 1 to 3 sell nothing and lose the 1,000 of fixed costs each; months 4 to 12
  // sell 400 x 0.6 = 240 units at a VC of 4 x 1.1 = 4.4: revenue 2,400, COGS 1,056, profit
  // 2,400 - 1,056 - 1,000 = 344. Year 1 = -3,000 + 9 x 344 = 96. Break-even in month 4.
  it('the conservative scenario delays the launch by 3 months and sells 0.6 at a VC of 1.1', () => {
    expect(conservative.kind).toBe('conservative');
    expect(conservative.salesMultiplier).toEqual(parseRate('0.6'));
    expect(conservative.vcMultiplier).toEqual(parseRate('1.1'));
    expect(conservative.launchDelayMonths).toBe(3);
    expect(conservative.firstYearOperatingProfit.value).toEqual(jod(96));
    expect(conservative.breakEvenMonth.value).toBe(4);
  });

  it('is the delay that costs the conservative scenario its first three months: without it year 1 is 4,128', () => {
    const noDelay = scenarioAnalysis(
      input,
      { rules: [] },
      createEngineParams({ conservativeLaunchDelayMonths: defaultFigure('d', 0) }),
    );
    expect(noDelay.conservative.firstYearOperatingProfit.value).toEqual(jod(4_128));
    expect(noDelay.conservative.breakEvenMonth.value).toBe(1);
  });

  // Optimistic: 400 x 1.3 = 520 units at a VC of 4 x 0.95 = 3.8: revenue 5,200, COGS 1,976, profit
  // 5,200 - 1,976 - 1,000 = 2,224 a month, 26,688 in year 1, break-even in month 1.
  it('the optimistic scenario sells 1.3 at a VC of 0.95 with no delay', () => {
    expect(optimistic.kind).toBe('optimistic');
    expect(optimistic.salesMultiplier).toEqual(parseRate('1.3'));
    expect(optimistic.vcMultiplier).toEqual(parseRate('0.95'));
    expect(optimistic.launchDelayMonths).toBe(0);
    expect(optimistic.firstYearOperatingProfit.value).toEqual(jod(26_688));
    expect(optimistic.breakEvenMonth.value).toBe(1);
  });

  // The cash flow starts at minus the 6,000 of set-up costs. The base earns 1,400 a month, so the
  // lowest point is month 0: 6,000. The conservative scenario also loses 3 x 1,000 before it sells:
  // 9,000. The optimistic one earns 2,224 a month: 6,000.
  it('reruns the cash flow: the funding need of each scenario', () => {
    const need = (scenario: ScenarioResult) =>
      scenario.funding.status === 'ok' ? scenario.funding.need.value : null;
    expect(need(base)).toEqual(jod(6_000));
    expect(need(conservative)).toEqual(jod(9_000));
    expect(need(optimistic)).toEqual(jod(6_000));
  });

  it('lists the parameters a scenario used among the inputs of its figures, as assumptions', () => {
    const used = (scenario: ScenarioResult) => scenario.firstYearOperatingProfit.inputs;
    expect(used(conservative)).toEqual(
      expect.arrayContaining([
        { kind: 'default', id: 'scenario.conservative.sales_factor' },
        { kind: 'default', id: 'scenario.conservative.vc_factor' },
        { kind: 'default', id: 'scenario.conservative.launch_delay_months' },
        { kind: 'rule', id: T10_RULES.scenario },
      ]),
    );
    expect(used(optimistic)).toEqual(
      expect.arrayContaining([
        { kind: 'default', id: 'scenario.optimistic.sales_factor' },
        { kind: 'default', id: 'scenario.optimistic.vc_factor' },
      ]),
    );
    expect(used(optimistic)).not.toContainEqual({
      kind: 'default',
      id: 'scenario.conservative.sales_factor',
    });
    expect(conservative.breakEvenMonth.source).toBe('assumption');
    expect(conservative.breakEvenMonth.validated).toBe(false);
    expect(conservative.funding.status === 'ok' && conservative.funding.need.source).toBe(
      'assumption',
    );
  });

  it('takes the multipliers and the delay from the engine parameters', () => {
    const params = createEngineParams({
      conservativeSalesFactor: defaultFigure('s', makeRate(1n, 2n)),
      conservativeVcFactor: defaultFigure('v', makeRate(5n, 4n)),
      conservativeLaunchDelayMonths: defaultFigure('d', 1),
    });
    const changed = scenarioAnalysis(input, { rules: [] }, params).conservative;
    // Months 2 to 12: 200 units, VC 5: 2,000 - 1,000 - 1,000 = 0; month 1 loses 1,000.
    expect(changed.firstYearOperatingProfit.value).toEqual(jod(-1_000));
    expect(changed.breakEvenMonth.value).toBe(2);
  });
});

describe('the scenarios with a tax, a missing F5 and a capacity', () => {
  it('runs the tax of the context again in every scenario', () => {
    // 10% of turnover, paid in month 1 of the following year. At 40 units the base earns
    // 400 - 160 - 1,000 = -760 a month, so the cash falls to -20,000 - 36 x 760 = -47,360 in
    // month 36; the taxes of years 1 and 2 (10% of 4,800 = 480 each, paid in months 13 and 25)
    // deepen it to -48,320. The tax of year 3 falls after the horizon (D-212).
    const rule: TaxRule = {
      id: 'fixture.jo.sole.turnover',
      countryCode: 'JO',
      legalForm: 'sole',
      regime: 'fixture_regime',
      levy: 'fixture_levy',
      kind: 'tax',
      basis: 'turnover',
      rate: makeRate(1n, 10n),
      brackets: [],
      fixedAmount: null,
      minimum: null,
      turnoverCeiling: null,
      paymentMonth: 1,
      currency: 'JOD',
      effectiveFrom: '2020-01-01',
      sourceUrl: 'https://example.invalid/fixture',
      lastVerified: null,
      status: 'unverified',
    };
    const input = inputOf(
      flat({
        F5: real(items('Set-up', 20_000)),
        F6: real({ month1: 40, month6: 40, month12: 40 }),
      }),
    );
    const without = scenarioAnalysis(input);
    const taxed = scenarioAnalysis(input, { rules: [rule] });
    const need = (scenario: ScenarioResult) =>
      scenario.funding.status === 'ok' ? scenario.funding.need.value : null;
    expect(need(without.base)).toEqual(jod(47_360));
    expect(need(taxed.base)).toEqual(jod(48_320));
    // The operating profit is before tax: the same with or without it.
    expect(taxed.base.firstYearOperatingProfit.value).toEqual(
      without.base.firstYearOperatingProfit.value,
    );
  });

  it('has no funding need, with the F5 reason, when the set-up costs are unknown or missing', () => {
    const withoutF5 = Object.fromEntries(
      Object.entries(flat()).filter(([id]) => id !== 'F5'),
    ) as Answers;
    const missing = scenarioAnalysis(inputOf(withoutF5));
    for (const scenario of [missing.conservative, missing.base, missing.optimistic]) {
      expect(scenario.funding).toEqual({
        status: 'not_calculable',
        reason: { code: 'setup_costs_unset', questionId: 'F5', state: 'missing' },
      });
    }
    // The break-even and the profit do not need F5.
    expect(missing.base.breakEvenMonth.value).toBe(1);
    expect(missing.base.firstYearOperatingProfit.value).toEqual(jod(16_800));
    const unknown = scenarioAnalysis(inputOf({ ...withoutF5, F5: { status: 'unknown' } }));
    expect(unknown.base.funding).toEqual({
      status: 'not_calculable',
      reason: { code: 'setup_costs_unset', questionId: 'F5', state: 'unknown' },
    });
  });

  it('still cuts the optimistic units to the capacity E7', () => {
    // 400 x 1.3 = 520 units, but only 450 can be served. At a VC of 3.8: 450 x (10 - 3.8) = 2,790,
    // minus 1,000 = 1,790 a month, 21,480 in year 1.
    const capped = scenarioAnalysis(inputOf(flat({ E7: real(450) }))).optimistic;
    expect(capped.firstYearOperatingProfit.value).toEqual(jod(21_480));
  });

  it('shows no break-even month when no month of the horizon reaches a profit', () => {
    const none = scenarioAnalysis(
      inputOf(flat({ F6: real({ month1: 10, month6: 10, month12: 10 }) })),
    );
    expect(none.base.breakEvenMonth.value).toBeNull();
    expect(none.optimistic.breakEvenMonth.value).toBeNull();
  });
});

describe('the tornado of the flat vector', () => {
  const tornado = tornadoAnalysis(inputOf(flat()));
  const row = (variable: string) => {
    const found = tornado.rows.find((candidate) => candidate.variable === variable);
    if (found === undefined) throw new Error(`no row for ${variable}`);
    return found;
  };

  // Each variable alone, 20% down and up, year 1 (12 months):
  // price 8 and 12: (3,200 - 1,600 - 1,000) x 12 = 7,200 and (4,800 - 1,600 - 1,000) x 12 = 26,400.
  // sales 320 and 480 units: (3,200 - 1,280 - 1,000) x 12 = 11,040 and (4,800 - 1,920 - 1,000) x 12... no:
  // revenue 3,200, COGS 1,280: 920 x 12 = 11,040; revenue 4,800, COGS 1,920: 1,880 x 12 = 22,560.
  // VC 3.2 and 4.8: (4,000 - 1,280 - 1,000) x 12 = 20,640 and (4,000 - 1,920 - 1,000) x 12 = 12,960.
  // fixed 800 and 1,200: (2,400 - 800) x 12 = 19,200 and (2,400 - 1,200) x 12 = 14,400.
  it('has the year-1 profit at minus 20 and plus 20 percent of each variable', () => {
    const profits = (variable: string) => [row(variable).atLow.value, row(variable).atHigh.value];
    expect(profits('price')).toEqual([jod(7_200), jod(26_400)]);
    expect(profits('sales')).toEqual([jod(11_040), jod(22_560)]);
    expect(profits('vc')).toEqual([jod(20_640), jod(12_960)]);
    expect(profits('fixed_costs')).toEqual([jod(19_200), jod(14_400)]);
  });

  it('measures the swing as the absolute difference: 19,200, 11,520, 7,680 and 4,800', () => {
    expect(row('price').swing.value).toEqual(jod(19_200));
    expect(row('sales').swing.value).toEqual(jod(11_520));
    expect(row('vc').swing.value).toEqual(jod(7_680));
    expect(row('fixed_costs').swing.value).toEqual(jod(4_800));
  });

  it('ranks them widest first: price, sales, VC, fixed costs; the top is the price', () => {
    expect(tornado.rows.map((candidate) => candidate.variable)).toEqual([
      'price',
      'sales',
      'vc',
      'fixed_costs',
    ]);
    expect(tornado.top?.value).toBe('price');
    expect(tornado.change.value).toEqual(parseRate('0.2'));
    expect(tornado.change.inputs).toEqual([{ kind: 'default', id: 'scenario.tornado_swing' }]);
  });

  it('lists the swing parameter and the rule among the inputs of every figure', () => {
    for (const candidate of tornado.rows) {
      for (const figure of [candidate.atLow, candidate.atHigh, candidate.swing]) {
        expect(figure.inputs).toEqual(
          expect.arrayContaining([
            { kind: 'default', id: 'scenario.tornado_swing' },
            { kind: 'rule', id: T10_RULES.tornado },
          ]),
        );
        expect(figure.source).toBe('assumption');
      }
    }
    expect(tornado.top?.inputs).toContainEqual({ kind: 'rule', id: T10_RULES.tornado });
  });

  it('follows the swing parameter', () => {
    const wide = tornadoAnalysis(
      inputOf(flat()),
      createEngineParams({ tornadoSwing: defaultFigure('t', makeRate(1n, 2n)) }),
    );
    // Price at half and one and a half: (2,000 - 1,600 - 1,000) x 12 = -7,200 and
    // (6,000 - 1,600 - 1,000) x 12 = 40,800.
    expect(wide.rows[0]?.atLow.value).toEqual(jod(-7_200));
    expect(wide.rows[0]?.atHigh.value).toEqual(jod(40_800));
    expect(wide.rows[0]?.swing.value).toEqual(jod(48_000));
  });
});

describe('the tornado ties and edge cases', () => {
  it('keeps the order price, VC, sales, fixed costs for equal swings', () => {
    // With no variable cost the price and the sales move the profit by the same 19,200, the fixed
    // cost by 4,800 and the variable cost not at all.
    const free = tornadoAnalysis(inputOf(flat({ F3: real(items('Free', 0)) })));
    expect(free.rows.map((candidate) => [candidate.variable, candidate.swing.value.minor])).toEqual(
      [
        ['price', 19_200_000n],
        ['sales', 19_200_000n],
        ['fixed_costs', 4_800_000n],
        ['vc', 0n],
      ],
    );
    expect(free.top?.value).toBe('price');
  });

  it('ranks price before VC when a price equal to the VC makes their swings equal', () => {
    // Price = VC = 4: the margin is zero, so the sales move nothing; price and VC each move 12 x 0.4 x 1,600.
    const tied = tornadoAnalysis(inputOf(flat({ F1: real({ amount: 4, currency: 'JOD' }) })));
    expect(tied.rows.map((candidate) => candidate.variable)).toEqual([
      'price',
      'vc',
      'fixed_costs',
      'sales',
    ]);
    expect(tied.rows[0]?.swing.value).toEqual(jod(7_680));
    expect(tied.rows[1]?.swing.value).toEqual(jod(7_680));
  });

  it('has no top variable when nothing moves the profit', () => {
    const idle = tornadoAnalysis(
      inputOf(
        flat({
          F4: real(items('None', 0)),
          F6: real({ month1: 0, month6: 0, month12: 0 }),
        }),
      ),
    );
    expect(idle.rows.every((candidate) => candidate.swing.value.minor === 0n)).toBe(true);
    expect(idle.top).toBeNull();
    expect(idle.rows.map((candidate) => candidate.variable)).toEqual([
      'price',
      'vc',
      'sales',
      'fixed_costs',
    ]);
  });

  it('is deterministic', () => {
    const input = inputOf(flat());
    expect(tornadoAnalysis(input)).toEqual(tornadoAnalysis(input));
    expect(scenarioAnalysis(input)).toEqual(scenarioAnalysis(input));
    expect(tornadoAnalysis(input, DEFAULT_ENGINE_PARAMS).rows).toHaveLength(4);
  });
});
