import { currencyExponent, isKnownCurrency } from '@sbn/engine';
import { describe, expect, it } from 'vitest';
import { currencyOptions } from './currencies';

// D-194: the engine cannot import from apps/, so it keeps its own table of ISO 4217 exponents.
// Every currency a founder can pick for a project must be one the engine can calculate in, or a
// project would fail only when its report is made.
describe.each(['ar', 'en'] as const)('the currencies the app offers (%s)', (locale) => {
  const { common, others } = currencyOptions(locale);
  const offered = [...common, ...others].map((option) => option.value);

  it('are the whole runtime list, not an empty one', () => {
    expect(offered.length).toBeGreaterThan(100);
  });

  it('are all known to the engine, each with a whole-number exponent of 0 to 4', () => {
    for (const code of offered) {
      expect(isKnownCurrency(code), code).toBe(true);
      const exponent = currencyExponent(code);
      expect(Number.isInteger(exponent) && exponent >= 0 && exponent <= 4, code).toBe(true);
    }
  });

  it('give the exponents the first two verified markets rely on', () => {
    expect(currencyExponent('JOD')).toBe(3);
    expect(currencyExponent('DZD')).toBe(2);
    expect(currencyExponent('USD')).toBe(2);
  });
});
