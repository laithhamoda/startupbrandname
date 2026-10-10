import type { CurrencyCode } from './currency';
import { EngineError } from './errors';
import { addMoney, zeroMoney, type Money } from './money';

/** A calendar month: `month` is 1 (January) to 12. */
export interface CalendarMonth {
  readonly year: number;
  readonly month: number;
}

/**
 * One month of the projection. `index` runs from 1 (the calendar month after the reference date)
 * to the horizon; month 0 is not in the calendar: set-up costs are paid there, before month 1
 * (D-187). `year` is the projection year (months 1 to 12 are year 1), not the calendar year.
 */
export interface ProjectionMonth {
  readonly index: number;
  readonly year: number;
  readonly calendar: CalendarMonth;
}

/**
 * One column of the projection tables (SPEC §4, T9): a single month in year 1, a quarter of three
 * months in later years. `firstMonth` and `lastMonth` are projection month indexes, inclusive.
 */
export interface ProjectionPeriod {
  /** Position among the periods, from 1. */
  readonly index: number;
  readonly kind: 'month' | 'quarter';
  /** Projection year, from 1. */
  readonly year: number;
  readonly firstMonth: number;
  readonly lastMonth: number;
  readonly start: CalendarMonth;
  readonly end: CalendarMonth;
}

/** The months and columns of a run, fixed by a reference date and a horizon. */
export interface ProjectionCalendar {
  /** The reference date as the caller passed it (YYYY-MM-DD). */
  readonly reference: string;
  readonly horizonMonths: number;
  readonly months: readonly ProjectionMonth[];
  readonly periods: readonly ProjectionPeriod[];
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Reads a reference date written as YYYY-MM-DD into its calendar month. The day must exist (not
 * 2027-02-30) and the year must be 1900 or later. No clock and no time zone are involved: the
 * engine never reads the current date (D-005), the caller passes it. Throws `invalid_date`.
 */
export function referenceMonth(referenceDate: string): CalendarMonth {
  const match = ISO_DATE.exec(referenceDate);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
      return { year, month };
    }
  }
  throw new EngineError('invalid_date', `"${referenceDate}" is not a date written YYYY-MM-DD.`);
}

/** The calendar month `offset` months after `from` (a non-negative whole number). */
export function addMonths(from: CalendarMonth, offset: number): CalendarMonth {
  const zeroBased = from.year * 12 + (from.month - 1) + offset;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/**
 * Lays out the projection: month 1 is the calendar month after the reference date, months 1 to 12
 * are monthly columns, and every later year is four quarterly columns (D-184, SPEC §4 T9). So a
 * reference date of 2026-10-05 makes month 1 November 2026, and the default 36-month horizon
 * gives 12 + 4 + 4 = 20 periods. Throws `invalid_date` for a bad date and `invalid_param` unless
 * the horizon is a multiple of 12 from 12 to 120.
 */
export function buildProjectionCalendar(
  referenceDate: string,
  horizonMonths: number,
): ProjectionCalendar {
  const reference = referenceMonth(referenceDate);
  if (
    !Number.isSafeInteger(horizonMonths) ||
    horizonMonths < 12 ||
    horizonMonths > 120 ||
    horizonMonths % 12 !== 0
  ) {
    throw new EngineError(
      'invalid_param',
      'The horizon must be a multiple of 12 months, from 12 to 120.',
    );
  }
  const months: ProjectionMonth[] = Array.from({ length: horizonMonths }, (_, offset) => ({
    index: offset + 1,
    year: Math.floor(offset / 12) + 1,
    calendar: addMonths(reference, offset + 1),
  }));
  const periods: ProjectionPeriod[] = [];
  const addPeriod = (kind: 'month' | 'quarter', firstMonth: number, lastMonth: number) =>
    periods.push({
      index: periods.length + 1,
      kind,
      year: Math.floor((firstMonth - 1) / 12) + 1,
      firstMonth,
      lastMonth,
      start: addMonths(reference, firstMonth),
      end: addMonths(reference, lastMonth),
    });
  for (let index = 1; index <= 12; index += 1) addPeriod('month', index, index);
  for (let index = 13; index <= horizonMonths; index += 3) addPeriod('quarter', index, index + 2);
  return { reference: referenceDate, horizonMonths, months, periods };
}

/**
 * Sums a monthly line (one amount per projection month, month 1 first) into the calendar's
 * columns. Each column is the sum of its already rounded monthly amounts, so the columns add up
 * to the line's total exactly (D-179). Throws `length_mismatch` unless there is one amount per
 * month, and `currency_mismatch` for an amount in another currency.
 */
export function sumByPeriod(
  calendar: ProjectionCalendar,
  monthly: readonly Money[],
  currency: CurrencyCode,
): Money[] {
  if (monthly.length !== calendar.horizonMonths) {
    throw new EngineError(
      'length_mismatch',
      `Expected ${String(calendar.horizonMonths)} monthly amounts, got ${String(monthly.length)}.`,
    );
  }
  return calendar.periods.map((period) =>
    monthly.slice(period.firstMonth - 1, period.lastMonth).reduce(addMoney, zeroMoney(currency)),
  );
}
