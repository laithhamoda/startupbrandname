import { isCurrencyCode } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { currencyOptions } from './currencies';

const codeOf = (label: string) => /\(([A-Z]{3})\)$/.exec(label)?.[1];

describe.each(['ar', 'en'] as const)('currencyOptions (%s)', (locale) => {
  const { common, others } = currencyOptions(locale);
  const all = [...common, ...others];

  it('starts with the verified markets, then the region’s usual currencies', () => {
    expect(common.slice(0, 3).map((option) => option.value)).toEqual(['JOD', 'DZD', 'USD']);
  });

  it('offers each currency once, and only codes the server accepts', () => {
    expect(new Set(all.map((option) => option.value)).size).toBe(all.length);
    for (const option of all) expect(isCurrencyCode(option.value), option.value).toBe(true);
  });

  it('names each currency in the page language, with its code at the end', () => {
    for (const option of all) expect(codeOf(option.label), option.label).toBe(option.value);
  });

  it('sorts the others the way a reader of the language expects', () => {
    const collator = new Intl.Collator(locale);
    const labels = others.map((option) => option.label);
    expect(labels).toEqual([...labels].sort((a, b) => collator.compare(a, b)));
  });

  it('builds the lists once per language', () => {
    expect(currencyOptions(locale)).toBe(currencyOptions(locale));
  });
});

describe('currency names', () => {
  // Several currencies share a word ("dinar"): the code beside each name keeps them apart (§3).
  it.each([
    ['ar', 'JOD', 'دينار أردني (JOD)'],
    ['en', 'JOD', 'Jordanian Dinar (JOD)'],
    ['en', 'DZD', 'Algerian Dinar (DZD)'],
  ] as const)('in %s, %s reads "%s"', (locale, code, label) => {
    expect(currencyOptions(locale).common.find((option) => option.value === code)?.label).toBe(
      label,
    );
  });
});
