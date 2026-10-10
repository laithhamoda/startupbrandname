import { describe, expect, it } from 'vitest';
import {
  CURRENCY_EXPONENTS,
  ISO_AND_ICU_DIFFER,
  currencyExponent,
  isKnownCurrency,
} from './currency';

/**
 * The codes the app offers: apps/web `currencyOptions` lists `Intl.supportedValuesOf('currency')`,
 * and question-bank `isCurrencyCode` accepts the same set. The engine cannot import either (D-005),
 * so this pins the table to the runtime list they share. Pull request 3 adds a test that imports
 * both packages.
 */
const OFFERED = Intl.supportedValuesOf('currency');

function icuDigits(code: string): number {
  const options = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: code,
  }).resolvedOptions();
  return options.maximumFractionDigits ?? Number.NaN;
}

describe('currency exponent table', () => {
  it('knows the exponent of every currency the app offers', () => {
    const missing = OFFERED.filter((code) => !CURRENCY_EXPONENTS.has(code));
    // A newer Node/ICU can offer a code with no change here. The fix: add each code listed below
    // with its ISO 4217 exponent to src/currency.ts (and to ISO_AND_ICU_DIFFER if ICU disagrees).
    expect(
      missing,
      `The runtime offers currencies the engine has no exponent for. Add ${missing.join(', ')} with its ISO 4217 exponent to packages/engine/src/currency.ts.`,
    ).toEqual([]);
  });

  it('has no malformed code', () => {
    // An entry the runtime has dropped is harmless (a withdrawn currency may still be stored).
    for (const code of CURRENCY_EXPONENTS.keys()) expect(code).toMatch(/^[A-Z]{3}$/);
  });

  it('gives the verified markets and the common currencies their ISO exponents', () => {
    expect(currencyExponent('JOD')).toBe(3);
    expect(currencyExponent('DZD')).toBe(2);
    expect(currencyExponent('USD')).toBe(2);
    expect(currencyExponent('EUR')).toBe(2);
    expect(currencyExponent('KWD')).toBe(3);
    expect(currencyExponent('BHD')).toBe(3);
    expect(currencyExponent('OMR')).toBe(3);
    expect(currencyExponent('TND')).toBe(3);
    expect(currencyExponent('LYD')).toBe(3);
    expect(currencyExponent('IQD')).toBe(3);
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('KRW')).toBe(0);
    expect(currencyExponent('XOF')).toBe(0);
  });

  it('agrees with Intl.NumberFormat except for the documented list', () => {
    const disagreeing = [...CURRENCY_EXPONENTS]
      .filter(([code, exponent]) => OFFERED.includes(code) && icuDigits(code) !== exponent)
      .map(([code]) => code)
      .sort();
    for (const code of disagreeing) {
      expect(
        ISO_AND_ICU_DIFFER,
        `${code} differs from ICU: add it to ISO_AND_ICU_DIFFER in src/currency.ts.`,
      ).toContain(code);
    }
  });

  it('lists only codes whose exponent really differs from ICU in this runtime', () => {
    // A code the runtime has dropped cannot be compared and is skipped.
    for (const code of ISO_AND_ICU_DIFFER.filter((entry) => OFFERED.includes(entry))) {
      expect(
        icuDigits(code),
        `${code} now agrees with ICU: remove it from ISO_AND_ICU_DIFFER in src/currency.ts.`,
      ).not.toBe(currencyExponent(code));
    }
  });

  it('lists differences that are real ISO choices, in a table that holds them', () => {
    expect([...ISO_AND_ICU_DIFFER]).toEqual([...ISO_AND_ICU_DIFFER].sort());
    for (const code of ISO_AND_ICU_DIFFER) {
      expect(CURRENCY_EXPONENTS.has(code)).toBe(true);
      // ISO 4217 has 2 decimals for all of them but IQD, which has 3.
      expect(currencyExponent(code)).toBe(code === 'IQD' ? 3 : 2);
    }
  });
});

describe('currencyExponent and isKnownCurrency', () => {
  it('rejects an unknown code instead of guessing a precision', () => {
    expect(() => currencyExponent('XYZ')).toThrow(
      expect.objectContaining({ code: 'unknown_currency' }) as Error,
    );
    expect(() => currencyExponent('jod')).toThrow();
    expect(() => currencyExponent('')).toThrow();
    expect(() => currencyExponent('constructor')).toThrow();
  });

  it('answers whether a code is known, exactly as written', () => {
    expect(isKnownCurrency('JOD')).toBe(true);
    expect(isKnownCurrency('jod')).toBe(false);
    expect(isKnownCurrency('دينار')).toBe(false);
  });
});
