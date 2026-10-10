import { describe, expect, it } from 'vitest';
import {
  addMoney,
  compareMoney,
  makeMoney,
  maxMoney,
  minMoney,
  moneyFromMajor,
  moneyFromMajorString,
  moneyFromSafeMinor,
  moneyToMajorString,
  moneyToSafeMinor,
  mulMoneyByRate,
  negateMoney,
  subtractMoney,
  sumMoney,
  zeroMoney,
} from './money';
import { makeRate, parseRate } from './rate';

const jod = (minor: bigint) => makeMoney(minor, 'JOD');
const dzd = (minor: bigint) => makeMoney(minor, 'DZD');

describe('makeMoney and zeroMoney', () => {
  it('holds minor units and a known currency', () => {
    expect(jod(1500n)).toEqual({ minor: 1500n, currency: 'JOD' });
    expect(zeroMoney('USD')).toEqual({ minor: 0n, currency: 'USD' });
  });

  it('refuses an unknown currency', () => {
    expect(() => makeMoney(1n, 'XYZ')).toThrow(
      expect.objectContaining({ code: 'unknown_currency' }) as Error,
    );
    expect(() => zeroMoney('dinar')).toThrow();
  });
});

describe('moneyFromMajor', () => {
  it('converts to the currency exponent: 3 for JOD, 2 for DZD, 0 for JPY', () => {
    expect(moneyFromMajor(12.5, 'JOD').minor).toBe(12500n);
    expect(moneyFromMajor(12.5, 'DZD').minor).toBe(1250n);
    expect(moneyFromMajor(250, 'JPY').minor).toBe(250n);
    expect(moneyFromMajor(-0.005, 'JOD').minor).toBe(-5n);
  });

  it('reads 0.1 + 0.2 as the 0.3 the founder meant', () => {
    expect(moneyFromMajor(0.1 + 0.2, 'JOD').minor).toBe(300n);
    expect(moneyFromMajor(0.1 + 0.2, 'DZD').minor).toBe(30n);
  });

  it('rounds half away from zero when the number has more decimals than the currency', () => {
    expect(moneyFromMajor(1.005, 'DZD').minor).toBe(101n);
    expect(moneyFromMajor(-1.005, 'DZD').minor).toBe(-101n);
    expect(moneyFromMajor(2.0004, 'JOD').minor).toBe(2000n);
    expect(moneyFromMajor(2.0005, 'JOD').minor).toBe(2001n);
    expect(moneyFromMajor(-2.0005, 'JOD').minor).toBe(-2001n);
    expect(moneyFromMajor(0.5, 'JPY').minor).toBe(1n);
    expect(moneyFromMajor(-0.5, 'JPY').minor).toBe(-1n);
    expect(moneyFromMajor(0.4, 'JPY').minor).toBe(0n);
  });

  it('handles tiny, huge and negative-zero numbers', () => {
    expect(moneyFromMajor(1e-7, 'JOD').minor).toBe(0n);
    expect(moneyFromMajor(5e-324, 'JOD').minor).toBe(0n);
    expect(moneyFromMajor(1e21, 'JOD').minor).toBe(10n ** 24n);
    expect(moneyFromMajor(1e21, 'JPY').minor).toBe(10n ** 21n);
    expect(moneyFromMajor(-0, 'JOD').minor).toBe(0n);
    expect(moneyFromMajor(0, 'JOD').minor).toBe(0n);
    expect(Object.is(Number(moneyFromMajor(-0, 'JOD').minor), 0)).toBe(true);
  });

  it('rejects NaN and the infinities', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(() => moneyFromMajor(bad, 'JOD')).toThrow(
        expect.objectContaining({ code: 'invalid_amount' }) as Error,
      );
    }
  });

  it('rejects an unknown currency before reading the amount', () => {
    expect(() => moneyFromMajor(1, 'XYZ')).toThrow(
      expect.objectContaining({ code: 'unknown_currency' }) as Error,
    );
  });
});

describe('moneyFromMajorString', () => {
  it('reads decimal text exactly', () => {
    expect(moneyFromMajorString('12.345', 'JOD').minor).toBe(12345n);
    expect(moneyFromMajorString('12.3456', 'JOD').minor).toBe(12346n);
    expect(moneyFromMajorString('-12.3455', 'JOD').minor).toBe(-12346n);
    expect(moneyFromMajorString('1.5e2', 'USD').minor).toBe(15000n);
    expect(moneyFromMajorString('7', 'JPY').minor).toBe(7n);
  });

  it('rejects text that is not a plain decimal', () => {
    for (const bad of ['', 'ten', '1,000.00', '12 JOD', 'NaN']) {
      expect(() => moneyFromMajorString(bad, 'JOD')).toThrow(
        expect.objectContaining({ code: 'invalid_amount' }) as Error,
      );
    }
  });
});

describe('moneyToMajorString', () => {
  it('writes exactly the currency decimals', () => {
    expect(moneyToMajorString(jod(12345n))).toBe('12.345');
    expect(moneyToMajorString(jod(-5n))).toBe('-0.005');
    expect(moneyToMajorString(jod(0n))).toBe('0.000');
    expect(moneyToMajorString(dzd(100n))).toBe('1.00');
    expect(moneyToMajorString(makeMoney(250n, 'JPY'))).toBe('250');
  });
});

describe('safe integers', () => {
  it('hands out minor units as a number while they are safe', () => {
    expect(moneyToSafeMinor(jod(-1234n))).toBe(-1234);
    expect(moneyToSafeMinor(jod(BigInt(Number.MAX_SAFE_INTEGER)))).toBe(Number.MAX_SAFE_INTEGER);
    expect(moneyToSafeMinor(jod(BigInt(Number.MIN_SAFE_INTEGER)))).toBe(Number.MIN_SAFE_INTEGER);
  });

  it('fails beyond Number.MAX_SAFE_INTEGER instead of losing digits', () => {
    const tooBig = jod(BigInt(Number.MAX_SAFE_INTEGER) + 1n);
    const tooSmall = jod(BigInt(Number.MIN_SAFE_INTEGER) - 1n);
    expect(() => moneyToSafeMinor(tooBig)).toThrow(
      expect.objectContaining({ code: 'unsafe_integer' }) as Error,
    );
    expect(() => moneyToSafeMinor(tooSmall)).toThrow();
    expect(() => moneyToSafeMinor(moneyFromMajor(1e21, 'JOD'))).toThrow();
  });

  it('reads minor units handed in as numbers', () => {
    expect(moneyFromSafeMinor(250, 'DZD')).toEqual(dzd(250n));
    expect(moneyFromSafeMinor(-250, 'DZD')).toEqual(dzd(-250n));
    for (const bad of [1.5, Number.NaN, Infinity, 2 ** 53]) {
      expect(() => moneyFromSafeMinor(bad, 'DZD')).toThrow(
        expect.objectContaining({ code: 'unsafe_integer' }) as Error,
      );
    }
    expect(() => moneyFromSafeMinor(1, 'XYZ')).toThrow();
  });
});

describe('arithmetic on amounts', () => {
  it('adds, subtracts and negates', () => {
    expect(addMoney(jod(1500n), jod(250n))).toEqual(jod(1750n));
    expect(subtractMoney(jod(1500n), jod(2000n))).toEqual(jod(-500n));
    expect(negateMoney(jod(1500n))).toEqual(jod(-1500n));
    expect(negateMoney(jod(0n))).toEqual(jod(0n));
  });

  it('never mixes currencies, never converts', () => {
    const mismatch = expect.objectContaining({ code: 'currency_mismatch' }) as Error;
    expect(() => addMoney(jod(1n), dzd(1n))).toThrow(mismatch);
    expect(() => subtractMoney(jod(1n), dzd(1n))).toThrow(mismatch);
    expect(() => compareMoney(jod(1n), dzd(1n))).toThrow(mismatch);
    expect(() => minMoney(jod(1n), dzd(1n))).toThrow(mismatch);
    expect(() => maxMoney(jod(1n), dzd(1n))).toThrow(mismatch);
    expect(() => sumMoney('JOD', [jod(1n), dzd(1n)])).toThrow(mismatch);
  });

  it('sums lines, and an empty list is zero in the given currency', () => {
    expect(sumMoney('JOD', [jod(100n), jod(250n), jod(-50n)])).toEqual(jod(300n));
    expect(sumMoney('JOD', [])).toEqual(jod(0n));
    expect(() => sumMoney('DZD', [jod(1n)])).toThrow();
  });

  it('compares, and picks the minimum and maximum', () => {
    expect(compareMoney(jod(1n), jod(2n))).toBe(-1);
    expect(compareMoney(jod(2n), jod(2n))).toBe(0);
    expect(compareMoney(jod(3n), jod(2n))).toBe(1);
    expect(minMoney(jod(5n))).toEqual(jod(5n));
    expect(minMoney(jod(5n), jod(-2n), jod(9n))).toEqual(jod(-2n));
    expect(maxMoney(jod(5n))).toEqual(jod(5n));
    expect(maxMoney(jod(5n), jod(-2n), jod(9n))).toEqual(jod(9n));
  });
});

describe('mulMoneyByRate', () => {
  it('multiplies by an exact rate and rounds half away from zero to the minor unit', () => {
    expect(mulMoneyByRate(jod(1_000_000n), makeRate(3n, 8n))).toEqual(jod(375_000n));
    expect(mulMoneyByRate(jod(1n), makeRate(1n, 2n))).toEqual(jod(1n));
    expect(mulMoneyByRate(jod(-1n), makeRate(1n, 2n))).toEqual(jod(-1n));
    expect(mulMoneyByRate(jod(1n), makeRate(1n, 3n))).toEqual(jod(0n));
    expect(mulMoneyByRate(jod(10n), makeRate(-1n, 4n))).toEqual(jod(-3n));
    expect(mulMoneyByRate(jod(10n), makeRate(0n, 1n))).toEqual(jod(0n));
  });

  it('applies 15% growth to 1,234.567 JOD without a binary-float error', () => {
    const grown = mulMoneyByRate(moneyFromMajor(1234.567, 'JOD'), parseRate('1.15'));
    expect(moneyToMajorString(grown)).toBe('1419.752');
  });

  it('keeps the currency', () => {
    expect(mulMoneyByRate(dzd(100n), parseRate('0.19')).currency).toBe('DZD');
  });
});
