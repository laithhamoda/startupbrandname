import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COMPARED_PLANS,
  COURSE_PLANS,
  HIGHLIGHTED_PLAN,
  hasFairUse,
  lowestPaidPrice,
  MENTOR_PACK,
  mentorAllowance,
  PLAN_ORDER,
  PLANS,
  REPORT_VERSIONS,
  upgradePrice,
} from './plans';

// The public pricing page must match the packages the owner set (D-313, D-314).
describe('plans', () => {
  it('charges the decided prices in USD', () => {
    expect(
      Object.fromEntries(Object.values(PLANS).map((plan) => [plan.id, plan.priceUsd])),
    ).toEqual({ free: 0, strategist: 10, commander: 30, course: 0 });
  });

  it('bills the paid packages once, for 12 months, and the course by voucher', () => {
    expect(PLANS.strategist.billing).toEqual({ kind: 'once', days: 365 });
    expect(PLANS.commander.billing).toEqual({ kind: 'once', days: 365 });
    expect(PLANS.course.billing).toEqual({ kind: 'voucher', months: 12 });
  });

  it('asks 20, 40 and 64 questions and opens the summary, the numbers report and the full one', () => {
    expect(PLANS.free.entitlements).toMatchObject({ questions: 'quick', report: 'summary' });
    expect(PLANS.strategist.entitlements).toMatchObject({
      questions: 'standard',
      report: 'standard',
    });
    expect(PLANS.commander.entitlements).toMatchObject({ questions: 'full', report: 'full' });
    // A course voucher gives «استراتيجي» (D-319).
    expect(PLANS.course.entitlements).toMatchObject({ questions: 'standard', report: 'standard' });
    expect(PLANS.course.entitlements.mentorMessages).toEqual({ kind: 'perProject', value: 10 });
  });

  it('gives the mentor 2 messages free, then 10 and 64 per project', () => {
    expect(PLANS.free.entitlements.mentorMessages).toEqual({ kind: 'count', value: 2 });
    expect(PLANS.strategist.entitlements.mentorMessages).toEqual({ kind: 'perProject', value: 10 });
    expect(PLANS.commander.entitlements.mentorMessages).toEqual({ kind: 'perProject', value: 64 });
  });

  it('covers 1 project free and the project each package is bought for (D-320)', () => {
    expect(PLANS.free.entitlements.projects).toEqual({ kind: 'count', value: 1 });
    expect(PLANS.strategist.entitlements.projects).toEqual({ kind: 'perPurchase', value: 1 });
    expect(PLANS.commander.entitlements.projects).toEqual({ kind: 'perPurchase', value: 1 });
    expect(PLANS.course.entitlements.projects.kind).toBe('unlimited');
  });

  it('keeps free projects for 30 days and paid ones 90 days read-only after the package ends', () => {
    expect(PLANS.free.entitlements.retention).toEqual({ kind: 'days', value: 30 });
    expect(PLANS.commander.entitlements.retention).toEqual({
      kind: 'subscriptionPlusReadOnly',
      days: 90,
    });
  });

  it('charges the difference to move up, and nothing to move down', () => {
    expect(upgradePrice('strategist', 'commander')).toBe(20);
    expect(upgradePrice('free', 'strategist')).toBe(10);
    expect(upgradePrice('commander', 'strategist')).toBe(0);
  });

  it('orders every package once, from the least to the most', () => {
    expect([...PLAN_ORDER].sort()).toEqual(Object.keys(PLANS).sort());
    expect(PLAN_ORDER[0]).toBe('free');
  });

  it('shows every plan once and highlights a compared one', () => {
    expect([...COMPARED_PLANS, ...COURSE_PLANS].sort()).toEqual(Object.keys(PLANS).sort());
    expect(COMPARED_PLANS).toContain(HIGHLIGHTED_PLAN);
  });

  it('quotes «استراتيجي» as the lowest paid price', () => {
    expect(lowestPaidPrice()).toBe(10);
  });
});

describe('the database seed', () => {
  const migration = (name: string) =>
    readFileSync(
      fileURLToPath(new URL(`../../../../supabase/migrations/${name}`, import.meta.url)),
      'utf8',
    );

  it('gives the free plan the same project limit as this table (D-109)', () => {
    const seeded = /\('entitlement\.free\.projects', '(\d+)'\)/.exec(
      migration('20260927200000_projects_and_answers.sql'),
    )?.[1];
    expect(PLANS.free.entitlements.projects).toEqual({ kind: 'count', value: Number(seeded) });
  });

  it('gives the course voucher the same project limit as this table (D-313, D-320)', () => {
    // A bought package covers its own project (D-320): only the course voucher still reads a limit.
    const sql = migration('20261026120000_package_project_limits.sql');
    for (const id of ['course'] as const) {
      const seeded = new RegExp(`\\('entitlement\\.${id}\\.projects', '([^']+)'\\)`).exec(sql)?.[1];
      const quota = PLANS[id].entitlements.projects;
      expect(seeded, id).toBe(quota.kind === 'count' ? String(quota.value) : '"unlimited"');
    }
  });
});

describe('hasFairUse', () => {
  it('marks no package since the course voucher gives «استراتيجي» (D-319)', () => {
    expect(
      Object.values(PLANS)
        .filter((plan) => hasFairUse(plan.entitlements))
        .map((plan) => plan.id),
    ).toEqual([]);
  });
});

describe('REPORT_VERSIONS', () => {
  it('matches the limits the database seeds (D-321)', () => {
    const sql = readFileSync(
      fileURLToPath(
        new URL(
          '../../../../supabase/migrations/20261026203000_report_versions.sql',
          import.meta.url,
        ),
      ),
      'utf8',
    );
    expect(/\('versions\.max', '(\d+)'\)/.exec(sql)?.[1]).toBe(String(REPORT_VERSIONS.max));
    expect(/\('versions\.after_go', '(\d+)'\)/.exec(sql)?.[1]).toBe(
      String(REPORT_VERSIONS.afterGo),
    );
  });
});

describe('the mentor pack (D-322)', () => {
  it('sells 10 messages for $7', () => {
    expect(MENTOR_PACK).toEqual({ id: 'mentor_pack', priceUsd: 7, messages: 10 });
  });

  it('adds its credits to the messages of the project package', () => {
    expect(mentorAllowance(PLANS.free.entitlements, 0)).toBe(2);
    expect(mentorAllowance(PLANS.strategist.entitlements, 20)).toBe(30);
    expect(mentorAllowance(PLANS.commander.entitlements, 10)).toBe(74);
    expect(
      mentorAllowance({ ...PLANS.free.entitlements, mentorMessages: { kind: 'none' } }, 10),
    ).toBe(10);
    expect(
      mentorAllowance(
        { ...PLANS.free.entitlements, mentorMessages: { kind: 'unlimited', fairUse: true } },
        10,
      ),
    ).toBeNull();
  });
});
