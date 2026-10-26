import { describe, expect, it } from 'vitest';
import { bestPlan, isRunning, type SubscriptionRow } from './plan-of';

const NOW = new Date('2026-10-26T12:00:00Z');

function row(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    plan_id: 'strategist',
    status: 'active',
    starts_at: '2026-10-01T00:00:00Z',
    ends_at: '2027-10-01T00:00:00Z',
    project_id: null,
    ...overrides,
  };
}

describe('isRunning', () => {
  it('runs between its start and its end', () => {
    expect(isRunning(row(), NOW)).toBe(true);
    expect(isRunning(row({ starts_at: '2026-11-01T00:00:00Z' }), NOW)).toBe(false);
    expect(isRunning(row({ ends_at: '2026-10-26T12:00:00Z' }), NOW)).toBe(false);
  });

  it('keeps a cancelled package to its end date, and a past-due renewal open', () => {
    expect(isRunning(row({ status: 'canceled' }), NOW)).toBe(true);
    expect(isRunning(row({ status: 'canceled', ends_at: null }), NOW)).toBe(false);
    expect(isRunning(row({ status: 'past_due', ends_at: null }), NOW)).toBe(true);
  });

  it('stops at once after a refund or chargeback', () => {
    expect(isRunning(row({ status: 'ended' }), NOW)).toBe(false);
  });

  it('refuses dates it cannot read', () => {
    expect(isRunning(row({ starts_at: 'soon' }), NOW)).toBe(false);
    expect(isRunning(row({ ends_at: 'later' }), NOW)).toBe(false);
  });
});

describe('bestPlan', () => {
  it('is free without a running package', () => {
    expect(bestPlan([], NOW)).toBe('free');
    expect(bestPlan([row({ status: 'ended' })], NOW)).toBe('free');
  });

  it('takes the best running package', () => {
    expect(bestPlan([row(), row({ plan_id: 'commander' })], NOW)).toBe('commander');
    expect(bestPlan([row({ plan_id: 'commander' }), row()], NOW)).toBe('commander');
    expect(bestPlan([row({ plan_id: 'course', ends_at: null }), row()], NOW)).toBe('course');
  });

  it('ignores a package bound to one project and a package the table does not know', () => {
    expect(bestPlan([row({ project_id: 'a7100000-0000-4000-8000-000000000001' })], NOW)).toBe(
      'free',
    );
    expect(bestPlan([row({ plan_id: 'weekly' })], NOW)).toBe('free');
  });
});
