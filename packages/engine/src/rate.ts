import { EngineError } from './errors';
import { divRoundHalfAwayFromZero, formatScaled, gcdBigInt, parseDecimal, pow10 } from './integer';

/**
 * An exact ratio: growth, a seasonal factor, a tax rate, a multiplier or CM% (D-179, D-193). It is
 * a fraction of two bigints in lowest terms with a positive denominator, so equal values are
 * structurally equal and no operation but display rounding ever loses precision. A rate is
 * unitless (0.25 means 25%); it has no currency and no period: the caller says whether it is
 * yearly or monthly.
 */
export interface Rate {
  /** Numerator in lowest terms; it carries the sign. */
  readonly num: bigint;
  /** Denominator in lowest terms; always positive. */
  readonly den: bigint;
}

/**
 * Builds the rate `num / den` in lowest terms. Throws `division_by_zero` when `den` is zero.
 * Unitless; nothing is rounded.
 */
export function makeRate(num: bigint, den: bigint): Rate {
  if (den === 0n) throw new EngineError('division_by_zero', 'A rate cannot have a zero divisor.');
  const divisor = gcdBigInt(num, den) * (den < 0n ? -1n : 1n);
  return { num: num / divisor, den: den / divisor };
}

/** The rate 0. */
export const ZERO_RATE: Rate = { num: 0n, den: 1n };

/** The rate 1 (100%). */
export const ONE_RATE: Rate = { num: 1n, den: 1n };

/**
 * Reads a decimal string as an exact rate: "0.25" is 1/4, "1.5" is 3/2, "1e-3" is 1/1000. The
 * text is a ratio, not a percentage: use `parsePercent` for "25". Throws `invalid_rate` for text
 * that is not a plain decimal (see `parseDecimal`).
 */
export function parseRate(text: string): Rate {
  const decimal = parseDecimal(text);
  if (!decimal) throw new EngineError('invalid_rate', `"${text}" is not a decimal rate.`);
  return makeRate(decimal.units, pow10(decimal.scale));
}

/**
 * Reads a decimal string as a percentage: "25" is the rate 1/4, "7.5" is 3/40. Throws
 * `invalid_rate` for text that is not a plain decimal.
 */
export function parsePercent(text: string): Rate {
  return divideRates(parseRate(text), makeRate(100n, 1n));
}

/**
 * Converts a stored number to the exact rate its shortest decimal form names, so 0.1 is 1/10 and
 * not the nearest binary fraction. This is the same reading of a stored number as `moneyFromMajor`
 * uses. Throws `invalid_rate` for NaN and the infinities.
 */
export function rateFromNumber(value: number): Rate {
  if (!Number.isFinite(value)) throw new EngineError('invalid_rate', 'A rate must be finite.');
  return parseRate(String(value));
}

/**
 * Converts a stored percentage (25 for 25%) to the exact rate it names. Throws `invalid_rate` for
 * NaN and the infinities.
 */
export function rateFromPercent(percent: number): Rate {
  return divideRates(rateFromNumber(percent), makeRate(100n, 1n));
}

/** `a + b`, exact. */
export function addRates(a: Rate, b: Rate): Rate {
  return makeRate(a.num * b.den + b.num * a.den, a.den * b.den);
}

/** `a - b`, exact. */
export function subtractRates(a: Rate, b: Rate): Rate {
  return makeRate(a.num * b.den - b.num * a.den, a.den * b.den);
}

/** `a * b`, exact. */
export function multiplyRates(a: Rate, b: Rate): Rate {
  return makeRate(a.num * b.num, a.den * b.den);
}

/** `a / b`, exact. Throws `division_by_zero` when `b` is zero. */
export function divideRates(a: Rate, b: Rate): Rate {
  if (b.num === 0n) throw new EngineError('division_by_zero', 'Division by a zero rate.');
  return makeRate(a.num * b.den, a.den * b.num);
}

/** `-a`, exact. */
export function negateRate(a: Rate): Rate {
  return { num: -a.num, den: a.den };
}

/**
 * `base` raised to an integer power, exact: `powRate(1.02, 12)` is the year's compound growth of a
 * 2% monthly rate. A negative power is the reciprocal, so a zero base then throws
 * `division_by_zero`. Throws `invalid_rate` when the exponent is not a safe integer, or is so large
 * that the result could not be held.
 */
export function powRate(base: Rate, exponent: number): Rate {
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000) {
    throw new EngineError('invalid_rate', 'The exponent of a rate must be an integer up to 10000.');
  }
  const magnitude = BigInt(Math.abs(exponent));
  const raised = makeRate(base.num ** magnitude, base.den ** magnitude);
  return exponent < 0 ? divideRates(ONE_RATE, raised) : raised;
}

/** Orders two rates: -1 when `a < b`, 0 when equal, 1 when `a > b`. Exact. */
export function compareRates(a: Rate, b: Rate): -1 | 0 | 1 {
  const difference = a.num * b.den - b.num * a.den;
  if (difference === 0n) return 0;
  return difference < 0n ? -1 : 1;
}

/**
 * Writes a rate as a plain decimal with exactly `decimals` digits, rounded half away from zero:
 * 1/3 with 4 decimals is "0.3333", 2/3 is "0.6667", -1/8 with 2 decimals is "-0.13". This is the
 * only place a ratio is rounded, and it is for display (D-179). `decimals` is an integer from 0 to
 * 20.
 */
export function rateToDecimalString(rate: Rate, decimals: number): string {
  assertDecimals(decimals);
  const scaled = divRoundHalfAwayFromZero(rate.num * pow10(decimals), rate.den);
  return formatScaled(scaled, decimals);
}

/**
 * Writes a rate as a percentage without the percent sign, rounded half away from zero for
 * display: 1/4 with 1 decimal is "25.0". `decimals` is an integer from 0 to 20.
 */
export function rateToPercentString(rate: Rate, decimals: number): string {
  assertDecimals(decimals);
  const scaled = divRoundHalfAwayFromZero(rate.num * 100n * pow10(decimals), rate.den);
  return formatScaled(scaled, decimals);
}

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20) {
    throw new EngineError('invalid_rate', 'Decimals must be an integer from 0 to 20.');
  }
}
