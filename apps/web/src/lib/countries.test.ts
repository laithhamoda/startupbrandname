import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, countryOptions, isCountryCode } from './countries';

describe('COUNTRY_CODES', () => {
  it('lists the ISO 3166-1 codes except IL, plus Kosovo, once each', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });

  it('does not offer IL (D-088)', () => {
    expect(COUNTRY_CODES).not.toContain('IL');
    expect(isCountryCode('IL')).toBe(false);
  });

  it('contains only two capital letters per code', () => {
    for (const code of COUNTRY_CODES) expect(code).toMatch(/^[A-Z]{2}$/);
  });
});

describe('countryOptions', () => {
  it('names every country in Arabic', () => {
    const options = countryOptions('ar');
    expect(options.find((option) => option.value === 'JO')?.label).toBe('الأردن');
    expect(options.find((option) => option.value === 'DZ')?.label).toBe('الجزائر');
    // A name identical to its code means the runtime has no name for it.
    expect(options.filter((option) => option.label === option.value)).toEqual([]);
  });

  it('names every country in English', () => {
    const options = countryOptions('en');
    expect(options.find((option) => option.value === 'JO')?.label).toBe('Jordan');
    expect(options.filter((option) => option.label === option.value)).toEqual([]);
  });

  it('names Palestine as the owner chose, in both languages (D-088)', () => {
    expect(countryOptions('ar').find((option) => option.value === 'PS')?.label).toBe('فلسطين');
    expect(countryOptions('en').find((option) => option.value === 'PS')?.label).toBe('Palestine');
  });

  it('sorts by the name in the page language', () => {
    const labels = countryOptions('en').map((option) => option.label);
    expect(labels).toEqual([...labels].sort(new Intl.Collator('en').compare));
    expect(labels[0]).toBe('Afghanistan');
  });
});

describe('isCountryCode', () => {
  it('accepts listed codes only', () => {
    expect(isCountryCode('JO')).toBe(true);
    expect(isCountryCode('jo')).toBe(false);
    expect(isCountryCode('ZZ')).toBe(false);
  });
});
