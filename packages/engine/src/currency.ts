import { EngineError } from './errors';

/**
 * An ISO 4217 alphabetic currency code in upper case, such as "JOD" or "DZD". This is a plain
 * string: the type does not stop "dinar" at compile time. A `Money` must be made with `makeMoney`,
 * `moneyFromMajor`, `moneyFromMajorString` or the engine's own functions, which check the code
 * against the exponent table (`currencyExponent` raises `unknown_currency`); never fill in a
 * `Money` object literal by hand.
 */
export type CurrencyCode = string;

const codes = (list: string): string[] => list.trim().split(/\s+/);

/** Currencies whose smallest unit is the whole unit (ISO 4217 exponent 0): amounts have no decimals. */
const ZERO_DECIMALS = codes(`
  BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX VND VUV XAF XOF XPF
`);

/**
 * Currencies divided into a thousand minor units (ISO 4217 exponent 3). ICU agrees for every one
 * of them but IQD (see `ISO_AND_ICU_DIFFER`).
 */
const THREE_DECIMALS = codes(`
  BHD IQD JOD KWD LYD OMR TND
`);

/**
 * Every other currency the app offers (ISO 4217 exponent 2). XDR and XSU are accounting units
 * with no ISO exponent; they take ICU's value of 2 so that they can be selected without failing.
 */
const TWO_DECIMALS = codes(`
  AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BMD BND BOB BRL BSD BTN
  BWP BYN BZD CAD CDF CHF CNY COP CRC CUC CUP CVE CZK DKK DOP DZD EGP ERN ETB EUR
  FJD FKP GBP GEL GHS GIP GMD GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IRR JMD KES
  KGS KHR KPW KYD KZT LAK LBP LKR LRD LSL MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR
  MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD PAB PEN PGK PHP PKR PLN QAR RON RSD RUB
  SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TOP
  TRY TTD TWD TZS UAH USD UYU UZS VES WST XCD XCG XDR XSU YER ZAR ZMW ZWG ZWL
`);

/**
 * The ISO 4217 minor-unit exponent of every currency the app offers: the number of decimals
 * between the major unit and the smallest one (D-194). The app offers the codes of
 * `Intl.supportedValuesOf('currency')` (apps/web `currencyOptions`, question-bank
 * `isCurrencyCode`); tests pin this table to that list in this package and in apps/web, so a
 * currency without a known exponent fails the build instead of being priced with a guess.
 */
export const CURRENCY_EXPONENTS: ReadonlyMap<CurrencyCode, number> = new Map([
  ...ZERO_DECIMALS.map((code): [CurrencyCode, number] => [code, 0]),
  ...THREE_DECIMALS.map((code): [CurrencyCode, number] => [code, 3]),
  ...TWO_DECIMALS.map((code): [CurrencyCode, number] => [code, 2]),
]);

/**
 * Currencies for which ICU (what `Intl.NumberFormat` reads) uses 0 decimals although ISO 4217 says
 * otherwise, because CLDR follows everyday cash practice. The engine follows ISO 4217, so that an
 * amount a founder typed with decimals keeps them: IQD has 3 in ISO, the others 2. A test checks
 * that these are the only codes where the two disagree.
 */
export const ISO_AND_ICU_DIFFER: readonly CurrencyCode[] = codes(`
  AFN ALL COP HUF IDR IQD IRR KPW LAK LBP MGA MMK PKR SLL SOS SYP YER
`);

/** Whether the engine knows this currency's exponent. Codes are matched exactly, in upper case. */
export function isKnownCurrency(code: string): boolean {
  return CURRENCY_EXPONENTS.has(code);
}

/**
 * The number of decimals of a currency's major unit: 3 for JOD, 2 for DZD and USD, 0 for JPY.
 * A minor unit is `10^-exponent` of the major unit. Throws `unknown_currency` for a code that is
 * not in the table, since inferring a currency or its precision is never allowed (CLAUDE.md §3).
 */
export function currencyExponent(code: CurrencyCode): number {
  const exponent = CURRENCY_EXPONENTS.get(code);
  if (exponent === undefined) {
    throw new EngineError('unknown_currency', `No exponent is known for currency "${code}".`);
  }
  return exponent;
}
