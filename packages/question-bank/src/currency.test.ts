import { describe, expect, it } from 'vitest';
import { isCurrencyCode, readCurrency } from './currency';

describe('currency codes', () => {
  it('accepts any ISO 4217 code the runtime knows', () => {
    for (const code of ['JOD', 'DZD', 'USD', 'EUR', 'SAR', 'EGP', 'MAD', 'TND']) {
      expect(isCurrencyCode(code), code).toBe(true);
    }
    expect(isCurrencyCode('ABC')).toBe(false);
    expect(isCurrencyCode('jod')).toBe(false);
  });
});

describe('readCurrency (never infer a currency, CLAUDE.md §3)', () => {
  it.each([
    ['300 دينار', 'دينار'],
    ['50 ريال', 'ريال'],
    ['20 جنيه', 'جنيه'],
    ['100 درهم', 'درهم'],
    ['40 dollars', 'dollars'],
    ['10 ليرة', 'ليرة'],
    ['شوية مصاري', 'مصاري'],
  ])('flags "%s" as ambiguous', (text, word) => {
    expect(readCurrency(text).ambiguous).toEqual([word]);
  });

  it('accepts a currency named without doubt', () => {
    expect(readCurrency('300 دينار أردني')).toEqual({
      explicit: ['JOD'],
      ambiguous: [],
      maybeCentimes: false,
    });
    expect(readCurrency('250 د.أ').explicit).toEqual(['JOD']);
    expect(readCurrency('1200 DA').explicit).toEqual(['DZD']);
    expect(readCurrency('40 US dollars').ambiguous).toEqual([]);
  });

  it('asks dinars or centimes for Algerian amounts said in millions (D-108)', () => {
    expect(readCurrency('5 مليون', 'DZD').maybeCentimes).toBe(true);
    expect(readCurrency('200 سنتيم', 'DZD').maybeCentimes).toBe(true);
    expect(readCurrency('5 مليون دينار جزائري').maybeCentimes).toBe(true);
    expect(readCurrency('5 مليون', 'JOD').maybeCentimes).toBe(false);
    expect(readCurrency('5000', 'DZD').maybeCentimes).toBe(false);
  });
});
