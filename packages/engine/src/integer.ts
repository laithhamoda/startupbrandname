import { at } from './array';
import { EngineError } from './errors';

/** The absolute value of a bigint. */
export function absBigInt(n: bigint): bigint {
  return n < 0n ? -n : n;
}

/** The greatest common divisor of two bigints, always non-negative; `gcd(0n, 0n)` is `0n`. */
export function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = absBigInt(a);
  let y = absBigInt(b);
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** `10^exponent` as a bigint, for a non-negative integer exponent. */
export function pow10(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new EngineError('invalid_amount', 'Power of ten needs a non-negative integer.');
  }
  return 10n ** BigInt(exponent);
}

/**
 * Integer division rounded half away from zero: 5/2 is 3, -5/2 is -3, 4/3 is 1. This is the one
 * rounding rule of the engine (D-179), so rounding is symmetric around zero.
 *
 * Units: unitless; the result is in whatever unit the numerator is in.
 * Currency: none. Throws `division_by_zero` when the divisor is zero.
 */
export function divRoundHalfAwayFromZero(numerator: bigint, divisor: bigint): bigint {
  if (divisor === 0n) throw new EngineError('division_by_zero', 'Division by zero.');
  const negative = numerator < 0n !== divisor < 0n;
  const n = absBigInt(numerator);
  const d = absBigInt(divisor);
  const quotient = n / d;
  const rounded = (n % d) * 2n >= d ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/**
 * Integer division rounded up (toward positive infinity): 7/2 is 4, -7/2 is -3, 6/2 is 3. Used
 * where a count must cover a need, such as the units that cover a fixed cost (T8). Units:
 * unitless; the result is in the numerator's unit. Throws `division_by_zero` for a zero divisor.
 */
export function divCeil(numerator: bigint, divisor: bigint): bigint {
  if (divisor === 0n) throw new EngineError('division_by_zero', 'Division by zero.');
  const quotient = numerator / divisor;
  const remainder = numerator % divisor;
  return remainder !== 0n && remainder > 0n === divisor > 0n ? quotient + 1n : quotient;
}

/**
 * The middle of the values; for an even count, the mean of the two middle ones, rounded half away
 * from zero (D-201). Does not change the list it is given. Throws `length_mismatch` for an empty
 * list: a median of nothing is a bug in the caller, which must check first.
 */
export function medianBigInt(values: readonly bigint[]): bigint {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return at(sorted, middle);
  return divRoundHalfAwayFromZero(at(sorted, middle - 1) + at(sorted, middle), 2n);
}

/**
 * Writes `units / 10^decimals` as a plain decimal string with exactly `decimals` digits after the
 * point (no point when `decimals` is 0) and no exponent: 12345n, 3 gives "12.345"; -5n, 3 gives
 * "-0.005". Zero never carries a sign.
 */
export function formatScaled(units: bigint, decimals: number): string {
  const sign = units < 0n ? '-' : '';
  const digits = absBigInt(units)
    .toString()
    .padStart(decimals + 1, '0');
  if (decimals === 0) return sign + digits;
  return `${sign}${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}

/** A decimal number read exactly: `units / 10^scale`, with `scale` never negative. */
export interface ParsedDecimal {
  readonly units: bigint;
  readonly scale: number;
}

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;
const MAX_TEXT_LENGTH = 400;
const MAX_EXPONENT = 400;

/**
 * Reads a decimal string exactly, with no binary floating point in between: "0.30000000000000004",
 * "-12.5", ".5", "5.", "1e-7" and "1e+21" are all accepted. Anything else (spaces, thousands
 * separators, NaN, Infinity, an empty string) returns `null`, as do strings longer than 400
 * characters and exponents beyond 400 in size, which no JavaScript number can produce.
 */
export function parseDecimal(text: string): ParsedDecimal | null {
  if (text.length > MAX_TEXT_LENGTH) return null;
  const match = DECIMAL.exec(text);
  if (!match) return null;
  const [, sign = '', whole = '', fraction = '', exponentText = '0'] = match;
  if (whole === '' && fraction === '') return null;
  const exponent = Number(exponentText);
  if (Math.abs(exponent) > MAX_EXPONENT) return null;
  const magnitude = BigInt(whole + fraction);
  const units = sign === '-' ? -magnitude : magnitude;
  const scale = fraction.length - exponent;
  if (scale >= 0) return { units, scale };
  return { units: units * pow10(-scale), scale: 0 };
}
