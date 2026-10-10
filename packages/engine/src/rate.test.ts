import { describe, expect, it } from 'vitest';
import {
  MAX_POWER_DIGITS,
  ONE_RATE,
  ZERO_RATE,
  addRates,
  compareRates,
  divideRates,
  makeRate,
  multiplyRates,
  negateRate,
  parsePercent,
  parseRate,
  powRate,
  rateFromNumber,
  rateFromPercent,
  rateToDecimalString,
  rateToPercentString,
  subtractRates,
} from './rate';

const r = (num: bigint, den = 1n) => makeRate(num, den);

describe('makeRate', () => {
  it('reduces to lowest terms with a positive denominator', () => {
    expect(r(2n, 4n)).toEqual({ num: 1n, den: 2n });
    expect(r(2n, -4n)).toEqual({ num: -1n, den: 2n });
    expect(r(-2n, -4n)).toEqual({ num: 1n, den: 2n });
    expect(r(0n, -7n)).toEqual({ num: 0n, den: 1n });
    expect(r(5n)).toEqual({ num: 5n, den: 1n });
  });

  it('refuses a zero divisor', () => {
    expect(() => r(1n, 0n)).toThrow(expect.objectContaining({ code: 'division_by_zero' }) as Error);
  });

  it('has the constants zero and one', () => {
    expect(ZERO_RATE).toEqual(r(0n));
    expect(ONE_RATE).toEqual(r(1n));
  });
});

describe('parsing', () => {
  it('reads decimals exactly', () => {
    expect(parseRate('0.25')).toEqual(r(1n, 4n));
    expect(parseRate('1.5')).toEqual(r(3n, 2n));
    expect(parseRate('-0.075')).toEqual(r(-3n, 40n));
    expect(parseRate('1e-3')).toEqual(r(1n, 1000n));
    expect(parseRate('2e2')).toEqual(r(200n));
    expect(parseRate('0.1')).toEqual(r(1n, 10n));
  });

  it('reads percentages', () => {
    expect(parsePercent('25')).toEqual(r(1n, 4n));
    expect(parsePercent('7.5')).toEqual(r(3n, 40n));
  });

  it('rejects text that is not a decimal', () => {
    for (const bad of ['', 'abc', '1/3', '25%', 'NaN', '1,5']) {
      expect(() => parseRate(bad)).toThrow(
        expect.objectContaining({ code: 'invalid_rate' }) as Error,
      );
    }
    expect(() => parsePercent('x')).toThrow();
  });

  it('reads a stored number as its shortest decimal, not its binary neighbour', () => {
    expect(rateFromNumber(0.1)).toEqual(r(1n, 10n));
    expect(rateFromNumber(0.1 + 0.2)).toEqual(r(30000000000000004n, 10n ** 17n));
    expect(rateFromNumber(-0)).toEqual(r(0n));
    expect(rateFromNumber(1e-7)).toEqual(r(1n, 10n ** 7n));
    expect(rateFromPercent(25)).toEqual(r(1n, 4n));
    expect(rateFromPercent(12.5)).toEqual(r(1n, 8n));
  });

  it('rejects NaN and the infinities', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(() => rateFromNumber(bad)).toThrow(
        expect.objectContaining({ code: 'invalid_rate' }) as Error,
      );
      expect(() => rateFromPercent(bad)).toThrow();
    }
  });
});

describe('arithmetic', () => {
  it('is exact where binary floating point is not', () => {
    const tenth = parseRate('0.1');
    const fifth = parseRate('0.2');
    expect(addRates(tenth, fifth)).toEqual(parseRate('0.3'));
    expect(multiplyRates(parseRate('1.1'), parseRate('1.1'))).toEqual(parseRate('1.21'));
  });

  it('adds, subtracts, multiplies, divides and negates', () => {
    expect(addRates(r(1n, 3n), r(1n, 6n))).toEqual(r(1n, 2n));
    expect(subtractRates(r(1n, 3n), r(1n, 2n))).toEqual(r(-1n, 6n));
    expect(multiplyRates(r(2n, 3n), r(3n, 4n))).toEqual(r(1n, 2n));
    expect(divideRates(r(1n, 2n), r(1n, 4n))).toEqual(r(2n));
    expect(divideRates(r(1n, 2n), r(-1n, 4n))).toEqual(r(-2n));
    expect(negateRate(r(1n, 3n))).toEqual(r(-1n, 3n));
    expect(negateRate(ZERO_RATE)).toEqual(ZERO_RATE);
  });

  it('refuses to divide by zero', () => {
    expect(() => divideRates(ONE_RATE, ZERO_RATE)).toThrow(
      expect.objectContaining({ code: 'division_by_zero' }) as Error,
    );
  });

  it('compares', () => {
    expect(compareRates(r(1n, 3n), r(1n, 2n))).toBe(-1);
    expect(compareRates(r(1n, 2n), r(2n, 4n))).toBe(0);
    expect(compareRates(r(1n, 2n), r(1n, 3n))).toBe(1);
    expect(compareRates(r(-1n, 2n), r(1n, 3n))).toBe(-1);
  });

  it('raises to integer powers, exactly', () => {
    expect(powRate(parseRate('1.02'), 0)).toEqual(ONE_RATE);
    expect(powRate(parseRate('1.1'), 2)).toEqual(parseRate('1.21'));
    expect(powRate(r(1n, 2n), -3)).toEqual(r(8n));
    expect(powRate(r(-2n), 3)).toEqual(r(-8n));
    const yearly = powRate(parseRate('1.02'), 12);
    expect(rateToDecimalString(yearly, 6)).toBe('1.268242');
  });

  it('refuses a fractional, unsafe or oversized exponent, and zero to a negative power', () => {
    expect(() => powRate(ONE_RATE, 1.5)).toThrow(
      expect.objectContaining({ code: 'invalid_rate' }) as Error,
    );
    expect(() => powRate(ONE_RATE, 10_001)).toThrow();
    expect(() => powRate(ONE_RATE, -10_001)).toThrow();
    expect(() => powRate(ONE_RATE, Number.NaN)).toThrow();
    expect(() => powRate(ZERO_RATE, -1)).toThrow(
      expect.objectContaining({ code: 'division_by_zero' }) as Error,
    );
  });
});

describe('the size of a power is bounded by the base as well as the exponent', () => {
  it('refuses a large base to a large power before computing it', () => {
    const wide = parseRate('1.' + '1'.repeat(390));
    expect(() => powRate(wide, 10_000)).toThrow(
      expect.objectContaining({ code: 'invalid_rate' }) as Error,
    );
    expect(() => powRate(wide, -10_000)).toThrow(
      expect.objectContaining({ code: 'invalid_rate' }) as Error,
    );
    // A tiny binary-exact number has a long fraction too.
    expect(() => powRate(rateFromNumber(Number('1.2345678901234567e-300')), 10_000)).toThrow();
  });

  it('allows the powers the engine uses, and any power up to the limit', () => {
    expect(powRate(parseRate('1.02'), 36).den).toBe(50n ** 36n);
    const atLimit = Math.floor(MAX_POWER_DIGITS / 3);
    expect(powRate(makeRate(1n, 100n), 0)).toEqual(ONE_RATE);
    expect(() => powRate(makeRate(1n, 100n), atLimit)).not.toThrow();
    expect(() => powRate(makeRate(1n, 100n), atLimit + 1)).toThrow();
  });
});

describe('display rounding', () => {
  it('rounds half away from zero, symmetric around zero', () => {
    expect(rateToDecimalString(r(1n, 3n), 4)).toBe('0.3333');
    expect(rateToDecimalString(r(2n, 3n), 4)).toBe('0.6667');
    expect(rateToDecimalString(r(-2n, 3n), 4)).toBe('-0.6667');
    expect(rateToDecimalString(r(1n, 8n), 2)).toBe('0.13');
    expect(rateToDecimalString(r(-1n, 8n), 2)).toBe('-0.13');
    expect(rateToDecimalString(r(1n, 2n), 0)).toBe('1');
    expect(rateToDecimalString(r(-1n, 2n), 0)).toBe('-1');
    expect(rateToDecimalString(r(1n, 3n), 0)).toBe('0');
    expect(rateToDecimalString(r(-1n, 1000n), 1)).toBe('0.0');
    expect(rateToDecimalString(r(5n, 4n), 2)).toBe('1.25');
  });

  it('writes percentages', () => {
    expect(rateToPercentString(r(1n, 4n), 1)).toBe('25.0');
    expect(rateToPercentString(r(1n, 3n), 2)).toBe('33.33');
    expect(rateToPercentString(r(2n, 3n), 0)).toBe('67');
    expect(rateToPercentString(r(-1n, 8n), 1)).toBe('-12.5');
  });

  it('refuses a bad number of decimals', () => {
    for (const bad of [-1, 21, 1.5, Number.NaN]) {
      expect(() => rateToDecimalString(ONE_RATE, bad)).toThrow(
        expect.objectContaining({ code: 'invalid_rate' }) as Error,
      );
      expect(() => rateToPercentString(ONE_RATE, bad)).toThrow();
    }
  });
});
