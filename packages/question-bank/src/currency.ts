import { findPhrases } from './text';

/** ISO 4217 codes the runtime knows. The platform is global (D-066), so any of them is valid. */
const ISO_CODES = new Set(Intl.supportedValuesOf('currency'));

export function isCurrencyCode(code: string): boolean {
  return ISO_CODES.has(code);
}

/**
 * Words that name one currency without doubt. Deliberately short: anything not listed is never
 * guessed (CLAUDE.md §3, "never infer currency").
 */
const EXPLICIT: readonly { code: string; phrases: readonly string[] }[] = [
  { code: 'JOD', phrases: ['د.أ', 'دينار أردني', 'دينار اردني', 'jod', 'jd', 'jordanian dinar'] },
  {
    code: 'DZD',
    phrases: ['د.ج', 'دينار جزائري', 'dzd', 'da', 'algerian dinar', 'dinar algérien'],
  },
  { code: 'USD', phrases: ['دولار أمريكي', 'دولار امريكي', 'usd', 'us dollar', 'us dollars'] },
  { code: 'EUR', phrases: ['يورو', 'euro', 'euros', 'eur'] },
  { code: 'SAR', phrases: ['ريال سعودي', 'sar', 'saudi riyal'] },
  { code: 'EGP', phrases: ['جنيه مصري', 'egp', 'egyptian pound'] },
  { code: 'MAD', phrases: ['درهم مغربي', 'mad', 'moroccan dirham'] },
  { code: 'AED', phrases: ['درهم إماراتي', 'درهم اماراتي', 'aed', 'uae dirham'] },
];

/** Words shared by several currencies. Any of them without a country must be clarified. */
const AMBIGUOUS: readonly string[] = [
  'دينار',
  'دنانير',
  'dinar',
  'dinars',
  'ريال',
  'riyal',
  'rial',
  'جنيه',
  'pound',
  'pounds',
  'درهم',
  'دراهم',
  'dirham',
  'dirhams',
  'دولار',
  'dollar',
  'dollars',
  'ليرة',
  'lira',
  'مصاري',
];

/** Everyday Algerian amounts are often counted in centimes: 1 «مليون» = 10,000 DZD (D-108). */
const CENTIME_HINTS: readonly string[] = [
  'مليون',
  'ملايين',
  'مليار',
  'سنتيم',
  'centime',
  'centimes',
];

export interface CurrencyReading {
  /** Currencies named without doubt in the text. */
  explicit: string[];
  /** Words that could mean several currencies and are not qualified by an explicit name. */
  ambiguous: string[];
  /** An Algerian-dinar amount that may be counted in centimes: ask before saving (D-108). */
  maybeCentimes: boolean;
}

/**
 * What a piece of text says about currency. `context` is the currency already chosen for the
 * field or project; it is never replaced by what the text suggests.
 */
export function readCurrency(text: string, context?: string): CurrencyReading {
  const explicit = EXPLICIT.filter((entry) => findPhrases(text, entry.phrases).length > 0).map(
    (entry) => entry.code,
  );
  const qualified = findPhrases(
    text,
    EXPLICIT.flatMap((entry) => entry.phrases),
  );
  // "دينار أردني" qualifies "دينار"; a bare "دينار" elsewhere in the text still counts.
  const ambiguous =
    qualified.length > 0 && explicit.length > 0
      ? findPhrases(text, AMBIGUOUS).filter(
          (word) => !qualified.some((phrase) => phrase.includes(word)),
        )
      : findPhrases(text, AMBIGUOUS);
  const dinars = context === 'DZD' || explicit.includes('DZD');
  return {
    explicit,
    ambiguous,
    maybeCentimes: dinars && findPhrases(text, CENTIME_HINTS).length > 0,
  };
}
