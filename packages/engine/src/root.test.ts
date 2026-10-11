import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nthRootFloor, rateRoot, ROOT_RESOLUTION, ROOT_RESOLUTION_DIGITS } from './root';
import {
  compareRates,
  divideRates,
  makeRate,
  ONE_RATE,
  parseRate,
  powRate,
  subtractRates,
} from './rate';

describe('nthRootFloor', () => {
  it('is exact for perfect powers and floors everything else', () => {
    expect(nthRootFloor(0n, 3)).toBe(0n);
    expect(nthRootFloor(1n, 5)).toBe(1n);
    expect(nthRootFloor(144n, 2)).toBe(12n);
    expect(nthRootFloor(143n, 2)).toBe(11n);
    expect(nthRootFloor(145n, 2)).toBe(12n);
    expect(nthRootFloor(1000n, 3)).toBe(10n);
    expect(nthRootFloor(999n, 3)).toBe(9n);
    expect(nthRootFloor(2n ** 60n, 12)).toBe(32n);
    expect(nthRootFloor(2n ** 60n - 1n, 12)).toBe(31n);
    expect(nthRootFloor(12345n, 1)).toBe(12345n);
  });

  it('handles numbers far beyond the safe integer range', () => {
    const base = 10n ** 40n + 12345n;
    expect(nthRootFloor(base ** 12n, 12)).toBe(base);
    expect(nthRootFloor(base ** 12n - 1n, 12)).toBe(base - 1n);
  });

  it('refuses a negative value and a root below 1', () => {
    expect(() => nthRootFloor(-1n, 2)).toThrow(
      expect.objectContaining({ code: 'invalid_rate' }) as Error,
    );
    expect(() => nthRootFloor(4n, 0)).toThrow(
      expect.objectContaining({ code: 'invalid_rate' }) as Error,
    );
    expect(() => nthRootFloor(4n, 2.5)).toThrow(
      expect.objectContaining({ code: 'invalid_rate' }) as Error,
    );
  });

  it('satisfies floor(r)^n <= x < (floor(r)+1)^n for any value', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 60n }),
        fc.integer({ min: 1, max: 14 }),
        (x, n) => {
          const r = nthRootFloor(x, n);
          const k = BigInt(n);
          expect(r ** k <= x).toBe(true);
          expect((r + 1n) ** k > x).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('rateRoot', () => {
  it('records the resolution it works at', () => {
    expect(ROOT_RESOLUTION).toBe(10n ** BigInt(ROOT_RESOLUTION_DIGITS));
    expect(ROOT_RESOLUTION_DIGITS).toBe(18);
  });

  it('is exact when the root is a multiple of the resolution', () => {
    expect(rateRoot(makeRate(4n, 1n), 2)).toEqual(makeRate(2n, 1n));
    expect(rateRoot(makeRate(1n, 8n), 3)).toEqual(makeRate(1n, 2n));
    expect(rateRoot(parseRate('1.44'), 2)).toEqual(parseRate('1.2'));
    expect(rateRoot(ONE_RATE, 12)).toEqual(ONE_RATE);
    expect(rateRoot(makeRate(0n, 1n), 5)).toEqual(makeRate(0n, 1n));
  });

  it('floors the root at 18 decimals', () => {
    // sqrt(2) = 1.41421356237309504880168872...
    expect(rateRoot(makeRate(2n, 1n), 2)).toEqual(makeRate(1414213562373095048n, ROOT_RESOLUTION));
    // 2^(1/12) = 1.05946309435929526456182529...
    expect(rateRoot(makeRate(2n, 1n), 12)).toEqual(makeRate(1059463094359295264n, ROOT_RESOLUTION));
  });

  it('refuses a negative rate', () => {
    expect(() => rateRoot(makeRate(-1n, 2n), 2)).toThrow(
      expect.objectContaining({ code: 'invalid_rate' }) as Error,
    );
  });

  it('twelve monthly steps reach the yearly rate within 12 parts in 10^18', () => {
    // The stated error: the monthly factor is below the exact root by less than 10^-18, so its
    // twelfth power is below 1 + g by less than 12 * 10^-18 * m^11, a relative error under 12e-18.
    const bound = makeRate(12n, ROOT_RESOLUTION);
    for (const text of ['1', '1.01', '1.1025', '1.2', '1.25', '2', '4.7', '11']) {
      const target = parseRate(text);
      const reached = powRate(rateRoot(target, 12), 12);
      expect(compareRates(reached, target) <= 0, text).toBe(true);
      const relative = divideRates(subtractRates(target, reached), target);
      expect(compareRates(relative, bound) <= 0, text).toBe(true);
    }
  });
});
