import { currencyExponent, type CurrencyCode } from './currency';
import { EngineError } from './errors';
import { divRoundHalfAwayFromZero, formatScaled, parseDecimal, pow10 } from './integer';
import type { Rate } from './rate';

/**
 * An amount of money: a whole number of the currency's minor unit and the currency itself
 * (D-179). Minor units are the ISO 4217 smallest unit (fils for JOD, centimes for DZD, cents for
 * USD), held as a `bigint` so that no operation overflows or drifts. Every operation on two
 * amounts requires the same currency: the engine never converts or infers one.
 */
export interface Money {
  /** Whole minor units; negative for a cost or a loss. */
  readonly minor: bigint;
  /** ISO 4217 code, always one the engine knows. */
  readonly currency: CurrencyCode;
}

/**
 * An amount from whole minor units. Units: minor units of `currency`. Throws `unknown_currency`
 * for a code outside the exponent table. Nothing is rounded.
 */
export function makeMoney(minor: bigint, currency: CurrencyCode): Money {
  currencyExponent(currency);
  return { minor, currency };
}

/** Zero in a currency. Units: minor units of `currency`. */
export function zeroMoney(currency: CurrencyCode): Money {
  return makeMoney(0n, currency);
}

/**
 * Converts a stored major-unit number (what an answer holds: 12.5 JOD) to minor units, once, at
 * the engine's boundary. The number is read as its shortest decimal form, which is what the
 * founder typed: 0.1 + 0.2 is 0.30000000000000004 and becomes 300 fils, 1.005 becomes 101 cents,
 * 1e-7 becomes 0 and 1e21 stays exact. If the number has more decimals than the currency, it is
 * rounded half away from zero to the minor unit (D-179); negative zero is zero.
 *
 * Units: major units in, minor units out. Throws `invalid_amount` for NaN and the infinities, and
 * `unknown_currency` for a code the engine does not know.
 */
export function moneyFromMajor(amount: number, currency: CurrencyCode): Money {
  if (!Number.isFinite(amount)) {
    throw new EngineError('invalid_amount', 'An amount must be a finite number.');
  }
  return moneyFromMajorString(String(amount), currency);
}

/**
 * Converts a decimal string in major units ("12.5", "-0.0005") to minor units, with the same
 * rounding as `moneyFromMajor`. Throws `invalid_amount` for text that is not a plain decimal.
 */
export function moneyFromMajorString(text: string, currency: CurrencyCode): Money {
  const exponent = currencyExponent(currency);
  const decimal = parseDecimal(text);
  if (!decimal) throw new EngineError('invalid_amount', `"${text}" is not a decimal amount.`);
  const minor =
    decimal.scale <= exponent
      ? decimal.units * pow10(exponent - decimal.scale)
      : divRoundHalfAwayFromZero(decimal.units, pow10(decimal.scale - exponent));
  return { minor, currency };
}

/**
 * Writes an amount in major units as a plain decimal string with exactly the currency's number of
 * decimals and no grouping, symbol or locale: 12345 fils is "12.345", -5 fils is "-0.005", 250 JPY
 * is "250". For display and storage; the page formats it for the reader's locale.
 */
export function moneyToMajorString(money: Money): string {
  return formatScaled(money.minor, currencyExponent(money.currency));
}

/**
 * Hands an amount out of the engine as a plain number of minor units. Throws `unsafe_integer`
 * when it lies beyond `Number.MAX_SAFE_INTEGER` in either direction: the engine fails rather than
 * lose digits silently.
 */
export function moneyToSafeMinor(money: Money): number {
  if (
    money.minor > BigInt(Number.MAX_SAFE_INTEGER) ||
    money.minor < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new EngineError('unsafe_integer', 'The amount is beyond the safe integer range.');
  }
  return Number(money.minor);
}

/**
 * Reads a number of minor units handed in from outside the engine. Throws `unsafe_integer` unless
 * it is a safe integer.
 */
export function moneyFromSafeMinor(minor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(minor)) {
    throw new EngineError('unsafe_integer', 'Minor units must be a safe integer.');
  }
  return makeMoney(BigInt(minor), currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new EngineError(
      'currency_mismatch',
      `Cannot combine ${a.currency} with ${b.currency}: the engine never converts.`,
    );
  }
}

/** `a + b`. Throws `currency_mismatch` unless both amounts share a currency. */
export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minor: a.minor + b.minor, currency: a.currency };
}

/** `a - b`. Throws `currency_mismatch` unless both amounts share a currency. */
export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minor: a.minor - b.minor, currency: a.currency };
}

/** `-a`: a cost becomes a receipt and the other way round. */
export function negateMoney(a: Money): Money {
  return { minor: -a.minor, currency: a.currency };
}

/**
 * The total of a list of amounts, which may be empty (then zero in `currency`). Totals of rounded
 * lines are sums of those lines, so a table always adds up (D-179). Throws `currency_mismatch`
 * when an amount is in another currency.
 */
export function sumMoney(currency: CurrencyCode, amounts: readonly Money[]): Money {
  return amounts.reduce(addMoney, zeroMoney(currency));
}

/** Orders two amounts of one currency: -1 when `a < b`, 0 when equal, 1 when `a > b`. */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.minor === b.minor) return 0;
  return a.minor < b.minor ? -1 : 1;
}

/** The smaller of the amounts. Throws `currency_mismatch` for mixed currencies. */
export function minMoney(first: Money, ...rest: readonly Money[]): Money {
  return rest.reduce((low, next) => (compareMoney(next, low) < 0 ? next : low), first);
}

/** The larger of the amounts. Throws `currency_mismatch` for mixed currencies. */
export function maxMoney(first: Money, ...rest: readonly Money[]): Money {
  return rest.reduce((high, next) => (compareMoney(next, high) > 0 ? next : high), first);
}

/**
 * An amount times an exact rate, rounded half away from zero to the minor unit (D-179). This is
 * the rounding of a monthly line: 1000.000 JOD at 3/8 is 375.000, and 0.001 JOD at 1/2 is 0.001.
 * Units: minor units in and out; the rate is unitless.
 */
export function mulMoneyByRate(money: Money, rate: Rate): Money {
  return {
    minor: divRoundHalfAwayFromZero(money.minor * rate.num, rate.den),
    currency: money.currency,
  };
}
