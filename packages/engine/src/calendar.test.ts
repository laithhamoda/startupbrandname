import { describe, expect, it } from 'vitest';
import { addMonths, buildProjectionCalendar, referenceMonth, sumByPeriod } from './calendar';
import { makeMoney, sumMoney } from './money';

describe('referenceMonth', () => {
  it('reads a real date written YYYY-MM-DD', () => {
    expect(referenceMonth('2026-10-05')).toEqual({ year: 2026, month: 10 });
    expect(referenceMonth('2028-02-29')).toEqual({ year: 2028, month: 2 });
    expect(referenceMonth('2000-02-29')).toEqual({ year: 2000, month: 2 });
    expect(referenceMonth('2026-04-30')).toEqual({ year: 2026, month: 4 });
    expect(referenceMonth('2026-12-31')).toEqual({ year: 2026, month: 12 });
    expect(referenceMonth('1900-01-01')).toEqual({ year: 1900, month: 1 });
  });

  it.each([
    '2027-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-10-32',
    '1899-12-31',
    '2026-1-5',
    '26-10-05',
    '2026/10/05',
    '2026-10-05T00:00:00Z',
    '',
    'tomorrow',
  ])('rejects %j', (text) => {
    expect(() => referenceMonth(text)).toThrow(
      expect.objectContaining({ code: 'invalid_date' }) as Error,
    );
  });
});

describe('addMonths', () => {
  it('moves across year ends', () => {
    expect(addMonths({ year: 2026, month: 10 }, 0)).toEqual({ year: 2026, month: 10 });
    expect(addMonths({ year: 2026, month: 10 }, 1)).toEqual({ year: 2026, month: 11 });
    expect(addMonths({ year: 2026, month: 10 }, 3)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, 36)).toEqual({ year: 2029, month: 1 });
  });
});

describe('buildProjectionCalendar', () => {
  const calendar = buildProjectionCalendar('2026-10-05', 36);

  it('starts month 1 in the calendar month after the reference date', () => {
    expect(calendar.reference).toBe('2026-10-05');
    expect(calendar.months[0]).toEqual({ index: 1, year: 1, calendar: { year: 2026, month: 11 } });
    expect(calendar.months[1]?.calendar).toEqual({ year: 2026, month: 12 });
    expect(calendar.months[2]?.calendar).toEqual({ year: 2027, month: 1 });
    expect(calendar.months[11]).toEqual({
      index: 12,
      year: 1,
      calendar: { year: 2027, month: 10 },
    });
    expect(calendar.months[12]).toEqual({
      index: 13,
      year: 2,
      calendar: { year: 2027, month: 11 },
    });
    expect(calendar.months[35]).toEqual({
      index: 36,
      year: 3,
      calendar: { year: 2029, month: 10 },
    });
  });

  it('starts in January when the reference date is in December', () => {
    const december = buildProjectionCalendar('2026-12-31', 12);
    expect(december.months[0]?.calendar).toEqual({ year: 2027, month: 1 });
    expect(december.months[11]?.calendar).toEqual({ year: 2027, month: 12 });
  });

  it('has 36 months, monthly in year 1 and quarterly in years 2 and 3', () => {
    expect(calendar.horizonMonths).toBe(36);
    expect(calendar.months).toHaveLength(36);
    expect(calendar.periods).toHaveLength(20);
    expect(calendar.periods.slice(0, 12).every((period) => period.kind === 'month')).toBe(true);
    expect(calendar.periods.slice(12).every((period) => period.kind === 'quarter')).toBe(true);
    expect(calendar.periods[0]).toEqual({
      index: 1,
      kind: 'month',
      year: 1,
      firstMonth: 1,
      lastMonth: 1,
      start: { year: 2026, month: 11 },
      end: { year: 2026, month: 11 },
    });
    expect(calendar.periods[12]).toEqual({
      index: 13,
      kind: 'quarter',
      year: 2,
      firstMonth: 13,
      lastMonth: 15,
      start: { year: 2027, month: 11 },
      end: { year: 2028, month: 1 },
    });
    expect(calendar.periods[19]).toEqual({
      index: 20,
      kind: 'quarter',
      year: 3,
      firstMonth: 34,
      lastMonth: 36,
      start: { year: 2029, month: 8 },
      end: { year: 2029, month: 10 },
    });
  });

  it('covers every month exactly once, in order', () => {
    let next = 1;
    for (const period of calendar.periods) {
      expect(period.firstMonth).toBe(next);
      next = period.lastMonth + 1;
    }
    expect(next).toBe(37);
  });

  it('supports the other whole-year horizons', () => {
    expect(buildProjectionCalendar('2026-10-05', 12).periods).toHaveLength(12);
    expect(buildProjectionCalendar('2026-10-05', 24).periods).toHaveLength(16);
    expect(buildProjectionCalendar('2026-10-05', 120).periods).toHaveLength(12 + 9 * 4);
  });

  it('is deterministic', () => {
    expect(buildProjectionCalendar('2026-10-05', 36)).toEqual(calendar);
  });

  it('rejects a bad date and a bad horizon', () => {
    expect(() => buildProjectionCalendar('2026-02-30', 36)).toThrow(
      expect.objectContaining({ code: 'invalid_date' }) as Error,
    );
    for (const horizon of [0, 6, 18, 35, 132, 36.5, Number.NaN, -12]) {
      expect(() => buildProjectionCalendar('2026-10-05', horizon)).toThrow(
        expect.objectContaining({ code: 'invalid_param' }) as Error,
      );
    }
  });
});

describe('sumByPeriod', () => {
  const calendar = buildProjectionCalendar('2026-10-05', 36);
  const monthly = Array.from({ length: 36 }, (_, i) => makeMoney(BigInt(i + 1) * 1000n, 'JOD'));

  it('sums the monthly lines into the columns, so they add up to the total', () => {
    const columns = sumByPeriod(calendar, monthly, 'JOD');
    expect(columns).toHaveLength(20);
    expect(columns[0]).toEqual(makeMoney(1000n, 'JOD'));
    expect(columns[12]).toEqual(makeMoney((13n + 14n + 15n) * 1000n, 'JOD'));
    expect(sumMoney('JOD', columns)).toEqual(sumMoney('JOD', monthly));
  });

  it('needs one amount per month', () => {
    expect(() => sumByPeriod(calendar, monthly.slice(1), 'JOD')).toThrow(
      expect.objectContaining({ code: 'length_mismatch' }) as Error,
    );
  });

  it('never mixes currencies', () => {
    expect(() => sumByPeriod(calendar, monthly, 'DZD')).toThrow(
      expect.objectContaining({ code: 'currency_mismatch' }) as Error,
    );
  });
});
