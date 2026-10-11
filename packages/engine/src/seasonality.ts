import { EngineError } from './errors';
import {
  compareRates,
  divideRates,
  makeRate,
  multiplyRates,
  ONE_RATE,
  subtractRates,
  ZERO_RATE,
  type Rate,
} from './rate';

/**
 * How D7 was applied: `none` when the demand is not seasonal or every month is a peak month (all
 * factors are 1); `applied` when peak months got the peak factor and the rest the share that
 * keeps the total at 12; `too_many_peaks` when the peak months would leave the others a factor of
 * zero or less, so the pattern is ignored and all factors are 1 (D-204).
 */
export type SeasonalityKind = 'none' | 'applied' | 'too_many_peaks';

/** The twelve seasonal factors of a year and how they were reached. */
export interface SeasonalFactors {
  readonly kind: SeasonalityKind;
  /** Factor of each calendar month, from January (index 0) to December (index 11). Unitless. */
  readonly factors: readonly Rate[];
}

const TWELVE = makeRate(12n, 1n);
const FLAT: readonly Rate[] = Array.from({ length: 12 }, () => ONE_RATE);

/**
 * The seasonal factor of each calendar month from D7's peak months (D-184, D-204). Each peak
 * month gets `peakFactor` (the engine parameter, default 3/2); every other month gets
 * `(12 - peaks * peakFactor) / (12 - peaks)`, so the twelve factors always add up to exactly 12 and
 * a seasonal year sells the same total as a flat one. With no peak month, or with all twelve, every
 * factor is 1. When `peaks * peakFactor` reaches 12 (eight peak months at the default) the others
 * would get zero or less, which is no seasonal pattern at all, so every factor is 1 and the kind
 * says `too_many_peaks`. A month named twice counts once. Throws `invalid_param` for a month that
 * is not a whole number from 1 to 12. Exact: the factors are rates, never floating point.
 */
export function seasonalFactors(peakMonths: readonly number[], peakFactor: Rate): SeasonalFactors {
  for (const month of peakMonths) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new EngineError('invalid_param', 'A peak month must be a whole number from 1 to 12.');
    }
  }
  const peaks = new Set(peakMonths);
  if (peaks.size === 0 || peaks.size === 12) return { kind: 'none', factors: FLAT };
  const count = makeRate(BigInt(peaks.size), 1n);
  const left = subtractRates(TWELVE, multiplyRates(count, peakFactor));
  if (compareRates(left, ZERO_RATE) <= 0) return { kind: 'too_many_peaks', factors: FLAT };
  const others = divideRates(left, subtractRates(TWELVE, count));
  const factors = Array.from({ length: 12 }, (_, index) =>
    peaks.has(index + 1) ? peakFactor : others,
  );
  return { kind: 'applied', factors };
}
