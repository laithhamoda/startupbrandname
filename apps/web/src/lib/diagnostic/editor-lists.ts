import type { FieldKind } from '@sbn/question-bank';
import type { Locale } from '@/i18n/routing';
import { type CountryOption, countryOptions } from '@/lib/countries';
import { type CurrencyOptions, currencyOptions } from './currencies';

/** The kinds whose editor offers the currency list: every amount, and the currency itself. */
export const CURRENCY_KINDS: ReadonlySet<FieldKind> = new Set<FieldKind>([
  'money',
  'money_range',
  'currency',
  'cost_items',
  'competitor_prices',
  'staff_plan',
]);

/** The kind whose editor offers the country list. */
export const COUNTRY_KINDS: ReadonlySet<FieldKind> = new Set<FieldKind>(['country_city']);

export interface EditorLists {
  countries?: readonly CountryOption[];
  currencies?: CurrencyOptions;
}

/**
 * The long lists a step's editor offers, for the field kinds that use them only (PERF-7). The
 * country and currency lists are about 20 KB of a step's page in Arabic, and most questions
 * use neither.
 */
export function editorLists(kind: FieldKind, locale: Locale): EditorLists {
  return {
    ...(COUNTRY_KINDS.has(kind) ? { countries: countryOptions(locale) } : {}),
    ...(CURRENCY_KINDS.has(kind) ? { currencies: currencyOptions(locale) } : {}),
  };
}
