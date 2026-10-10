import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import {
  absBigInt,
  divRoundHalfAwayFromZero,
  formatScaled,
  gcdBigInt,
  parseDecimal,
  pow10,
} from './integer';

describe('absBigInt and gcdBigInt', () => {
  it('takes absolute values', () => {
    expect(absBigInt(-7n)).toBe(7n);
    expect(absBigInt(7n)).toBe(7n);
    expect(absBigInt(0n)).toBe(0n);
  });

  it('finds the greatest common divisor, never negative', () => {
    expect(gcdBigInt(12n, 18n)).toBe(6n);
    expect(gcdBigInt(-12n, 18n)).toBe(6n);
    expect(gcdBigInt(12n, -18n)).toBe(6n);
    expect(gcdBigInt(0n, 5n)).toBe(5n);
    expect(gcdBigInt(0n, 0n)).toBe(0n);
  });
});

describe('pow10', () => {
  it('raises ten to a non-negative integer power', () => {
    expect(pow10(0)).toBe(1n);
    expect(pow10(3)).toBe(1000n);
    expect(pow10(30)).toBe(10n ** 30n);
  });

  it('rejects a negative or fractional exponent', () => {
    expect(() => pow10(-1)).toThrow(EngineError);
    expect(() => pow10(1.5)).toThrow(EngineError);
  });
});

describe('divRoundHalfAwayFromZero', () => {
  it.each([
    [5n, 2n, 3n],
    [-5n, 2n, -3n],
    [5n, -2n, -3n],
    [-5n, -2n, 3n],
    [4n, 3n, 1n],
    [2n, 3n, 1n],
    [1n, 3n, 0n],
    [-1n, 3n, 0n],
    [1n, 2n, 1n],
    [-1n, 2n, -1n],
    [0n, 5n, 0n],
    [0n, -5n, 0n],
    [6n, 3n, 2n],
    [-7n, 7n, -1n],
  ])('%s / %s is %s', (numerator, divisor, expected) => {
    expect(divRoundHalfAwayFromZero(numerator, divisor)).toBe(expected);
  });

  it('refuses to divide by zero', () => {
    expect(() => divRoundHalfAwayFromZero(1n, 0n)).toThrow(
      expect.objectContaining({ code: 'division_by_zero' }) as Error,
    );
  });
});

describe('formatScaled', () => {
  it.each([
    [12345n, 3, '12.345'],
    [-5n, 3, '-0.005'],
    [5n, 3, '0.005'],
    [0n, 3, '0.000'],
    [250n, 0, '250'],
    [-250n, 0, '-250'],
    [100n, 2, '1.00'],
    [-100n, 2, '-1.00'],
  ])('writes %s with %s decimals as %s', (units, decimals, expected) => {
    expect(formatScaled(units, decimals)).toBe(expected);
  });
});

describe('parseDecimal', () => {
  it.each([
    ['12.5', 125n, 1],
    ['-12.5', -125n, 1],
    ['+3', 3n, 0],
    ['.5', 5n, 1],
    ['5.', 5n, 0],
    ['0.30000000000000004', 30000000000000004n, 17],
    ['1e-7', 1n, 7],
    ['1.5e3', 1500n, 0],
    ['1.25e1', 125n, 1],
    ['1e+21', 10n ** 21n, 0],
    ['-0', 0n, 0],
    ['007', 7n, 0],
    ['2E2', 200n, 0],
  ])('reads "%s" exactly', (text, units, scale) => {
    expect(parseDecimal(text)).toEqual({ units, scale });
  });

  it.each([
    [''],
    ['.'],
    ['-'],
    ['e5'],
    ['NaN'],
    ['Infinity'],
    ['1,000'],
    [' 1'],
    ['1 '],
    ['1e'],
    ['1.2.3'],
    ['0x10'],
    ['1e401'],
    ['1e-401'],
    ['1'.repeat(401)],
  ])('rejects %j', (text) => {
    expect(parseDecimal(text)).toBeNull();
  });

  it('accepts the largest exponent allowed', () => {
    expect(parseDecimal('1e400')?.units).toBe(10n ** 400n);
  });
});
