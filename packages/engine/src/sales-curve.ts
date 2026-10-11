import { at } from './array';
import type { ProjectionCalendar } from './calendar';
import { EngineError } from './errors';
import { divRoundHalfAwayFromZero } from './integer';
import {
  addRates,
  compareRates,
  divideRates,
  makeRate,
  multiplyRates,
  ONE_RATE,
  powRate,
  subtractRates,
  ZERO_RATE,
  type Rate,
} from './rate';
import { rateRoot } from './root';

/**
 * F6's three points of monthly sales, in units, as exact decimals: month 1, month 6 and month 12
 * of the projection. Whether they are seasonal or not depends on the caller: the founder's own
 * points are seasonal (D-184) and `deseasonalisedPoints` takes the seasons out.
 */
export interface SalesPoints {
  readonly month1: Rate;
  readonly month6: Rate;
  readonly month12: Rate;
}

/**
 * The levels of `steps` consecutive months after a month at level `from`, the last of them exactly
 * `to`. When both are above zero the level grows (or falls) at one constant monthly rate, the
 * `steps`-th root of `to / from` at 18 decimals (`rateRoot`, D-203), so the same function applies
 * a yearly rate month by month: pass `to = from * (1 + yearly)` and 12 steps. When either is zero
 * the level changes by the same amount each month (D-184). Units: units per month, unitless
 * ratios, exact; only the interior months carry the root's error of under 10^-18 relative.
 */
export function interpolateLevels(from: Rate, to: Rate, steps: number): Rate[] {
  const positive = from.num > 0n && to.num > 0n;
  const monthly = positive ? rateRoot(divideRates(to, from), steps) : ZERO_RATE;
  return Array.from({ length: steps }, (_, index) => {
    const step = index + 1;
    if (step === steps) return to;
    return positive
      ? multiplyRates(from, powRate(monthly, step))
      : addRates(
          from,
          multiplyRates(subtractRates(to, from), makeRate(BigInt(step), BigInt(steps))),
        );
  });
}

/**
 * The yearly growth the engine assumes when the founder gave none (D-183, D-205): the growth from month 6
 * to month 12 (de-seasonalised levels), reduced to `founderShare` of itself, made yearly by
 * squaring `1 + growth` (six months twice), and held between 0 and `upperBound`. When month 6 is
 * zero there is no ratio: any month 12 above zero takes the bound, and zero stays zero. Exact.
 */
export function estimateYearlyGrowth(
  level6: Rate,
  level12: Rate,
  founderShare: Rate,
  upperBound: Rate,
): Rate {
  if (level6.num === 0n) return level12.num > 0n ? upperBound : ZERO_RATE;
  const sixMonths = subtractRates(divideRates(level12, level6), ONE_RATE);
  const kept = addRates(ONE_RATE, multiplyRates(sixMonths, founderShare));
  const yearly = subtractRates(multiplyRates(kept, kept), ONE_RATE);
  if (compareRates(yearly, ZERO_RATE) < 0) return ZERO_RATE;
  return compareRates(yearly, upperBound) > 0 ? upperBound : yearly;
}

/**
 * The yearly growth of each projection year from year 2 on, for a horizon of `years` years (so
 * `years - 1` rates). With `year3Share` null every year grows by `first`, as the founder's F6.2
 * says; with a share, year 2 grows by `first` and year 3 and later by `first * share` (D-183, D-205).
 */
export function yearlyGrowthRates(years: number, first: Rate, year3Share: Rate | null): Rate[] {
  return Array.from({ length: years - 1 }, (_, index) =>
    index === 0 || year3Share === null ? first : multiplyRates(first, year3Share),
  );
}

/**
 * Takes the seasons out of the three points: each is divided by the factor of its calendar month
 * (D-184). `factors` runs from January (index 0) to December.
 */
export function deseasonalisedPoints(
  points: SalesPoints,
  calendar: ProjectionCalendar,
  factors: readonly Rate[],
): SalesPoints {
  const levelAt = (point: Rate, month: number) =>
    divideRates(point, at(factors, at(calendar.months, month - 1).calendar.month - 1));
  return {
    month1: levelAt(points.month1, 1),
    month6: levelAt(points.month6, 6),
    month12: levelAt(points.month12, 12),
  };
}

/** What `unitCurve` hands back: one whole number of units per projection month. */
export interface UnitCurve {
  /** Units sold in each month, from month 1; never negative and never above the capacity. */
  readonly units: readonly bigint[];
  /** True for a month whose units, rounded, were above the capacity and were cut to it. */
  readonly capped: readonly boolean[];
}

/**
 * The monthly units of the whole projection (D-184, D-202, D-203). `levels` are the de-seasonalised
 * points; between them the level follows `interpolateLevels`, and each later year grows from the
 * previous year's last level by that year's rate in `yearlyGrowth` (one per year from year 2),
 * also month by month. Each month's level is multiplied back by its calendar month's factor,
 * (and by the optional scenario `multiplier`), rounded once, half away from zero, to a whole
 * number of units, and cut to `capacity` when there is one (E7), also after a multiplier above 1; a
 * month that was cut is flagged. Throws `length_mismatch` unless `yearlyGrowth` has one
 * rate per year after the first.
 */
export function unitCurve(input: {
  readonly calendar: ProjectionCalendar;
  readonly levels: SalesPoints;
  readonly factors: readonly Rate[];
  readonly yearlyGrowth: readonly Rate[];
  readonly capacity: bigint | null;
  /** A scenario multiplier on the units (T10, D-217): applied before the one rounding. Default 1. */
  readonly multiplier?: Rate;
}): UnitCurve {
  const { calendar, levels: points, factors, yearlyGrowth, capacity } = input;
  const multiplier = input.multiplier ?? ONE_RATE;
  const years = calendar.horizonMonths / 12;
  if (yearlyGrowth.length !== years - 1) {
    throw new EngineError(
      'length_mismatch',
      `Expected ${String(years - 1)} yearly growth rates, got ${String(yearlyGrowth.length)}.`,
    );
  }
  const levels: Rate[] = [
    points.month1,
    ...interpolateLevels(points.month1, points.month6, 5),
    ...interpolateLevels(points.month6, points.month12, 6),
  ];
  for (const growth of yearlyGrowth) {
    const last = at(levels, levels.length - 1);
    levels.push(...interpolateLevels(last, multiplyRates(last, addRates(ONE_RATE, growth)), 12));
  }
  const units: bigint[] = [];
  const capped: boolean[] = [];
  calendar.months.forEach((month, index) => {
    const level = at(levels, index);
    const factor = at(factors, month.calendar.month - 1);
    const rounded = divRoundHalfAwayFromZero(
      level.num * factor.num * multiplier.num,
      level.den * factor.den * multiplier.den,
    );
    const limit = capacity === null || rounded <= capacity ? rounded : capacity;
    units.push(limit);
    capped.push(limit !== rounded);
  });
  return { units, capped };
}
