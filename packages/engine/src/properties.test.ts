import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildProjectionCalendar, sumByPeriod } from './calendar';
import { CURRENCY_EXPONENTS, currencyExponent } from './currency';
import { divRoundHalfAwayFromZero } from './integer';
import {
  makeMoney,
  moneyFromMajor,
  moneyFromMajorString,
  moneyToMajorString,
  mulMoneyByRate,
  negateMoney,
  sumMoney,
} from './money';
import {
  addRates,
  compareRates,
  divideRates,
  makeRate,
  multiplyRates,
  negateRate,
  parseRate,
  powRate,
  rateToDecimalString,
  subtractRates,
  ZERO_RATE,
} from './rate';

// Each run explores new random cases. A failure prints its seed and path: replay it with
// fc.assert(property, { seed, path }) (add them as the second argument), then keep the case as an
// example test beside the property.
const currencies = [...CURRENCY_EXPONENTS.keys()];
const currency = fc.constantFrom(...currencies);
const bigInts = fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n });
const nonZero = bigInts.filter((n) => n !== 0n);
const positive = fc.bigInt({ min: 1n, max: 10n ** 12n });
const rate = fc.tuple(bigInts, positive).map(([num, den]) => makeRate(num, den));
const nonZeroRate = fc.tuple(nonZero, positive).map(([num, den]) => makeRate(num, den));
const amount = fc.tuple(bigInts, currency).map(([minor, code]) => makeMoney(minor, code));

describe('rounding is symmetric around zero', () => {
  it('rounds -x to the negative of x, and never by more than half a unit', () => {
    fc.assert(
      fc.property(bigInts, nonZero, (n, d) => {
        const q = divRoundHalfAwayFromZero(n, d);
        expect(divRoundHalfAwayFromZero(-n, d)).toBe(-q);
        expect(divRoundHalfAwayFromZero(n, -d)).toBe(-q);
        const error = (q * d - n) * 2n;
        expect((error < 0n ? -error : error) <= (d < 0n ? -d : d)).toBe(true);
      }),
    );
  });

  it('applies to an amount times a rate', () => {
    fc.assert(
      fc.property(amount, rate, (money, r) => {
        expect(mulMoneyByRate(negateMoney(money), r)).toEqual(
          negateMoney(mulMoneyByRate(money, r)),
        );
        expect(mulMoneyByRate(money, negateRate(r))).toEqual(negateMoney(mulMoneyByRate(money, r)));
      }),
    );
  });

  it('is exact when the product is a whole minor unit', () => {
    fc.assert(
      fc.property(bigInts, positive, (n, k) => {
        expect(divRoundHalfAwayFromZero(n * k, k)).toBe(n);
      }),
    );
  });
});

describe('the sum of rounded monthly lines is the reported total', () => {
  const lines = fc.array(bigInts, { minLength: 36, maxLength: 36 });

  it('adds up across months, quarters and years', () => {
    const calendar = buildProjectionCalendar('2026-10-05', 36);
    fc.assert(
      fc.property(lines, rate, currency, (minors, r, code) => {
        const monthly = minors.map((minor) => mulMoneyByRate(makeMoney(minor, code), r));
        const total = sumMoney(code, monthly);
        const columns = sumByPeriod(calendar, monthly, code);
        expect(sumMoney(code, columns)).toEqual(total);
        const year1 = sumMoney(code, columns.slice(0, 12));
        const year2 = sumMoney(code, columns.slice(12, 16));
        const year3 = sumMoney(code, columns.slice(16));
        expect(sumMoney(code, [year1, year2, year3])).toEqual(total);
        expect(sumMoney(code, monthly.slice(0, 12))).toEqual(year1);
      }),
    );
  });

  it('does not depend on the order of the lines', () => {
    fc.assert(
      fc.property(lines, currency, (minors, code) => {
        const monthly = minors.map((minor) => makeMoney(minor, code));
        expect(sumMoney(code, [...monthly].reverse())).toEqual(sumMoney(code, monthly));
      }),
    );
  });
});

describe('major to minor to major is exact', () => {
  it('round-trips the decimal string for any amount', () => {
    fc.assert(
      fc.property(amount, (money) => {
        const text = moneyToMajorString(money);
        expect(moneyFromMajorString(text, money.currency)).toEqual(money);
        expect(moneyToMajorString(moneyFromMajorString(text, money.currency))).toBe(text);
      }),
    );
  });

  it('round-trips a stored number with at most the currency decimals', () => {
    fc.assert(
      fc.property(fc.integer({ min: -(10 ** 14), max: 10 ** 14 }), currency, (minor, code) => {
        const stored = minor / 10 ** currencyExponent(code);
        expect(moneyFromMajor(stored, code)).toEqual(makeMoney(BigInt(minor), code));
        expect(Number(moneyToMajorString(makeMoney(BigInt(minor), code)))).toBe(stored);
      }),
    );
  });
});

describe('rate arithmetic is exact', () => {
  it('adds and subtracts without loss', () => {
    fc.assert(
      fc.property(rate, rate, (a, b) => {
        expect(subtractRates(addRates(a, b), b)).toEqual(a);
        expect(addRates(a, b)).toEqual(addRates(b, a));
        expect(addRates(a, negateRate(a))).toEqual(ZERO_RATE);
      }),
    );
  });

  it('multiplies and divides without loss', () => {
    fc.assert(
      fc.property(rate, nonZeroRate, rate, (a, b, c) => {
        expect(divideRates(multiplyRates(a, b), b)).toEqual(a);
        expect(multiplyRates(a, addRates(b, c))).toEqual(
          addRates(multiplyRates(a, b), multiplyRates(a, c)),
        );
      }),
    );
  });

  it('orders consistently with subtraction', () => {
    fc.assert(
      fc.property(rate, rate, (a, b) => {
        const difference = subtractRates(a, b);
        expect(compareRates(a, b)).toBe(compareRates(difference, ZERO_RATE));
        expect(compareRates(a, b)).toBe(-compareRates(b, a));
      }),
    );
  });

  it('powers agree with repeated multiplication', () => {
    fc.assert(
      fc.property(rate, fc.integer({ min: 0, max: 8 }), (a, n) => {
        let expected = makeRate(1n, 1n);
        for (let i = 0; i < n; i += 1) expected = multiplyRates(expected, a);
        expect(powRate(a, n)).toEqual(expected);
      }),
    );
  });

  it('round-trips a decimal through parsing and display', () => {
    const decimals = fc.integer({ min: 0, max: 12 });
    fc.assert(
      fc.property(bigInts, decimals, (units, scale) => {
        const text = rateToDecimalString(makeRate(units, 10n ** BigInt(scale)), scale);
        expect(parseRate(text)).toEqual(makeRate(units, 10n ** BigInt(scale)));
      }),
    );
  });
});
