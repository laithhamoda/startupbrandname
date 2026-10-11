import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addRates,
  compareRates,
  makeRate,
  multiplyRates,
  ONE_RATE,
  parseRate,
  ZERO_RATE,
} from './rate';
import { seasonalFactors } from './seasonality';

const PEAK = parseRate('1.5');
const sum = (factors: readonly { num: bigint; den: bigint }[]) =>
  factors.reduce(addRates, ZERO_RATE);

describe('seasonalFactors', () => {
  it('is flat when D7 names no peak month', () => {
    const result = seasonalFactors([], PEAK);
    expect(result.kind).toBe('none');
    expect(result.factors).toHaveLength(12);
    expect(result.factors.every((factor) => compareRates(factor, ONE_RATE) === 0)).toBe(true);
  });

  it('is flat when every month is a peak month', () => {
    const result = seasonalFactors([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], PEAK);
    expect(result.kind).toBe('none');
    expect(result.factors.every((factor) => compareRates(factor, ONE_RATE) === 0)).toBe(true);
  });

  it('gives peak months 3/2 and the others the share that keeps the total at 12', () => {
    // Three peak months: 3 * 3/2 = 9/2, so the other nine share 12 - 9/2 = 15/2: 15/2 / 9 = 5/6.
    const result = seasonalFactors([11, 12, 1], PEAK);
    expect(result.kind).toBe('applied');
    expect(result.factors[10]).toEqual(makeRate(3n, 2n));
    expect(result.factors[11]).toEqual(makeRate(3n, 2n));
    expect(result.factors[0]).toEqual(makeRate(3n, 2n));
    expect(result.factors[1]).toEqual(makeRate(5n, 6n));
    expect(result.factors[5]).toEqual(makeRate(5n, 6n));
    expect(compareRates(sum(result.factors), makeRate(12n, 1n))).toBe(0);
  });

  it('works for one peak month and for seven, the most the default factor allows', () => {
    // One peak: the other eleven get (12 - 3/2) / 11 = 21/22.
    const one = seasonalFactors([7], PEAK);
    expect(one.factors[6]).toEqual(makeRate(3n, 2n));
    expect(one.factors[0]).toEqual(makeRate(21n, 22n));
    // Seven peaks: 7 * 3/2 = 21/2 leaves 3/2 for five months: 3/10 each.
    const seven = seasonalFactors([1, 2, 3, 4, 5, 6, 7], PEAK);
    expect(seven.kind).toBe('applied');
    expect(seven.factors[7]).toEqual(makeRate(3n, 10n));
    expect(compareRates(sum(seven.factors), makeRate(12n, 1n))).toBe(0);
  });

  it('ignores the pattern when the peaks would leave nothing for the other months', () => {
    // Eight peaks at 3/2 already make 12: the other four months would have a factor of zero.
    const eight = seasonalFactors([1, 2, 3, 4, 5, 6, 7, 8], PEAK);
    expect(eight.kind).toBe('too_many_peaks');
    expect(eight.factors.every((factor) => compareRates(factor, ONE_RATE) === 0)).toBe(true);
    expect(seasonalFactors([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], PEAK).kind).toBe('too_many_peaks');
  });

  it('follows the peak factor it is given, and a factor of 1 changes nothing', () => {
    const two = seasonalFactors([6, 7, 8], parseRate('2'));
    expect(two.factors[5]).toEqual(makeRate(2n, 1n));
    expect(two.factors[0]).toEqual(makeRate(2n, 3n));
    const flat = seasonalFactors([6, 7, 8], ONE_RATE);
    expect(flat.kind).toBe('applied');
    expect(flat.factors.every((factor) => compareRates(factor, ONE_RATE) === 0)).toBe(true);
  });

  it('counts a month named twice once', () => {
    expect(seasonalFactors([3, 3], PEAK).factors).toEqual(seasonalFactors([3], PEAK).factors);
  });

  it.each([[[0]], [[13]], [[1.5]], [[-1]], [[Number.NaN]]])(
    'rejects the month list %j',
    (months) => {
      expect(() => seasonalFactors(months, PEAK)).toThrow(
        expect.objectContaining({ code: 'invalid_param' }) as Error,
      );
    },
  );

  it('always sums to 12, whatever the peak months and the peak factor', () => {
    const months = fc.uniqueArray(fc.integer({ min: 1, max: 12 }), { maxLength: 12 });
    const peak = fc.integer({ min: 100, max: 400 }).map((cents) => makeRate(BigInt(cents), 100n));
    fc.assert(
      fc.property(months, peak, (peaks, factor) => {
        const result = seasonalFactors(peaks, factor);
        expect(result.factors).toHaveLength(12);
        expect(compareRates(sum(result.factors), makeRate(12n, 1n))).toBe(0);
        for (const value of result.factors) expect(compareRates(value, ZERO_RATE)).toBe(1);
        if (result.kind === 'applied') {
          for (const month of peaks) {
            expect(result.factors[month - 1]).toEqual(factor);
          }
          const total = multiplyRates(factor, makeRate(BigInt(peaks.length), 1n));
          expect(compareRates(total, makeRate(12n, 1n))).toBe(-1);
        }
      }),
      { numRuns: 200 },
    );
  });
});
