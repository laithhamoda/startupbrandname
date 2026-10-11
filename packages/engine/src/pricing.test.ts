import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import { engineInputFrom, type EngineInput, type ProvenanceBySteps } from './input';
import { makeMoney, moneyToMajorString, type Money } from './money';
import { pricing, T7_RULES } from './pricing';
import { projectOperatingLines } from './projection';
import { createEngineParams } from './params';
import { defaultFigure } from './figure';
import { parseRate } from './rate';

const jod = (amount: number) => ({ amount, currency: 'JOD' });
const items = (...rows: [string, number][]) => ({
  items: rows.map(([label, amount]) => ({ label, amount, currency: 'JOD' })),
});
const real = (value: unknown) => ({ status: 'answered' as const, value });
const UNKNOWN = { status: 'unknown' as const };

const d4 = (...prices: (number | null)[]) =>
  real({
    items: prices.map((price, index) => ({
      name: `Competitor ${String(index + 1)}`,
      price: price === null ? null : jod(price),
    })),
  });

/**
 * VC 4.000 and a fixed cost of 3,000.000 a month, with a flat 400 units a month in year 1, so
 * the average fixed cost is 3,000.000 and the average units are 400.
 */
const answersFor = (more: Answers = {}) =>
  ({
    F1: real(jod(10)),
    F3: real(items(['Materials', 4])),
    F4: real(items(['Rent', 3000])),
    F6: real({ month1: 400, month6: 400, month12: 400 }),
    ...more,
  }) satisfies Answers;

const userHigh = { source: 'user', confidence: 'high', validated: true } as const;
const everythingUser: ProvenanceBySteps = Object.fromEntries(
  ['F1', 'F3', 'F4', 'F4.1', 'F6', 'F6.2', 'D4', 'D7', 'E7', 'E8'].map((id) => [id, userHigh]),
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

function pricingOf(answers: Answers, options?: { premiumAllowed?: boolean }) {
  const input = inputOf(answers);
  const projection = projectOperatingLines(input);
  return { input, projection, result: pricing(input, projection, options) };
}

const major = (money: Money | undefined) => moneyToMajorString(money ?? makeMoney(0n, 'JOD'));

describe('T7 pricing', () => {
  it('the floor is VC + average fixed cost / average units: 4.000 + 3,000.000 / 400 = 11.500', () => {
    const { result } = pricingOf(answersFor());
    expect(major(result.floor?.value)).toBe('11.500');
  });

  it('with D4 prices 9, 12 and 15: band 9 to 15, market 12, penetration 12.650', () => {
    // Penetration = max(11.500 * 1.1, min(D4)) = max(12.650, 9.000) = 12.650.
    const { result } = pricingOf(answersFor({ D4: d4(9, 12, 15) }));
    expect(result.band?.value).toEqual({
      min: makeMoney(9000n, 'JOD'),
      median: makeMoney(12000n, 'JOD'),
      max: makeMoney(15000n, 'JOD'),
    });
    expect(major(result.market?.value)).toBe('12.000');
    expect(major(result.penetration?.value)).toBe('12.650');
    expect(result.gaps).toEqual([]);
  });

  it('lifts the penetration price to the cheapest competitor when that is above 110% of the floor', () => {
    const { result } = pricingOf(answersFor({ D4: d4(14, 16, 20) }));
    expect(major(result.penetration?.value)).toBe('14.000');
  });

  it('orders the band whatever order D4 lists the prices in, and uses the middle price', () => {
    const { result } = pricingOf(answersFor({ D4: d4(15, 9, 12) }));
    expect(result.band?.value.min.minor).toBe(9000n);
    expect(result.band?.value.median.minor).toBe(12000n);
    expect(result.band?.value.max.minor).toBe(15000n);
  });

  it('takes the mean of the two middle prices as the median, rounded half away from zero', () => {
    // 9.000, 10.001, 12.000, 20.000: the middle two are 10.001 and 12.000, mean 11.0005 -> 11.001.
    const { result } = pricingOf(answersFor({ D4: d4(9, 10.001, 12, 20) }));
    expect(major(result.market?.value)).toBe('11.001');
    expect(result.band?.value.max.minor).toBe(20000n);
  });

  it('skips competitors whose price is unknown', () => {
    const { result } = pricingOf(answersFor({ D4: d4(null, 9, 15) }));
    expect(result.band?.value.min.minor).toBe(9000n);
    expect(result.band?.value.max.minor).toBe(15000n);
    expect(major(result.market?.value)).toBe('12.000');
  });

  it('works with a single known price', () => {
    const { result } = pricingOf(answersFor({ D4: d4(13) }));
    expect(result.band?.value.min).toEqual(result.band?.value.max);
    expect(major(result.market?.value)).toBe('13.000');
    expect(major(result.penetration?.value)).toBe('13.000');
  });

  describe('without D4 prices', () => {
    it.each([
      ['not answered', answersFor()],
      ['unknown', answersFor({ D4: UNKNOWN })],
      ['with no competitors', answersFor({ D4: d4() })],
      ['with every price unknown', answersFor({ D4: d4(null, null) })],
    ])('keeps the floor and leaves the band, penetration and market out when D4 is %s', (_, a) => {
      const { result } = pricingOf(a);
      expect(major(result.floor?.value)).toBe('11.500');
      expect(result.band).toBeNull();
      expect(result.penetration).toBeNull();
      expect(result.market).toBeNull();
      expect(result.premium).toBeNull();
      expect(result.gaps).toEqual(['no_competitor_prices']);
    });
  });

  describe('the premium (D5 passing rule R5)', () => {
    it('is out unless the caller says D5 passed R5', () => {
      const { result } = pricingOf(answersFor({ D4: d4(9, 12, 15) }));
      expect(result.premiumAllowed).toBe(false);
      expect(result.premium).toBeNull();
      expect(pricingOf(answersFor({ D4: d4(9, 12, 15) }), {}).result.premium).toBeNull();
      expect(
        pricingOf(answersFor({ D4: d4(9, 12, 15) }), { premiumAllowed: false }).result.premium,
      ).toBeNull();
    });

    it('is the top of the band when allowed, with R5 among its inputs', () => {
      const { result } = pricingOf(answersFor({ D4: d4(9, 12, 15) }), { premiumAllowed: true });
      expect(result.premiumAllowed).toBe(true);
      expect(major(result.premium?.value)).toBe('15.000');
      expect(result.premium?.inputs).toContainEqual({ kind: 'rule', id: 'R5' });
      expect(result.premium?.inputs).toContainEqual({ kind: 'rule', id: T7_RULES.premium });
    });

    it('stays out, even when allowed, without a band', () => {
      const { result } = pricingOf(answersFor(), { premiumAllowed: true });
      expect(result.premiumAllowed).toBe(true);
      expect(result.premium).toBeNull();
    });
  });

  describe('the floor in detail', () => {
    it('rounds the unit cost of the fixed cost half away from zero, once', () => {
      // F4 0.001 JOD a month and 2 units a month: 12 fils over 24 units = 0.5 fil -> 1 fil.
      const flat2 = {
        F6: real({ month1: 2, month6: 2, month12: 2 }),
        F4: real(items(['Fee', 0.001])),
      };
      expect(major(pricingOf(answersFor(flat2)).result.floor?.value)).toBe('4.001');
    });

    it('rounds an odd quotient: 36,000.000 over 84 units is 428.571 and the floor 432.571', () => {
      const flat7 = { F6: real({ month1: 7, month6: 7, month12: 7 }) };
      expect(major(pricingOf(answersFor(flat7)).result.floor?.value)).toBe('432.571');
    });

    it('counts the payroll and the marketing as fixed cost, and averages the first 12 months only', () => {
      // Fixed cost 3000 + marketing 600 = 3600 a month, plus a 1,200 hire from month 7: the hire
      // costs 6 x 1,200 = 7,200 in year 1. Total fixed cost of year 1 = 12 x 3,600 + 7,200 = 50,400;
      // units 12 x 400 = 4,800. Floor = 4 + 50,400 / 4,800 = 4 + 10.5 = 14.500.
      const staff = { items: [{ role: 'Engineer', monthlyCost: jod(1200), startMonth: 7 }] };
      const { result } = pricingOf(answersFor({ 'F4.1': real(jod(600)), E8: real(staff) }));
      expect(major(result.floor?.value)).toBe('14.500');
    });

    it('has no floor, and so no penetration, when year 1 sells nothing', () => {
      const none = { F6: real({ month1: 0, month6: 0, month12: 0 }), D4: d4(9, 12, 15) };
      const { result } = pricingOf(answersFor(none));
      expect(result.floor).toBeNull();
      expect(result.penetration).toBeNull();
      expect(result.band).not.toBeNull();
      expect(major(result.market?.value)).toBe('12.000');
      expect(result.gaps).toEqual(['no_units']);
    });

    it('uses the penetration factor of the parameters', () => {
      const input = inputOf(answersFor({ D4: d4(9, 12, 15) }));
      const projection = projectOperatingLines(input);
      const params = createEngineParams({
        penetrationFloorFactor: defaultFigure('pricing.penetration_floor_factor', parseRate('1.2')),
      });
      const { penetration } = pricing(input, projection, {}, params);
      // 11.500 * 1.2 = 13.800.
      expect(major(penetration?.value)).toBe('13.800');
    });
  });

  describe('provenance (D-181)', () => {
    it('lists what the floor, band and penetration are made of', () => {
      const staff = { items: [{ role: 'Engineer', monthlyCost: jod(1200), startMonth: 7 }] };
      const { result } = pricingOf(answersFor({ D4: d4(9, 12, 15), E8: real(staff) }));
      const ids = (refs: readonly { kind: string; id: string }[] | undefined) =>
        (refs ?? []).map((ref) => `${ref.kind}:${ref.id}`);
      expect(ids(result.floor?.inputs)).toEqual(
        expect.arrayContaining([
          'answer:F3',
          'answer:F4',
          'answer:E8',
          'answer:F6',
          `rule:${T7_RULES.floor}`,
        ]),
      );
      expect(ids(result.band?.inputs)).toEqual(['answer:D4', `rule:${T7_RULES.band}`]);
      expect(ids(result.market?.inputs)).toEqual(['answer:D4', `rule:${T7_RULES.market}`]);
      expect(ids(result.penetration?.inputs)).toEqual(
        expect.arrayContaining(['answer:D4', 'default:pricing.penetration_floor_factor']),
      );
    });

    it('makes the band a user figure and the penetration an assumption because of the factor', () => {
      const { result } = pricingOf(answersFor({ D4: d4(9, 12, 15) }));
      expect(result.band).toMatchObject({ source: 'user', confidence: 'high', validated: true });
      expect(result.market?.source).toBe('user');
      expect(result.penetration?.source).toBe('assumption');
    });
  });

  it('refuses a projection made in another currency', () => {
    const { input, projection } = pricingOf(answersFor());
    expect(() => pricing(input, { ...projection, currency: 'USD' })).toThrow(EngineError);
  });

  it('refuses a competitor price in another currency, which the adapter never lets through', () => {
    const { input, projection } = pricingOf(answersFor({ D4: d4(9, 12) }));
    const prices = input.competitorPrices;
    if (prices === null) throw new Error('expected D4');
    const bad: EngineInput = {
      ...input,
      competitorPrices: {
        ...prices,
        value: [{ name: 'Abroad', price: makeMoney(9000n, 'USD') }],
      },
    };
    expect(() => pricing(bad, projection)).toThrow(EngineError);
  });
});
