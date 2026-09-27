import type { Locale } from '@/i18n/routing';

/** Shown first: the verified markets, then the currencies founders in the region price in most. */
const COMMON = [
  'JOD',
  'DZD',
  'USD',
  'EUR',
  'SAR',
  'AED',
  'EGP',
  'MAD',
  'TND',
  'KWD',
  'QAR',
  'BHD',
  'OMR',
  'IQD',
  'LYD',
  'TRY',
  'GBP',
];

export interface CurrencyOption {
  value: string;
  label: string;
}

export interface CurrencyOptions {
  common: readonly CurrencyOption[];
  others: readonly CurrencyOption[];
}

const cache = new Map<Locale, CurrencyOptions>();

/**
 * Every ISO 4217 currency the runtime knows, named in the page language with its code, the common
 * ones first. Nothing is ever preselected from this list (D-111).
 */
export function currencyOptions(locale: Locale): CurrencyOptions {
  const cached = cache.get(locale);
  if (cached) return cached;
  const names = new Intl.DisplayNames([locale], { type: 'currency', fallback: 'code' });
  const collator = new Intl.Collator(locale);
  const option = (code: string) => ({ value: code, label: `${names.of(code) ?? code} (${code})` });
  const all = Intl.supportedValuesOf('currency');
  const options = {
    common: COMMON.filter((code) => all.includes(code)).map(option),
    others: all
      .filter((code) => !COMMON.includes(code))
      .map(option)
      .sort((a, b) => collator.compare(a.label, b.label)),
  };
  cache.set(locale, options);
  return options;
}
