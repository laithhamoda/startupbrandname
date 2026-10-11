import type { Answers } from '@sbn/question-bank';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeFigure } from './figure';
import {
  engineInputFrom,
  type EngineInput,
  type ProjectContext,
  type ProvenanceBySteps,
} from './input';
import { makeMoney, moneyToMajorString, type Money } from './money';
import { createEngineParams, DEFAULT_ENGINE_PARAMS, type EngineParams } from './params';
import { makeRate, ONE_RATE, parseRate, ZERO_RATE } from './rate';
import { projectOperatingLines, T9_RULES, type ProjectionLine } from './projection';

const project: ProjectContext = {
  country: 'JO',
  currency: 'JOD',
  mode: 'full',
  referenceDate: '2026-10-05',
};

const jod = (amount: number) => ({ amount, currency: 'JOD' });
const items = (...rows: [string, number][]) => ({
  items: rows.map(([label, amount]) => ({ label, amount, currency: 'JOD' })),
});
const real = (value: unknown) => ({ status: 'answered' as const, value });
const UNKNOWN = { status: 'unknown' as const };
const fils = (amount: bigint) => makeMoney(amount, 'JOD');

/** Price 25, variable cost 10.5, fixed cost 320.5 a month (all JOD); sales as given. */
const answersFor = (
  month1: number,
  month6: number,
  month12: number,
  more: Answers = {},
): Answers => ({
  F1: real(jod(25)),
  F3: real(items(['Parts', 8], ['Delivery', 2.5])),
  F4: real(items(['Rent', 300], ['Internet', 20.5])),
  F6: real({ month1, month6, month12 }),
  ...more,
});

const userHigh = { source: 'user', confidence: 'high', validated: true } as const;
const everythingUser: ProvenanceBySteps = Object.fromEntries(
  ['F1', 'F3', 'F4', 'F4.1', 'F6', 'F6.2', 'D7', 'E7', 'E8', 'D4'].map((id) => [id, userHigh]),
);

function inputOf(answers: Answers, provenance: ProvenanceBySteps = everythingUser): EngineInput {
  const result = engineInputFrom(answers, provenance, project);
  if (result.status !== 'ok') throw new Error(`not calculable: ${JSON.stringify(result.reasons)}`);
  return result.input;
}

function run(answers: Answers, params?: EngineParams, provenance?: ProvenanceBySteps) {
  return projectOperatingLines(inputOf(answers, provenance), params);
}

const asNumbers = (units: readonly bigint[]) => units.map(Number);
const minors = (line: ProjectionLine<Money>) => line.monthly.map((amount) => amount.minor);

// Hand-checked units. Month 1 is November 2026 (the reference date is 2026-10-05).
const Y1_10_40_100 = [10, 13, 17, 23, 30, 40, 47, 54, 63, 74, 86, 100];

describe('the calendar of the projection', () => {
  it('has 36 months in 20 columns by default and starts the month after the reference date', () => {
    const projection = run(answersFor(10, 40, 100));
    expect(projection.calendar.months).toHaveLength(36);
    expect(projection.calendar.periods).toHaveLength(20);
    expect(projection.calendar.months[0]?.calendar).toEqual({ year: 2026, month: 11 });
    expect(projection.units.monthly).toHaveLength(36);
    expect(projection.units.byPeriod).toHaveLength(20);
    expect(projection.revenue.byPeriod).toHaveLength(20);
  });

  it('follows the horizon parameter', () => {
    const params = createEngineParams({
      horizonMonths: makeFigure(12, {
        source: 'user',
        confidence: 'high',
        validated: true,
        inputs: [],
      }),
    });
    const projection = run(answersFor(10, 40, 100), params);
    expect(projection.calendar.periods).toHaveLength(12);
    expect(asNumbers(projection.units.monthly)).toEqual(Y1_10_40_100);
    expect(projection.yearlyGrowth).toBeNull();
    expect(projection.notes.some((note) => note.code === 'inflation_not_applied')).toBe(false);
  });
});

describe('F6 of 10, 40 and 100 units with no seasonality and a founder growth of 20%', () => {
  const projection = run(answersFor(10, 40, 100, { 'F6.2': real(20) }));

  it('passes through the three points with constant monthly growth between them', () => {
    // 10 * 4^((m-1)/5) up to month 6 and 40 * 2.5^((m-6)/6) up to month 12, rounded half away from zero.
    expect(asNumbers(projection.units.monthly.slice(0, 12))).toEqual(Y1_10_40_100);
  });

  it('grows 20% a year from the month-12 level, applied month by month', () => {
    // 100 * 1.2^(j/12) = 101.5, 103.1, 104.7, ..., 120; then 120 * 1.2^(j/12) up to 144.
    expect(asNumbers(projection.units.monthly.slice(12, 24))).toEqual([
      102, 103, 105, 106, 108, 110, 111, 113, 115, 116, 118, 120,
    ]);
    expect(asNumbers(projection.units.monthly.slice(24))).toEqual([
      122, 124, 126, 128, 129, 131, 133, 136, 138, 140, 142, 144,
    ]);
    expect(projection.yearlyGrowth?.value).toEqual([parseRate('0.2'), parseRate('0.2')]);
  });

  it('prices every unit at 25 JOD and costs it at 10.5 JOD', () => {
    // Month 1: 10 units. Revenue 10 * 25.000 = 250.000; COGS 10 * 10.500 = 105.000; gross profit 145.000.
    expect(projection.revenue.monthly[0]).toEqual(fils(250000n));
    expect(projection.cogs.monthly[0]).toEqual(fils(105000n));
    expect(projection.grossProfit.monthly[0]).toEqual(fils(145000n));
    // Operating costs are the fixed 320.500 only: no staff, and marketing unknown counts as 0.
    expect(projection.fixedCosts.monthly[0]).toEqual(fils(320500n));
    expect(projection.payroll.monthly[0]).toEqual(fils(0n));
    expect(projection.marketing.monthly[0]).toEqual(fils(0n));
    expect(projection.operatingCosts.monthly[0]).toEqual(fils(320500n));
    // Operating profit: 145.000 - 320.500 = -175.500.
    expect(projection.operatingProfit.monthly[0]).toEqual(fils(-175500n));
    expect(moneyToMajorString(projection.operatingProfit.monthly[0] ?? fils(0n))).toBe('-175.500');
  });

  it('turns profitable at 100 units: month 12 earns 2500.000 - 1050.000 - 320.500', () => {
    expect(projection.revenue.monthly[11]).toEqual(fils(2500000n));
    expect(projection.cogs.monthly[11]).toEqual(fils(1050000n));
    expect(projection.operatingProfit.monthly[11]).toEqual(fils(1129500n));
  });

  it('keeps the price flat in years 2 and 3', () => {
    // 120 units in month 24 and 144 in month 36, at 25.000 each.
    expect(projection.revenue.monthly[23]).toEqual(fils(3000000n));
    expect(projection.revenue.monthly[35]).toEqual(fils(3600000n));
    expect(projection.cogs.monthly[35]).toEqual(fils(1512000n));
  });

  it('sums a quarter from its three months', () => {
    // Column 13 is months 13 to 15 (Nov 2027 to Jan 2028): 102 + 103 + 105 = 310 units.
    expect(projection.calendar.periods[12]).toMatchObject({ kind: 'quarter', firstMonth: 13 });
    expect(projection.units.byPeriod[12]).toBe(310n);
    expect(projection.revenue.byPeriod[12]).toEqual(fils(7750000n));
    expect(projection.cogs.byPeriod[12]).toEqual(fils(3255000n));
    // Year 1 columns are single months.
    expect(projection.units.byPeriod.slice(0, 12)).toEqual(projection.units.monthly.slice(0, 12));
  });

  it('lists the answers it used on each line, and the rule', () => {
    expect(projection.units.provenance.inputs).toEqual([
      { kind: 'answer', id: 'F6' },
      { kind: 'answer', id: 'D7' },
      { kind: 'answer', id: 'E7' },
      { kind: 'answer', id: 'F6.2' },
      { kind: 'rule', id: T9_RULES.units },
    ]);
    expect(projection.revenue.provenance.inputs).toEqual([
      { kind: 'answer', id: 'F6' },
      { kind: 'answer', id: 'D7' },
      { kind: 'answer', id: 'E7' },
      { kind: 'answer', id: 'F6.2' },
      { kind: 'rule', id: T9_RULES.units },
      { kind: 'answer', id: 'F1' },
      { kind: 'rule', id: T9_RULES.revenue },
    ]);
    expect(projection.fixedCosts.provenance.inputs).toEqual([{ kind: 'answer', id: 'F4' }]);
    expect(projection.payroll.provenance.inputs).toEqual([{ kind: 'answer', id: 'E8' }]);
    expect(projection.marketing.provenance.inputs).toEqual([{ kind: 'answer', id: 'F4.1' }]);
  });
});

describe('weakest provenance (D-181)', () => {
  it('is an assumption of low confidence when the sales depend on something unknown', () => {
    // D7, E7 and F6.2 were never answered: each is an assumption of low confidence.
    const projection = run(answersFor(10, 40, 100));
    expect(projection.units.provenance).toMatchObject({
      source: 'assumption',
      confidence: 'low',
      validated: false,
    });
    expect(projection.revenue.provenance.confidence).toBe('low');
    expect(projection.operatingProfit.provenance.source).toBe('assumption');
  });

  it('keeps a line of the founder own answers as the founder own', () => {
    const projection = run(
      answersFor(10, 40, 100, {
        'F6.2': real(20),
        D7: real({ seasonal: false, peakMonths: [] }),
        E7: real(500),
        'F4.1': real(jod(50)),
        E8: real({ items: [] }),
      }),
    );
    expect(projection.revenue.provenance).toMatchObject({
      source: 'user',
      confidence: 'high',
      validated: true,
    });
    expect(projection.operatingCosts.provenance).toMatchObject({
      source: 'user',
      confidence: 'high',
    });
    expect(projection.operatingProfit.provenance).toMatchObject({
      source: 'user',
      validated: true,
    });
  });

  it('lowers only the lines that use the unknown answer', () => {
    const projection = run(
      answersFor(10, 40, 100, {
        'F6.2': real(20),
        D7: real({ seasonal: false, peakMonths: [] }),
        E7: real(500),
        'F4.1': UNKNOWN,
      }),
    );
    expect(projection.marketing.provenance).toMatchObject({
      source: 'assumption',
      confidence: 'low',
    });
    expect(projection.fixedCosts.provenance).toMatchObject({ source: 'user', confidence: 'high' });
    expect(projection.revenue.provenance.source).toBe('user');
    expect(projection.operatingCosts.provenance.source).toBe('assumption');
    expect(projection.operatingProfit.provenance.confidence).toBe('low');
  });
});

describe('years 2 and 3 without a founder growth: the estimate of D-183', () => {
  it('caps it at 25% a year and grows year 3 by half of that', () => {
    // 40 to 100 is +150% in six months; half of it is +75%; 1.75^2 - 1 = 206%, held to 25%; year 3: 12.5%.
    const projection = run(answersFor(10, 40, 100));
    expect(asNumbers(projection.units.monthly.slice(12, 24))).toEqual([
      102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 123, 125,
    ]);
    expect(asNumbers(projection.units.monthly.slice(24))).toEqual([
      126, 127, 129, 130, 131, 133, 134, 135, 137, 138, 139, 141,
    ]);
    expect(projection.yearlyGrowth?.value).toEqual([parseRate('0.25'), parseRate('0.125')]);
    expect(projection.yearlyGrowth?.inputs).toEqual(
      expect.arrayContaining([
        { kind: 'answer', id: 'F6.2' },
        { kind: 'answer', id: 'F6' },
        { kind: 'default', id: 'growth.founder_share' },
        { kind: 'default', id: 'growth.upper_bound_yearly' },
        { kind: 'default', id: 'growth.year3_share_of_year2' },
        { kind: 'rule', id: T9_RULES.growthEstimate },
      ]),
    );
    expect(projection.units.provenance.inputs).toEqual(
      expect.arrayContaining([{ kind: 'default', id: 'growth.upper_bound_yearly' }]),
    );
  });

  it('keeps the estimate below the bound when sales grow slowly', () => {
    // 40 to 44: half of +10% is +5%; 1.05^2 - 1 = 10.25% in year 2 and 5.125% in year 3.
    const projection = run(answersFor(10, 40, 44));
    expect(projection.yearlyGrowth?.value).toEqual([parseRate('0.1025'), parseRate('0.05125')]);
    expect(projection.units.monthly[23]).toBe(49n);
    expect(projection.units.monthly[35]).toBe(51n);
  });

  it('stays flat when sales fall from month 6 to month 12', () => {
    const projection = run(answersFor(10, 40, 30));
    expect(projection.yearlyGrowth?.value).toEqual([parseRate('0'), parseRate('0')]);
    expect(asNumbers(projection.units.monthly.slice(11))).toEqual(
      Array.from({ length: 25 }, () => 30),
    );
  });

  it('treats an unknown F6.2 like a missing one', () => {
    const projection = run(answersFor(10, 40, 100, { 'F6.2': UNKNOWN }));
    expect(projection.yearlyGrowth?.value).toEqual([parseRate('0.25'), parseRate('0.125')]);
  });
});

describe('seasonality', () => {
  // Peak months are calendar months 11, 12 and 1: projection months 1, 2 and 3, and 13 to 15.
  const seasonal = answersFor(15, 20, 20, {
    D7: real({ seasonal: true, peakMonths: [11, 12, 1] }),
    'F6.2': real(0),
  });
  const projection = run(seasonal);

  it('takes the seasons out of F6, draws the curve, and puts them back', () => {
    // Peak factor 3/2, other months 5/6. Levels 15/1.5 = 10, 20/(5/6) = 24, 24; the founder points stay.
    expect(asNumbers(projection.units.monthly.slice(0, 12))).toEqual([
      15, 18, 21, 14, 17, 20, 20, 20, 20, 20, 20, 20,
    ]);
    expect(projection.seasonality.kind).toBe('applied');
  });

  it('repeats the same seasons in year 2, on the same calendar months', () => {
    // Level 24 all year: 24 * 3/2 = 36 in November, December and January, and 24 * 5/6 = 20 otherwise.
    expect(asNumbers(projection.units.monthly.slice(12, 24))).toEqual([
      36, 36, 36, 20, 20, 20, 20, 20, 20, 20, 20, 20,
    ]);
    const year2 = projection.units.monthly.slice(12, 24).reduce((a, b) => a + b, 0n);
    expect(year2).toBe(288n);
  });

  it('lists the peak-month factor among the inputs', () => {
    expect(projection.units.provenance.inputs).toContainEqual({
      kind: 'default',
      id: 'seasonality.peak_factor',
    });
  });

  it('ignores a pattern with too many peak months and says so', () => {
    const many = run(
      answersFor(10, 40, 100, {
        D7: real({ seasonal: true, peakMonths: [1, 2, 3, 4, 5, 6, 7, 8] }),
        'F6.2': real(0),
      }),
    );
    expect(many.seasonality.kind).toBe('too_many_peaks');
    expect(asNumbers(many.units.monthly.slice(0, 12))).toEqual(Y1_10_40_100);
    expect(many.notes).toContainEqual({ code: 'seasonality_ignored', questionId: 'D7' });
    expect(many.units.provenance.inputs).not.toContainEqual({
      kind: 'default',
      id: 'seasonality.peak_factor',
    });
  });
});

describe('zero sales in month 1', () => {
  it('rises in a straight line to month 6 and then grows at a constant rate', () => {
    const projection = run(answersFor(0, 30, 60, { 'F6.2': real(0) }));
    // 0, 6, 12, 18, 24, 30 and then 30 * 2^((m-6)/6): 33.7, 37.8, 42.4, 47.6, 53.5, 60.
    expect(asNumbers(projection.units.monthly.slice(0, 12))).toEqual([
      0, 6, 12, 18, 24, 30, 34, 38, 42, 48, 53, 60,
    ]);
    expect(projection.revenue.monthly[0]).toEqual(fils(0n));
    expect(projection.operatingProfit.monthly[0]).toEqual(fils(-320500n));
  });

  it('falls in a straight line when month 6 is zero, then rises again', () => {
    const projection = run(answersFor(5, 0, 10, { 'F6.2': real(0) }));
    expect(asNumbers(projection.units.monthly.slice(0, 12))).toEqual([
      5, 4, 3, 2, 1, 0, 2, 3, 5, 7, 8, 10,
    ]);
  });

  it('sells nothing when every point is zero, and the estimate stays at zero', () => {
    const projection = run(answersFor(0, 0, 0));
    expect(projection.units.monthly.every((units) => units === 0n)).toBe(true);
    expect(projection.revenue.monthly.every((amount) => amount.minor === 0n)).toBe(true);
    expect(projection.operatingProfit.monthly[35]).toEqual(fils(-320500n));
  });

  it('takes the upper bound when month 6 is zero and month 12 is not', () => {
    const projection = run(answersFor(5, 0, 10));
    expect(projection.yearlyGrowth?.value).toEqual([parseRate('0.25'), parseRate('0.125')]);
  });
});

describe('capacity (E7)', () => {
  const projection = run(answersFor(10, 40, 100, { E7: real(30) }));

  it('never lets a month go above the cap and flags the months it cut', () => {
    expect(asNumbers(projection.units.monthly.slice(0, 7))).toEqual([10, 13, 17, 23, 30, 30, 30]);
    expect(projection.units.monthly.every((units) => units <= 30n)).toBe(true);
    // Month 5 is 30.3, which rounds to the cap itself and is not a cut; month 6 onwards (31 months) is.
    expect(projection.capped.filter(Boolean)).toHaveLength(31);
    expect(projection.capped[4]).toBe(false);
    expect(projection.capped[5]).toBe(true);
    expect(projection.notes).toContainEqual({ code: 'capacity_reached', questionId: 'E7' });
  });

  it('caps revenue with it', () => {
    expect(projection.revenue.monthly[35]).toEqual(fils(750000n));
  });

  it('adds no note when nothing is cut', () => {
    const roomy = run(answersFor(10, 40, 100, { E7: real(5000) }));
    expect(roomy.capped.some(Boolean)).toBe(false);
    expect(roomy.notes.some((note) => note.code === 'capacity_reached')).toBe(false);
  });
});

describe('staff and marketing', () => {
  const more: Answers = {
    'F6.2': real(20),
    'F4.1': real(jod(50)),
    E8: real({
      items: [
        { role: 'Technician', monthlyCost: jod(400), startMonth: 4 },
        { role: 'Driver', monthlyCost: jod(250.5), startMonth: 13 },
      ],
    }),
  };
  const projection = run(answersFor(10, 40, 100, more));

  it('pays each person from the start month on, and not before', () => {
    const payroll = minors(projection.payroll);
    expect(payroll.slice(0, 3)).toEqual([0n, 0n, 0n]);
    expect(payroll[3]).toBe(400000n);
    expect(payroll[11]).toBe(400000n);
    expect(payroll[12]).toBe(650500n);
    expect(payroll[35]).toBe(650500n);
  });

  it('adds the marketing budget to every month', () => {
    expect(minors(projection.marketing).every((minor) => minor === 50000n)).toBe(true);
  });

  it('adds fixed costs, payroll and marketing into the operating costs', () => {
    // Month 1: 320.500 + 0 + 50.000. Month 4: 320.500 + 400.000 + 50.000.
    expect(projection.operatingCosts.monthly[0]).toEqual(fils(370500n));
    expect(projection.operatingCosts.monthly[3]).toEqual(fils(770500n));
    // Month 4 has 23 units: revenue 575.000, COGS 241.500, gross profit 333.500; 333.500 - 770.500 = -437.000.
    expect(projection.grossProfit.monthly[3]).toEqual(fils(333500n));
    expect(projection.operatingProfit.monthly[3]).toEqual(fils(-437000n));
  });

  it('pays a person who starts in the last month of the horizon only then', () => {
    const late = run(
      answersFor(10, 40, 100, {
        E8: real({ items: [{ role: 'Late', monthlyCost: jod(100), startMonth: 36 }] }),
      }),
    );
    expect(minors(late.payroll).filter((minor) => minor > 0n)).toEqual([100000n]);
  });
});

describe('an unknown F1 with D4 prices', () => {
  const projection = run(
    answersFor(10, 40, 100, {
      F1: UNKNOWN,
      D4: real({
        items: [
          { name: 'A', price: jod(20) },
          { name: 'B', price: jod(40) },
          { name: 'C', price: null },
          { name: 'D', price: jod(30) },
        ],
      }),
    }),
  );

  it('prices at the median of the known prices', () => {
    // The median of 20, 30 and 40 is 30.000: month 1 sells 10 units for 300.000.
    expect(projection.revenue.monthly[0]).toEqual(fils(300000n));
  });

  it('lowers the revenue to an assumption of low confidence and names F1 and D4', () => {
    expect(projection.revenue.provenance).toMatchObject({
      source: 'assumption',
      confidence: 'low',
    });
    expect(projection.revenue.provenance.inputs).toEqual(
      expect.arrayContaining([
        { kind: 'answer', id: 'F1' },
        { kind: 'answer', id: 'D4' },
      ]),
    );
    expect(projection.cogs.provenance.inputs).not.toContainEqual({ kind: 'answer', id: 'F1' });
  });
});

describe('inflation (D-185)', () => {
  const rate = makeFigure(parseRate('0.05'), {
    source: 'external',
    confidence: 'high',
    validated: true,
    inputs: [{ kind: 'country_pack_item', id: 'JO.inflation' }],
  });
  const params = createEngineParams({ inflationRate: rate });
  const answers = answersFor(10, 40, 100, {
    'F6.2': real(20),
    'F4.1': real(jod(50)),
    E8: real({ items: [{ role: 'Technician', monthlyCost: jod(400), startMonth: 1 }] }),
  });
  const projection = run(answers, params);

  it('leaves year 1 alone', () => {
    expect(projection.fixedCosts.monthly[11]).toEqual(fils(320500n));
    expect(projection.cogs.monthly[0]).toEqual(fils(105000n));
  });

  it('raises the costs by 5% in year 2 and by 5% again in year 3', () => {
    // Year 2: fixed 320.500 * 1.05 = 336.525; payroll 400.000 * 1.05 = 420.000; marketing 52.500.
    expect(projection.fixedCosts.monthly[12]).toEqual(fils(336525n));
    expect(projection.payroll.monthly[12]).toEqual(fils(420000n));
    expect(projection.marketing.monthly[12]).toEqual(fils(52500n));
    // Year 3: 320.500 * 1.1025 = 353.35125, rounded to 353.351.
    expect(projection.fixedCosts.monthly[24]).toEqual(fils(353351n));
    // COGS of month 13: 102 units * 10.500 * 1.05 = 1124.550.
    expect(projection.cogs.monthly[12]).toEqual(fils(1124550n));
  });

  it('rounds the whole line once, half away from zero', () => {
    // Month 25 sells 122 units: 122 * 10.500 * 1.1025 = 1412.3025, which is 1412302.5 fils and rounds up.
    expect(projection.cogs.monthly[24]).toEqual(fils(1412303n));
  });

  it('never raises the price', () => {
    expect(projection.revenue.monthly[12]).toEqual(fils(102n * 25000n));
    expect(projection.revenue.monthly[24]).toEqual(fils(122n * 25000n));
  });

  it('lists the rate among the inputs of the inflated lines only', () => {
    const ref = { kind: 'country_pack_item', id: 'JO.inflation' };
    for (const line of [
      projection.cogs,
      projection.fixedCosts,
      projection.payroll,
      projection.marketing,
    ]) {
      expect(line.provenance.inputs).toContainEqual(ref);
    }
    expect(projection.revenue.provenance.inputs).not.toContainEqual(ref);
    expect(projection.fixedCosts.provenance.source).toBe('external');
    expect(projection.notes.some((note) => note.code === 'inflation_not_applied')).toBe(false);
  });

  it('applies none and says so without a verified rate', () => {
    const plain = run(answers);
    expect(plain.fixedCosts.monthly[24]).toEqual(fils(320500n));
    expect(plain.cogs.monthly[12]).toEqual(fils(102n * 10500n));
    expect(plain.notes).toContainEqual({ code: 'inflation_not_applied' });
  });
});

describe('the COGS multiplier (the FX test of T9 and the scenarios of T10)', () => {
  const answers = answersFor(10, 40, 100, { 'F6.2': real(20) });
  const input = inputOf(answers);
  const plain = projectOperatingLines(input);
  const inflation = createEngineParams({
    inflationRate: makeFigure(parseRate('0.05'), {
      source: 'external',
      confidence: 'high',
      validated: true,
      inputs: [{ kind: 'country_pack_item', id: 'JO.inflation' }],
    }),
  });

  it('gives exactly the same projection when it is left out, or is 1', () => {
    expect(projectOperatingLines(input, DEFAULT_ENGINE_PARAMS, {})).toEqual(plain);
    expect(
      projectOperatingLines(input, DEFAULT_ENGINE_PARAMS, { cogsMultiplier: ONE_RATE }),
    ).toEqual(plain);
  });

  it('scales COGS and the profits built on it, and nothing else', () => {
    const dearer = projectOperatingLines(input, DEFAULT_ENGINE_PARAMS, {
      cogsMultiplier: parseRate('1.1'),
    });
    // Month 1: 10 units * 10.500 = 105.000, times 1.1 = 115.500. Month 13: 102 units = 1071.000, times 1.1 = 1178.100.
    expect(dearer.cogs.monthly[0]).toEqual(fils(115500n));
    expect(dearer.cogs.monthly[11]).toEqual(fils(1155000n));
    expect(dearer.cogs.monthly[12]).toEqual(fils(1178100n));
    // Gross profit 250.000 - 115.500 = 134.500; operating profit 134.500 - 320.500 = -186.000.
    expect(dearer.grossProfit.monthly[0]).toEqual(fils(134500n));
    expect(dearer.operatingProfit.monthly[0]).toEqual(fils(-186000n));
    expect(dearer.revenue).toEqual(plain.revenue);
    expect(dearer.units).toEqual(plain.units);
    expect(dearer.fixedCosts).toEqual(plain.fixedCosts);
    expect(dearer.operatingCosts).toEqual(plain.operatingCosts);
    // The quarterly columns are still sums of the months.
    const total = (line: ProjectionLine<Money>) =>
      line.monthly.reduce((sum, amount) => sum + amount.minor, 0n);
    expect(dearer.cogs.byPeriod.reduce((sum, amount) => sum + amount.minor, 0n)).toBe(
      total(dearer.cogs),
    );
  });

  it('allows a multiplier of zero and below 1', () => {
    const free = projectOperatingLines(input, DEFAULT_ENGINE_PARAMS, { cogsMultiplier: ZERO_RATE });
    expect(free.cogs.monthly.every((amount) => amount.minor === 0n)).toBe(true);
    const half = projectOperatingLines(input, DEFAULT_ENGINE_PARAMS, {
      cogsMultiplier: makeRate(1n, 2n),
    });
    expect(half.cogs.monthly[0]).toEqual(fils(52500n));
  });

  it('rounds the line once together with the inflation, half away from zero', () => {
    // Month 25: 122 units * 10.500 * 1.1025 * 1/2 = 706.15125 JOD, which is 706151.25 fils: 706.151.
    // Rounding the inflated COGS (1412.303) first would give 706.1515, which rounds up to 706.152.
    const projection = projectOperatingLines(input, inflation, {
      cogsMultiplier: makeRate(1n, 2n),
    });
    expect(projection.cogs.monthly[24]).toEqual(fils(706151n));
  });

  it('lists the multiplier among the inputs of COGS and the lines built on it, only when it is used', () => {
    const ref = { kind: 'rule', id: T9_RULES.cogsMultiplier };
    const dearer = projectOperatingLines(input, DEFAULT_ENGINE_PARAMS, {
      cogsMultiplier: parseRate('1.2'),
    });
    expect(dearer.cogs.provenance.inputs).toContainEqual(ref);
    expect(dearer.grossProfit.provenance.inputs).toContainEqual(ref);
    expect(dearer.operatingProfit.provenance.inputs).toContainEqual(ref);
    expect(dearer.revenue.provenance.inputs).not.toContainEqual(ref);
    expect(plain.cogs.provenance.inputs).not.toContainEqual(ref);
  });

  it('refuses a negative multiplier', () => {
    expect(() =>
      projectOperatingLines(input, DEFAULT_ENGINE_PARAMS, { cogsMultiplier: makeRate(-1n, 10n) }),
    ).toThrow(expect.objectContaining({ code: 'invalid_param' }) as Error);
  });
});

describe('amounts in another currency', () => {
  it('refuses an input whose price is not in the input currency', () => {
    const input = inputOf(answersFor(10, 40, 100));
    const usd: EngineInput = {
      ...input,
      price: makeFigure(makeMoney(25000n, 'USD'), input.price),
    };
    expect(() => projectOperatingLines(usd)).toThrow(
      expect.objectContaining({ code: 'currency_mismatch' }) as Error,
    );
  });

  it('refuses a staff member paid in another currency', () => {
    const input = inputOf(answersFor(10, 40, 100));
    const usd: EngineInput = {
      ...input,
      staff: makeFigure(
        [{ role: 'x', monthlyCost: makeMoney(1n, 'USD'), startMonth: 1 }],
        input.staff,
      ),
    };
    expect(() => projectOperatingLines(usd)).toThrow(
      expect.objectContaining({ code: 'currency_mismatch' }) as Error,
    );
  });
});

describe('the projection is deterministic', () => {
  it('gives the same result for the same input', () => {
    const answers = answersFor(10, 40, 100, { D7: real({ seasonal: true, peakMonths: [6, 7] }) });
    expect(run(answers)).toEqual(run(answers));
  });

  it('does not change its input', () => {
    const input = inputOf(answersFor(10, 40, 100));
    const before = JSON.stringify(input, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    projectOperatingLines(input);
    const after = JSON.stringify(input, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    expect(after).toBe(before);
  });
});

describe('invariants over random projects', () => {
  const sales = fc.integer({ min: 0, max: 3000 });
  const answerSets = fc.record({
    month1: sales,
    month6: sales,
    month12: sales,
    growth: fc.option(fc.integer({ min: 0, max: 300 }), { nil: undefined }),
    capacity: fc.option(fc.integer({ min: 1, max: 3000 }), { nil: undefined }),
    peaks: fc.uniqueArray(fc.integer({ min: 1, max: 12 }), { maxLength: 12 }),
    marketing: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
    staff: fc.array(
      fc.record({
        cost: fc.integer({ min: 0, max: 2000 }),
        start: fc.integer({ min: 1, max: 36 }),
      }),
      { maxLength: 3 },
    ),
    price: fc.integer({ min: 0, max: 200 }),
    inflation: fc.option(fc.integer({ min: 0, max: 30 }), { nil: undefined }),
  });

  it('keeps every line adding up and every unit count inside its bounds', () => {
    fc.assert(
      fc.property(answerSets, (s) => {
        const more: Answers = {
          F1: real(jod(s.price)),
          D7: real({ seasonal: s.peaks.length > 0, peakMonths: s.peaks }),
          E8: real({
            items: s.staff.map((member, index) => ({
              role: `Role ${String(index)}`,
              monthlyCost: jod(member.cost),
              startMonth: member.start,
            })),
          }),
          ...(s.growth === undefined ? {} : { 'F6.2': real(s.growth) }),
          ...(s.capacity === undefined ? {} : { E7: real(s.capacity) }),
          ...(s.marketing === undefined ? {} : { 'F4.1': real(jod(s.marketing)) }),
        };
        const params =
          s.inflation === undefined
            ? undefined
            : createEngineParams({
                inflationRate: makeFigure(parseRate(String(s.inflation / 100)), {
                  source: 'external',
                  confidence: 'high',
                  validated: true,
                  inputs: [{ kind: 'country_pack_item', id: 'x' }],
                }),
              });
        const p = run(answersFor(s.month1, s.month6, s.month12, more), params);

        // Units: whole, never negative, never above the cap, and the three points are met without a cap.
        for (const units of p.units.monthly) {
          expect(units >= 0n).toBe(true);
          if (s.capacity !== undefined) expect(units <= BigInt(s.capacity)).toBe(true);
        }
        if (s.capacity === undefined) {
          expect([p.units.monthly[0], p.units.monthly[5], p.units.monthly[11]]).toEqual([
            BigInt(s.month1),
            BigInt(s.month6),
            BigInt(s.month12),
          ]);
        }
        // A quarter is the sum of its months, for every line.
        const sumOf = <T>(values: readonly T[], add: (a: T, b: T) => T, zero: T) =>
          p.calendar.periods.map((period) =>
            values.slice(period.firstMonth - 1, period.lastMonth).reduce(add, zero),
          );
        expect(p.units.byPeriod).toEqual(sumOf(p.units.monthly, (a, b) => a + b, 0n));
        for (const line of [
          p.revenue,
          p.cogs,
          p.grossProfit,
          p.fixedCosts,
          p.payroll,
          p.marketing,
          p.operatingCosts,
          p.operatingProfit,
        ]) {
          expect(line.monthly).toHaveLength(36);
          expect(line.byPeriod.map((amount) => amount.minor)).toEqual(
            sumOf(minors(line), (a, b) => a + b, 0n),
          );
        }
        // The lines add up, month by month and column by column.
        const check = (
          result: ProjectionLine<Money>,
          left: ProjectionLine<Money>,
          right: ProjectionLine<Money>,
          sign: 1n | -1n,
        ) => {
          for (const key of ['monthly', 'byPeriod'] as const) {
            expect(result[key].map((amount) => amount.minor)).toEqual(
              left[key].map(
                (amount, index) => amount.minor + sign * (right[key][index]?.minor ?? 0n),
              ),
            );
          }
        };
        check(p.grossProfit, p.revenue, p.cogs, -1n);
        check(p.operatingProfit, p.grossProfit, p.operatingCosts, -1n);
        const fixedAndPayroll = {
          ...p.fixedCosts,
          monthly: p.fixedCosts.monthly.map((amount, index) => ({
            ...amount,
            minor: amount.minor + (p.payroll.monthly[index]?.minor ?? 0n),
          })),
          byPeriod: p.fixedCosts.byPeriod.map((amount, index) => ({
            ...amount,
            minor: amount.minor + (p.payroll.byPeriod[index]?.minor ?? 0n),
          })),
        };
        check(p.operatingCosts, fixedAndPayroll, p.marketing, 1n);
      }),
      { numRuns: 60 },
    );
  });
});
