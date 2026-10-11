import { EngineError } from './errors';
import { makeRate, type Rate } from './rate';

/** Digits after the point at which `rateRoot` works (D-203). */
export const ROOT_RESOLUTION_DIGITS = 18;

/** `10^ROOT_RESOLUTION_DIGITS`: the denominator of every root `rateRoot` returns (D-203). */
export const ROOT_RESOLUTION: bigint = 10n ** BigInt(ROOT_RESOLUTION_DIGITS);

function requireDegree(n: number): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new EngineError(
      'invalid_rate',
      'The degree of a root must be a whole number of 1 or more.',
    );
  }
}

/**
 * The integer part of the `n`-th root of a non-negative whole number, by Newton's method on
 * integers only: the largest `r` with `r^n <= value`. Throws `invalid_rate` for a negative value or
 * a degree that is not a whole number of at least 1.
 */
export function nthRootFloor(value: bigint, n: number): bigint {
  requireDegree(n);
  if (value < 0n) throw new EngineError('invalid_rate', 'A negative number has no real root.');
  if (value < 2n || n === 1) return value;
  const degree = BigInt(n);
  // 2^ceil(bits / n) is never below the root, and Newton's iteration then falls monotonically to it.
  let guess = 1n << BigInt(Math.ceil(value.toString(2).length / n));
  for (;;) {
    const next = ((degree - 1n) * guess + value / guess ** (degree - 1n)) / degree;
    if (next >= guess) return guess;
    guess = next;
  }
}

/**
 * The `n`-th root of a non-negative rate as an exact rate whose denominator is `ROOT_RESOLUTION`,
 * computed with whole numbers only (no binary floating point). It is rounded down: the result is
 * below the true root by less than 10^-18, so its `n`-th power is below the rate by less than
 * `n * 10^-18` relative to the rate when the root is at least 1, which is every yearly growth the
 * engine applies month by month (D-203). Exact roots, such as the square root of 1.44, are exact.
 * Throws `invalid_rate` for a negative rate or a degree below 1.
 */
export function rateRoot(rate: Rate, n: number): Rate {
  requireDegree(n);
  if (rate.num < 0n) throw new EngineError('invalid_rate', 'A negative rate has no real root.');
  const scaled = (rate.num * ROOT_RESOLUTION ** BigInt(n)) / rate.den;
  return makeRate(nthRootFloor(scaled, n), ROOT_RESOLUTION);
}
