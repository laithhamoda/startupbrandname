import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import { engineInputFrom, type EngineInput, type ProvenanceBySteps } from './input';
import { makeMoney, moneyToMajorString } from './money';
import type { OperatingProjection } from './projection';
import { projectOperatingLines } from './projection';
import { makeRate } from './rate';
import { T8_RULES, unitEconomics, type UnitEconomics } from './unit-economics';

const jod = (amount: number) => ({ amount, currency: 'JOD' });
const items = (...rows: [string, number][]) => ({
  items: rows.map(([label, amount]) => ({ label, amount, currency: 'JOD' })),
});
const real = (value: unknown) => ({ status: 'answered' as const, value });
const UNKNOWN = { status: 'unknown' as const };

/** A JOD project: price, variable cost and monthly fixed cost as given; sales 10, 40 and 100 units. */
const answersFor = (price: number, variableCost: number, fixedCost: number, more: Answers = {}) =>
  ({
    F1: real(jod(price)),
    F3: real(items(['Materials', variableCost])),
    F4: real(items(['Rent', fixedCost])),
    F6: real({ month1: 10, month6: 40, month12: 100 }),
    ...more,
  }) satisfies Answers;

const userHigh = { source: 'user', confidence: 'high', validated: true } as const;
const everythingUser: ProvenanceBySteps = Object.fromEntries(
  ['F1', 'F2', 'F2.1', 'F3', 'F4', 'F4.1', 'F6', 'F6.2', 'D7', 'E7', 'E8'].map((id) => [
    id,
    userHigh,
  ]),
);

function inputOf(answers: Answers, provenance: ProvenanceBySteps = everythingUser): EngineInput {
  const result = engineInputFrom(answers, provenance, {
    country: 'JO',
    currency: 'JOD',
    mode: 'full',
    referenceDate: '2026-10-05',
  });
  if (result.status !== 'ok') throw new Error(`not calculable: ${JSON.stringify(result.reasons)}`);
  return result.input;
}

function economicsOf(answers: Answers, provenance?: ProvenanceBySteps) {
  const input = inputOf(answers, provenance);
  const projection = projectOperatingLines(input);
  return { input, projection, result: unitEconomics(input, projection) };
}

/** The projection with the units of months 11 and 12 replaced, to hand-check the new customers. */
function withLastUnits(
  projection: OperatingProjection,
  month11: bigint,
  month12: bigint,
): OperatingProjection {
  const monthly = [...projection.units.monthly];
  monthly[10] = month11;
  monthly[11] = month12;
  return { ...projection, units: { ...projection.units, monthly } };
}

/** The projection with the operating profit of every month replaced (in fils). */
function withProfits(
  projection: OperatingProjection,
  fils: readonly bigint[],
): OperatingProjection {
  const monthly = projection.operatingProfit.monthly.map((_, index) =>
    makeMoney(fils[index] ?? -1n, 'JOD'),
  );
  return { ...projection, operatingProfit: { ...projection.operatingProfit, monthly } };
}

function ok(result: UnitEconomics) {
  if (result.status !== 'ok') throw new Error('expected an ok result');
  return result;
}

describe('T8 unit economics and break-even', () => {
  it('P 10.000, VC 4.000 and FC 3,000.000: CM 6.000, CM% 60%, 500 units and 5,000.000 to break even', () => {
    // CM = 10 - 4 = 6; CM% = 6 / 10 = 3/5; BE_units = ceil(3000 / 6) = 500; BE_rev = 3000 / 0.6 = 5000.
    const result = ok(economicsOf(answersFor(10, 4, 3000)).result);
    expect(moneyToMajorString(result.contributionMargin.value)).toBe('6.000');
    expect(result.contributionMarginRate.value).toEqual(makeRate(3n, 5n));
    expect(moneyToMajorString(result.fixedCost.value)).toBe('3000.000');
    expect(result.breakEvenUnits.value).toBe(500n);
    expect(moneyToMajorString(result.breakEvenRevenue.value)).toBe('5000.000');
  });

  it('FC 3,100.000: 516.67 units rounds up to 517, and 5,166.666... rounds to 5,166.667', () => {
    // BE_units = ceil(3100 / 6) = ceil(516.67) = 517; BE_rev = 3100 / 0.6 = 5166.666... -> 5166.667.
    const result = ok(economicsOf(answersFor(10, 4, 3100)).result);
    expect(result.breakEvenUnits.value).toBe(517n);
    expect(moneyToMajorString(result.breakEvenRevenue.value)).toBe('5166.667');
  });

  it('rounds the revenue of break-even half away from zero, once', () => {
    // P 10.000, VC 4.000, FC 3000.001 JOD: 3000001 * 10000 / 6000 = 5000001.67 fils -> 5000.002.
    const result = ok(economicsOf(answersFor(10, 4, 3000.001)).result);
    expect(moneyToMajorString(result.breakEvenRevenue.value)).toBe('5000.002');
    // FC 3000.003 JOD: 3000003 * 10 / 6 = 5000005 fils exactly -> 5000.005.
    const exact = ok(economicsOf(answersFor(10, 4, 3000.003)).result);
    expect(moneyToMajorString(exact.breakEvenRevenue.value)).toBe('5000.005');
  });

  it('counts the payroll of the staff started by month 12 and the marketing, not later hires', () => {
    // FC of month 12 = F4 2400 + F4.1 600 + the technician (400, from month 6) = 3400.
    // The driver starts in month 13 and is left out. BE_units = ceil(3400 / 6) = 567 (566.67).
    // BE_rev = 3400 * 10 / 6 = 5666.667.
    const staff = {
      items: [
        { role: 'Technician', monthlyCost: jod(400), startMonth: 6 },
        { role: 'Driver', monthlyCost: jod(500), startMonth: 13 },
      ],
    };
    const result = ok(
      economicsOf(answersFor(10, 4, 2400, { 'F4.1': real(jod(600)), E8: real(staff) })).result,
    );
    expect(moneyToMajorString(result.fixedCost.value)).toBe('3400.000');
    expect(result.breakEvenUnits.value).toBe(567n);
    expect(moneyToMajorString(result.breakEvenRevenue.value)).toBe('5666.667');
  });

  it('needs no units when there is no fixed cost', () => {
    const result = ok(economicsOf(answersFor(10, 4, 0)).result);
    expect(result.breakEvenUnits.value).toBe(0n);
    expect(result.breakEvenRevenue.value.minor).toBe(0n);
  });

  describe('when the contribution margin is zero or negative (SPEC F3)', () => {
    it('blocks, and computes no break-even, when CM is zero', () => {
      const result = economicsOf(answersFor(4, 4, 3000)).result;
      expect(result.status).toBe('blocked');
      expect(result.contributionMargin.value).toEqual(makeMoney(0n, 'JOD'));
      expect(result.contributionMarginRate?.value).toEqual(makeRate(0n, 1n));
      expect('breakEvenUnits' in result).toBe(false);
      expect('breakEvenMonth' in result).toBe(false);
    });

    it('blocks when CM is negative, with the negative CM% shown', () => {
      // CM = 3 - 4 = -1; CM% = -1 / 3.
      const result = economicsOf(answersFor(3, 4, 3000)).result;
      expect(result.status).toBe('blocked');
      expect(moneyToMajorString(result.contributionMargin.value)).toBe('-1.000');
      expect(result.contributionMarginRate?.value).toEqual(makeRate(-1n, 3n));
    });

    it('has no CM% when the price is zero', () => {
      const result = economicsOf(answersFor(0, 4, 3000)).result;
      expect(result.status).toBe('blocked');
      expect(result.contributionMarginRate).toBeNull();
    });
  });

  describe('BE_month: the first month whose operating profit before tax is zero or more', () => {
    const base = economicsOf(answersFor(10, 4, 3000));
    const month = (profits: readonly bigint[]) =>
      ok(unitEconomics(base.input, withProfits(base.projection, profits))).breakEvenMonth;

    it('counts a profit of exactly zero', () => {
      // Profits in fils: -5, -3, -1, 0, 2, ... : month 4 is the first that is not a loss.
      const figure = month([-5n, -3n, -1n, 0n, 2n, 4n]);
      expect(figure.value).toBe(4);
    });

    it('can be month 1', () => {
      expect(month([7n]).value).toBe(1);
    });

    it('can fall in year 2 or 3, when the quarterly columns begin', () => {
      const losses = Array.from({ length: 14 }, () => -100n);
      expect(month([...losses, 50n]).value).toBe(15);
      const longer = Array.from({ length: 35 }, () => -100n);
      expect(month([...longer, 0n]).value).toBe(36);
    });

    it('is not reached when no month of the horizon earns zero or more', () => {
      expect(month([]).value).toBeNull();
    });

    it('is the first month, not the last, when the profit later dips again', () => {
      expect(month([-1n, 3n, -2n, 5n]).value).toBe(2);
    });

    it('reads the real projection: the month before it loses money and the month itself does not', () => {
      // 100, 400 and 1,000 units in months 1, 6 and 12 at CM 6.000 against 3,000.000 of fixed cost.
      const economics = economicsOf(
        answersFor(10, 4, 3000, { F6: real({ month1: 100, month6: 400, month12: 1000 }) }),
      );
      const found = ok(economics.result).breakEvenMonth.value;
      expect(found).not.toBeNull();
      const profits = economics.projection.operatingProfit.monthly.map((amount) => amount.minor);
      const index = (found ?? 0) - 1;
      expect(profits[index] ?? -1n).toBeGreaterThanOrEqual(0n);
      expect(profits.slice(0, index).every((minor) => minor < 0n)).toBe(true);
    });

    it('is not reached for the plain example, which never sells 500 units a month', () => {
      // 10, 40 and 100 units: the best month of three years sells well under 500 units.
      expect(ok(base.result).breakEvenMonth.value).toBeNull();
    });
  });

  describe('provenance (D-181)', () => {
    it('lists the answers and the rule behind each figure and keeps a user figure a user figure', () => {
      const staff = { items: [{ role: 'Technician', monthlyCost: jod(400), startMonth: 6 }] };
      const result = ok(
        economicsOf(answersFor(10, 4, 2400, { 'F4.1': real(jod(600)), E8: real(staff) })).result,
      );
      expect(result.breakEvenUnits).toMatchObject({
        source: 'user',
        confidence: 'high',
        validated: true,
      });
      const ids = result.breakEvenUnits.inputs.map((ref) => `${ref.kind}:${ref.id}`);
      expect(ids).toEqual(
        expect.arrayContaining([
          'answer:F4',
          'answer:E8',
          'answer:F4.1',
          'answer:F1',
          'answer:F3',
          `rule:${T8_RULES.breakEvenUnits}`,
        ]),
      );
      expect(result.contributionMargin.inputs.map((ref) => ref.id)).toEqual([
        'F1',
        'F3',
        T8_RULES.contributionMargin,
      ]);
    });

    it('becomes an assumption when an input is one, such as unknown marketing', () => {
      const result = ok(economicsOf(answersFor(10, 4, 3000)).result);
      expect(result.breakEvenUnits.source).toBe('assumption');
      expect(result.breakEvenUnits.confidence).toBe('low');
      expect(result.breakEvenUnits.validated).toBe(false);
      expect(result.contributionMargin.source).toBe('user');
    });

    it('takes the provenance of the operating profit for the break-even month', () => {
      const economics = economicsOf(answersFor(10, 4, 3000));
      const result = ok(economics.result);
      expect(result.breakEvenMonth.inputs).toEqual(
        expect.arrayContaining([...economics.projection.operatingProfit.provenance.inputs]),
      );
      expect(result.breakEvenMonth.inputs).toContainEqual({
        kind: 'rule',
        id: T8_RULES.breakEvenMonth,
      });
    });
  });

  it('refuses a projection made in another currency', () => {
    const { input, projection } = economicsOf(answersFor(10, 4, 3000));
    expect(() => unitEconomics(input, { ...projection, currency: 'USD' })).toThrow(EngineError);
  });
});

describe('T8 for a subscription (D-183)', () => {
  /** F4 2400 plus F4.1 600 marketing; ARPU 10.000, CM 6.000 (CM% 60%). */
  const subscription = (churn: number | 'unknown' | 'missing', marketing = 600): Answers => ({
    ...answersFor(10, 4, 2400, marketing === 0 ? {} : { 'F4.1': real(jod(marketing)) }),
    F2: real('subscription'),
    ...(churn === 'missing' ? {} : { 'F2.1': churn === 'unknown' ? UNKNOWN : real(churn) }),
  });

  function subscriptionOf(
    answers: Answers,
    month11 = 100n,
    month12 = 125n,
  ): NonNullable<ReturnType<typeof ok>['subscription']> {
    const { input, projection } = economicsOf(answers);
    const result = ok(unitEconomics(input, withLastUnits(projection, month11, month12)));
    if (result.subscription === null) throw new Error('expected a subscription');
    return result.subscription;
  }

  it('has nothing for a model that is not a subscription', () => {
    expect(ok(economicsOf(answersFor(10, 4, 3000)).result).subscription).toBeNull();
    expect(
      ok(economicsOf(answersFor(10, 4, 3000, { F2: real('fixed') })).result).subscription,
    ).toBeNull();
  });

  it('churn 5%: LTV 120.000, CAC 20.000 on 30 new customers, LTV / CAC 6', () => {
    // LTV = 10 * 60% / 0.05 = 120. New customers of month 12 = 125 - 100 * (1 - 0.05) = 30.
    // CAC = 600 / 30 = 20. LTV / CAC = 120 / 20 = 6.
    const result = subscriptionOf(subscription(5));
    expect(moneyToMajorString(result.arpu.value)).toBe('10.000');
    expect(result.churn?.value).toEqual(makeRate(1n, 20n));
    expect(moneyToMajorString(result.ltv?.value ?? makeMoney(0n, 'JOD'))).toBe('120.000');
    expect(result.newCustomers?.value).toEqual(makeRate(30n, 1n));
    expect(moneyToMajorString(result.cac?.value ?? makeMoney(0n, 'JOD'))).toBe('20.000');
    expect(result.ltvToCac?.value).toEqual(makeRate(6n, 1n));
    expect(result.gaps).toEqual([]);
  });

  it('churn 20%: LTV 30.000, CAC 20.000 on 30 new customers, LTV / CAC 1.5', () => {
    // LTV = 6 / 0.2 = 30. New customers = 110 - 100 * 0.8 = 30. CAC = 600 / 30 = 20. Ratio 30 / 20.
    const result = subscriptionOf(subscription(20), 100n, 110n);
    expect(moneyToMajorString(result.ltv?.value ?? makeMoney(0n, 'JOD'))).toBe('30.000');
    expect(moneyToMajorString(result.cac?.value ?? makeMoney(0n, 'JOD'))).toBe('20.000');
    expect(result.ltvToCac?.value).toEqual(makeRate(3n, 2n));
  });

  it('keeps fractions of a customer exact: churn 2.5% and 100 to 100 units is 2.5 new customers', () => {
    // New customers = 100 - 100 * 0.975 = 2.5; CAC = 600 / 2.5 = 240; LTV = 6 / 0.025 = 240.
    const result = subscriptionOf(subscription(2.5), 100n, 100n);
    expect(result.newCustomers?.value).toEqual(makeRate(5n, 2n));
    expect(moneyToMajorString(result.cac?.value ?? makeMoney(0n, 'JOD'))).toBe('240.000');
    expect(moneyToMajorString(result.ltv?.value ?? makeMoney(0n, 'JOD'))).toBe('240.000');
    expect(result.ltvToCac?.value).toEqual(makeRate(1n, 1n));
  });

  it('rounds LTV and CAC half away from zero to the minor unit, and the ratio from the exact values', () => {
    // LTV = 6.000 / 0.07 = 85.714285... -> 85.714. New customers = 130 - 100 * 0.93 = 37;
    // CAC = 600 / 37 = 16.216216... -> 16.216. The ratio is exact: (6000 / 0.07) / (600000 / 37).
    const result = subscriptionOf(subscription(7), 100n, 130n);
    expect(moneyToMajorString(result.ltv?.value ?? makeMoney(0n, 'JOD'))).toBe('85.714');
    expect(moneyToMajorString(result.cac?.value ?? makeMoney(0n, 'JOD'))).toBe('16.216');
    expect(result.ltvToCac?.value).toEqual(makeRate(6000n * 100n * 37n, 7n * 600000n));
  });

  it('leaves LTV, CAC and the ratio out when the churn is unknown or missing', () => {
    for (const churn of ['unknown', 'missing'] as const) {
      const result = subscriptionOf(subscription(churn));
      expect(result.churn).toBeNull();
      expect(result.ltv).toBeNull();
      expect(result.newCustomers).toBeNull();
      expect(result.cac).toBeNull();
      expect(result.ltvToCac).toBeNull();
      expect(result.gaps).toEqual(['churn_unset']);
    }
  });

  it('has no LTV for a churn of 0, but still a CAC', () => {
    // Nobody leaves: LTV is unbounded. New customers = 125 - 100 = 25; CAC = 600 / 25 = 24.
    const result = subscriptionOf(subscription(0));
    expect(result.ltv).toBeNull();
    expect(result.ltvToCac).toBeNull();
    expect(moneyToMajorString(result.cac?.value ?? makeMoney(0n, 'JOD'))).toBe('24.000');
    expect(result.gaps).toEqual(['churn_zero']);
  });

  it('treats a churn of 100% as everyone leaving: all of month 12 is new', () => {
    // LTV = 6 / 1 = 6. New customers = 125 - 100 * 0 = 125. CAC = 600 / 125 = 4.8.
    const result = subscriptionOf(subscription(100));
    expect(moneyToMajorString(result.ltv?.value ?? makeMoney(0n, 'JOD'))).toBe('6.000');
    expect(result.newCustomers?.value).toEqual(makeRate(125n, 1n));
    expect(moneyToMajorString(result.cac?.value ?? makeMoney(0n, 'JOD'))).toBe('4.800');
  });

  it('has no CAC when the month wins no new customers, whether zero or fewer than zero', () => {
    // Churn 5%: 95 customers stay from 100, so 95 units in month 12 means 0 new; 90 means -5.
    for (const month12 of [95n, 90n]) {
      const result = subscriptionOf(subscription(5), 100n, month12);
      expect(result.newCustomers?.value.num).toBeLessThanOrEqual(0n);
      expect(result.cac).toBeNull();
      expect(result.ltvToCac).toBeNull();
      expect(result.ltv).not.toBeNull();
      expect(result.gaps).toEqual(['no_new_customers']);
    }
  });

  it('has a CAC of zero but no ratio when there is no marketing budget', () => {
    const result = subscriptionOf(subscription(5, 0));
    expect(result.cac?.value.minor).toBe(0n);
    expect(result.ltvToCac).toBeNull();
    expect(result.gaps).toEqual(['no_marketing']);
  });

  it('lists the inputs behind each figure', () => {
    const result = subscriptionOf(subscription(5));
    expect(result.ltv?.inputs).toEqual([
      { kind: 'answer', id: 'F1' },
      { kind: 'answer', id: 'F3' },
      { kind: 'answer', id: 'F2.1' },
      { kind: 'rule', id: T8_RULES.ltv },
    ]);
    expect(result.cac?.inputs).toContainEqual({ kind: 'answer', id: 'F4.1' });
    expect(result.cac?.inputs).toContainEqual({ kind: 'rule', id: T8_RULES.cac });
    expect(result.ltvToCac?.inputs).toContainEqual({ kind: 'rule', id: T8_RULES.ltvToCac });
  });

  it('is blocked, with no subscription figures, when the contribution margin is not positive', () => {
    const answers = { ...subscription(5), F1: real(jod(4)) };
    const { input, projection } = economicsOf(answers);
    const result = unitEconomics(input, projection);
    expect(result.status).toBe('blocked');
    expect('subscription' in result).toBe(false);
  });
});
