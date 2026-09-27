import { describe, expect, it } from 'vitest';
import { COMPARED_PLANS, COURSE_PLANS, HIGHLIGHTED_PLAN, lowestPaidPrice, PLANS } from './plans';

// The public pricing page must match the locked tables in CLAUDE.md §3 (and D-071).
describe('plans', () => {
  it('charges the locked prices in USD', () => {
    expect(
      Object.fromEntries(Object.values(PLANS).map((plan) => [plan.id, plan.priceUsd])),
    ).toEqual({ free: 0, weekly: 5, monthly: 17, annual: 150, course: 0, alumni: 15 });
  });

  it('bills each plan as locked', () => {
    expect(PLANS.weekly.billing).toEqual({ kind: 'once', days: 7 });
    expect(PLANS.monthly.billing).toEqual({ kind: 'recurring', interval: 'month' });
    expect(PLANS.annual.billing).toEqual({ kind: 'once', days: 365 });
    expect(PLANS.course.billing).toEqual({ kind: 'voucher', months: 12 });
    expect(PLANS.alumni.billing).toEqual({ kind: 'recurring', interval: 'month' });
  });

  it('limits projects, reports and mentor messages as locked', () => {
    const { free, weekly, monthly, annual } = PLANS;
    expect(free.entitlements.projects).toEqual({ kind: 'count', value: 1 });
    expect(weekly.entitlements.projects).toEqual({ kind: 'count', value: 1 });
    expect(monthly.entitlements.projects).toEqual({ kind: 'count', value: 3 });
    expect(annual.entitlements.projects.kind).toBe('unlimited');

    expect(free.entitlements.fullReport).toEqual({ kind: 'none' });
    expect(weekly.entitlements.fullReport).toEqual({ kind: 'count', value: 1 });
    expect(monthly.entitlements.fullReport.kind).toBe('unlimited');

    expect(free.entitlements.mentorMessages).toEqual({ kind: 'perDay', value: 3 });
    expect(weekly.entitlements.mentorMessages).toEqual({ kind: 'perDay', value: 10 });
    expect(monthly.entitlements.mentorMessages).toEqual({ kind: 'unlimited', fairUse: true });
  });

  it('keeps the v2 features on the locked plans only', () => {
    const on = (feature: 'competitorEnrichment' | 'pitchDeck' | 'quarterlyRefresh') =>
      Object.values(PLANS)
        .filter((plan) => plan.entitlements[feature])
        .map((plan) => plan.id);
    expect(on('competitorEnrichment')).toEqual(['monthly', 'annual', 'course', 'alumni']);
    expect(on('pitchDeck')).toEqual(['weekly', 'monthly', 'annual', 'course', 'alumni']);
    expect(on('quarterlyRefresh')).toEqual(['annual', 'course', 'alumni']);
  });

  it('gives the course plans the annual entitlements', () => {
    expect(PLANS.course.entitlements).toEqual(PLANS.annual.entitlements);
    expect(PLANS.alumni.entitlements).toEqual(PLANS.annual.entitlements);
  });

  it('keeps free projects for 30 days and paid ones 90 days read-only after the plan ends', () => {
    expect(PLANS.free.entitlements.retention).toEqual({ kind: 'days', value: 30 });
    expect(PLANS.weekly.entitlements.retention).toEqual({
      kind: 'subscriptionPlusReadOnly',
      days: 90,
    });
  });

  it('shows every plan once and highlights a compared one', () => {
    expect([...COMPARED_PLANS, ...COURSE_PLANS].sort()).toEqual(Object.keys(PLANS).sort());
    expect(COMPARED_PLANS).toContain(HIGHLIGHTED_PLAN);
  });

  it('quotes the weekly plan as the lowest paid price', () => {
    expect(lowestPaidPrice()).toBe(5);
  });
});
