export type PrintLocale = 'ar' | 'en';

export type Direction = 'rtl' | 'ltr';

/** One document has one language and one direction; the page never mixes them at the root. */
export function directionOf(locale: PrintLocale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
