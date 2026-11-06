import { describe, expect, it } from 'vitest';
import { counterSchema, daysLeft } from './counter';

const NOW = Date.parse('2026-11-06T12:00:00Z');

describe('daysLeft', () => {
  it('counts a started day as a day', () => {
    expect(daysLeft('2026-11-07T11:00:00Z', NOW)).toBe(1);
    expect(daysLeft('2026-11-07T13:00:00Z', NOW)).toBe(2);
    expect(daysLeft('2027-02-03T20:59:59Z', NOW)).toBe(90);
  });

  it('is 0 once the date has passed, and null without a usable date', () => {
    expect(daysLeft('2026-11-05T00:00:00Z', NOW)).toBe(0);
    expect(daysLeft(null, NOW)).toBeNull();
    expect(daysLeft('not a date', NOW)).toBeNull();
  });
});

describe('counterSchema', () => {
  it('accepts the answer of the route and nothing looser', () => {
    const ok = { open: true, spotsLeft: 460, spotsTotal: 500, endsAt: '2027-02-03T20:59:59Z' };
    expect(counterSchema.parse(ok)).toEqual(ok);
    expect(counterSchema.safeParse({ ...ok, spotsLeft: -1 }).success).toBe(false);
    expect(counterSchema.safeParse({ ...ok, open: 'yes' }).success).toBe(false);
    expect(counterSchema.safeParse({ open: true }).success).toBe(false);
  });
});
