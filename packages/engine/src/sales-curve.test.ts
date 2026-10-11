import * as fc from 'fast-check';
import { at } from './array';
import { describe, expect, it } from 'vitest';
import { buildProjectionCalendar } from './calendar';
import { seasonalFactors } from './seasonality';
import {
  deseasonalisedPoints,
  estimateYearlyGrowth,
  interpolateLevels,
  unitCurve,
  yearlyGrowthRates,
} from './sales-curve';
import {
  compareRates,
  makeRate,
  multiplyRates,
  ONE_RATE,
  parseRate,
  rateToDecimalString,
  ZERO_RATE,
  type Rate,
} from './rate';

const rates = (...texts: string[]): Rate[] => texts.map(parseRate);
const decimals = (levels: readonly Rate[], places: number) =>
  levels.map((level) => rateToDecimalString(level, places));
const FLAT = seasonalFactors([], parseRate('1.5')).factors;
const points = (a: string, b: string, c: string) => ({
  month1: parseRate(a),
  month6: parseRate(b),
  month12: parseRate(c),
});

describe('interpolateLevels', () => {
  it('grows at a constant monthly rate between two positive points and ends exactly on the second', () => {
    // 10 * 4^(j/5): 13.1951, 17.4110, 22.9740, 30.3143, 40 (checked against floating point).
    const levels = interpolateLevels(parseRate('10'), parseRate('40'), 5);
    expect(levels).toHaveLength(5);
    expect(decimals(levels, 4)).toEqual(['13.1951', '17.4110', '22.9740', '30.3143', '40.0000']);
    expect(levels[4]).toEqual(parseRate('40'));
  });

  it('declines at a constant rate between two positive points', () => {
    // 40 * (1/4)^(j/5) mirrors the rise: 30.3143, 22.9740, 17.4110, 13.1951, 10.
    const levels = interpolateLevels(parseRate('40'), parseRate('10'), 5);
    expect(decimals(levels, 4)).toEqual(['30.3143', '22.9740', '17.4110', '13.1951', '10.0000']);
  });

  it('changes linearly when the first point is zero', () => {
    expect(interpolateLevels(ZERO_RATE, parseRate('30'), 5)).toEqual(
      rates('6', '12', '18', '24', '30'),
    );
  });

  it('changes linearly when the second point is zero', () => {
    expect(interpolateLevels(parseRate('5'), ZERO_RATE, 5)).toEqual(rates('4', '3', '2', '1', '0'));
  });

  it('keeps zero at zero and a constant level constant', () => {
    expect(interpolateLevels(ZERO_RATE, ZERO_RATE, 6)).toEqual(rates('0', '0', '0', '0', '0', '0'));
    expect(interpolateLevels(parseRate('24'), parseRate('24'), 6)).toEqual(
      rates('24', '24', '24', '24', '24', '24'),
    );
  });

  it('applies a yearly rate month by month and lands exactly on the yearly total', () => {
    // 100 at 20% a year: 101.5309, 103.0853, ... 120.
    const yearEnd = multiplyRates(parseRate('100'), parseRate('1.2'));
    const levels = interpolateLevels(parseRate('100'), yearEnd, 12);
    expect(decimals(levels.slice(0, 3), 4)).toEqual(['101.5309', '103.0853', '104.6635']);
    expect(levels[11]).toEqual(parseRate('120'));
    for (let i = 1; i < 12; i += 1) {
      expect(compareRates(at(levels, i), at(levels, i - 1))).toBe(1);
    }
  });

  it('never leaves the range between its two points', () => {
    const level = fc.integer({ min: 0, max: 5000 }).map((n) => makeRate(BigInt(n), 7n));
    fc.assert(
      fc.property(level, level, fc.integer({ min: 1, max: 12 }), (from, to, steps) => {
        const levels = interpolateLevels(from, to, steps);
        expect(levels).toHaveLength(steps);
        expect(compareRates(at(levels, steps - 1), to)).toBe(0);
        const [low, high] = compareRates(from, to) <= 0 ? [from, to] : [to, from];
        for (const value of levels) {
          expect(compareRates(value, low) >= 0).toBe(true);
          expect(compareRates(value, high) <= 0).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('estimateYearlyGrowth', () => {
  const half = makeRate(1n, 2n);
  const bound = makeRate(1n, 4n);

  it('keeps half of the growth from month 6 to 12 and makes it yearly', () => {
    // 40 to 44 is +10% in six months; half is 5%; 1.05^2 - 1 = 10.25%.
    expect(estimateYearlyGrowth(parseRate('40'), parseRate('44'), half, bound)).toEqual(
      makeRate(41n, 400n),
    );
  });

  it('stops at the upper bound', () => {
    // 40 to 100: half of +150% is +75%, 1.75^2 - 1 = 206%, above 25%.
    expect(estimateYearlyGrowth(parseRate('40'), parseRate('100'), half, bound)).toEqual(bound);
  });

  it('never goes below zero when sales fall or stay flat', () => {
    expect(estimateYearlyGrowth(parseRate('40'), parseRate('30'), half, bound)).toEqual(ZERO_RATE);
    expect(estimateYearlyGrowth(parseRate('40'), parseRate('40'), half, bound)).toEqual(ZERO_RATE);
    expect(estimateYearlyGrowth(parseRate('40'), ZERO_RATE, half, bound)).toEqual(ZERO_RATE);
  });

  it('takes the bound when sales start from zero in month 6, and zero when they stay at zero', () => {
    expect(estimateYearlyGrowth(ZERO_RATE, parseRate('10'), half, bound)).toEqual(bound);
    expect(estimateYearlyGrowth(ZERO_RATE, ZERO_RATE, half, bound)).toEqual(ZERO_RATE);
  });
});

describe('yearlyGrowthRates', () => {
  it('uses one rate for every later year when the founder gave it', () => {
    expect(yearlyGrowthRates(3, parseRate('0.2'), null)).toEqual(rates('0.2', '0.2'));
    expect(yearlyGrowthRates(1, parseRate('0.2'), null)).toEqual([]);
  });

  it('halves the estimate from year 3 on and keeps that rate after', () => {
    expect(yearlyGrowthRates(5, parseRate('0.25'), parseRate('0.5'))).toEqual(
      rates('0.25', '0.125', '0.125', '0.125'),
    );
  });
});

describe('deseasonalisedPoints', () => {
  it('divides each point by the factor of its calendar month', () => {
    // Reference 2026-10-05: month 1 is November (peak), month 6 April and month 12 October.
    const calendar = buildProjectionCalendar('2026-10-05', 12);
    const { factors } = seasonalFactors([11, 12, 1], parseRate('1.5'));
    const result = deseasonalisedPoints(points('15', '20', '20'), calendar, factors);
    expect(result).toEqual(points('10', '24', '24'));
  });

  it('leaves the points alone without seasonality', () => {
    const calendar = buildProjectionCalendar('2026-10-05', 12);
    expect(deseasonalisedPoints(points('1.5', '6', '9'), calendar, FLAT)).toEqual(
      points('1.5', '6', '9'),
    );
  });
});

describe('unitCurve', () => {
  const calendar = buildProjectionCalendar('2026-10-05', 36);

  it('passes through the three points and rounds half away from zero', () => {
    const curve = unitCurve({
      calendar: buildProjectionCalendar('2026-10-05', 12),
      levels: points('10', '40', '100'),
      factors: FLAT,
      yearlyGrowth: [],
      capacity: null,
    });
    expect(curve.units).toEqual([10, 13, 17, 23, 30, 40, 47, 54, 63, 74, 86, 100].map(BigInt));
    expect(curve.capped.some(Boolean)).toBe(false);
  });

  it('applies the yearly growth month by month in years 2 and 3', () => {
    const curve = unitCurve({
      calendar,
      levels: points('10', '40', '100'),
      factors: FLAT,
      yearlyGrowth: rates('0.2', '0.2'),
      capacity: null,
    });
    // Year 2: 100 * 1.2^(j/12) = 101.53, 103.09, 104.66, ... 120.
    expect(curve.units.slice(12, 24)).toEqual(
      [102, 103, 105, 106, 108, 110, 111, 113, 115, 116, 118, 120].map(BigInt),
    );
    expect(curve.units[23]).toBe(120n);
    expect(curve.units[35]).toBe(144n);
  });

  it('puts the seasonal factors back and keeps the three points', () => {
    // Peak months are calendar months 11, 12 and 1: projection months 1, 2 and 3.
    const { factors } = seasonalFactors([11, 12, 1], parseRate('1.5'));
    const levels = deseasonalisedPoints(points('15', '20', '20'), calendar, factors);
    const curve = unitCurve({
      calendar: buildProjectionCalendar('2026-10-05', 12),
      levels,
      factors,
      yearlyGrowth: [],
      capacity: null,
    });
    // Levels 10, 11.91, 14.19, 16.94, 20.2, 24 and then 24; times 3/2 in months 1 to 3 and 5/6 after.
    expect(curve.units.slice(0, 6)).toEqual([15, 18, 21, 14, 17, 20].map(BigInt));
    expect(curve.units.slice(6)).toEqual(Array.from({ length: 6 }, () => 20n));
  });

  it('never exceeds the capacity and flags the months it cut', () => {
    const curve = unitCurve({
      calendar: buildProjectionCalendar('2026-10-05', 12),
      levels: points('10', '40', '100'),
      factors: FLAT,
      yearlyGrowth: [],
      capacity: 30n,
    });
    expect(curve.units.slice(0, 6)).toEqual([10n, 13n, 17n, 23n, 30n, 30n]);
    // Month 5 is 30.3, which rounds to the capacity itself and is not a cut.
    expect(curve.capped).toEqual([
      ...Array.from({ length: 5 }, () => false),
      ...Array.from({ length: 7 }, () => true),
    ]);
    expect(curve.units.every((units) => units <= 30n)).toBe(true);
  });

  it('draws a flat zero when sales are zero', () => {
    const curve = unitCurve({
      calendar,
      levels: points('0', '0', '0'),
      factors: FLAT,
      yearlyGrowth: rates('0.25', '0.125'),
      capacity: null,
    });
    expect(curve.units.every((units) => units === 0n)).toBe(true);
  });

  it('refuses a list of twelve factors that is shorter', () => {
    expect(() =>
      unitCurve({
        calendar: buildProjectionCalendar('2026-10-05', 12),
        levels: points('1', '2', '3'),
        factors: FLAT.slice(0, 10),
        yearlyGrowth: [],
        capacity: null,
      }),
    ).toThrow(expect.objectContaining({ code: 'length_mismatch' }) as Error);
  });

  it('refuses a growth list that does not match the horizon', () => {
    expect(() =>
      unitCurve({
        calendar,
        levels: points('1', '2', '3'),
        factors: FLAT,
        yearlyGrowth: [ONE_RATE],
        capacity: null,
      }),
    ).toThrow(expect.objectContaining({ code: 'length_mismatch' }) as Error);
  });
});
