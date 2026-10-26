import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Gate } from '@sbn/question-bank';
import { PLANS, type PlanId } from '@/config/plans';
import { accessFor, includesFullReport, reportAccess } from './entitlements';

const NO_PREVIEW = { previewEmails: [] };
const PLAN_IDS = Object.keys(PLANS) as PlanId[];
const GATES: Gate[] = ['none', 'summary', 'standard', 'full'];

describe('accessFor', () => {
  it('gives every account the free plan until M7', () => {
    const access = accessFor({ email: 'founder@example.com' }, NO_PREVIEW);
    expect(access.planId).toBe('free');
    expect(access.entitlements).toBe(PLANS.free.entitlements);
    expect(accessFor({ email: 'founder@example.com', planId: null }, NO_PREVIEW).planId).toBe(
      'free',
    );
  });

  it.each(PLAN_IDS)('reads the entitlements of %s from the plan table', (planId) => {
    const access = accessFor({ email: 'founder@example.com', planId }, NO_PREVIEW);
    expect(access.planId).toBe(planId);
    expect(access.entitlements).toBe(PLANS[planId].entitlements);
  });

  it('puts an address on the preview list whatever its case or spacing', () => {
    const options = { previewEmails: ['owner@example.com'] };
    expect(accessFor({ email: 'owner@example.com' }, options).fullReportPreview).toBe(true);
    expect(accessFor({ email: ' Owner@Example.COM ' }, options).fullReportPreview).toBe(true);
    expect(accessFor({ email: 'other@example.com' }, options).fullReportPreview).toBe(false);
  });

  it('compares a list entry that is not lower-case too', () => {
    const options = { previewEmails: ['Owner@Example.com'] };
    expect(accessFor({ email: 'owner@example.com' }, options).fullReportPreview).toBe(true);
  });

  it('matches whole addresses only', () => {
    const options = { previewEmails: ['owner@example.com'] };
    expect(accessFor({ email: 'owner@example.com.evil.test' }, options).fullReportPreview).toBe(
      false,
    );
    expect(accessFor({ email: 'xowner@example.com' }, options).fullReportPreview).toBe(false);
  });

  it('never previews without an address, even with an empty entry in the list', () => {
    const options = { previewEmails: ['', 'owner@example.com'] };
    expect(accessFor({ email: null }, options).fullReportPreview).toBe(false);
    expect(accessFor({ email: undefined }, options).fullReportPreview).toBe(false);
    expect(accessFor({ email: '  ' }, options).fullReportPreview).toBe(false);
  });

  it('previews nobody when the list is empty', () => {
    expect(accessFor({ email: 'owner@example.com' }, NO_PREVIEW).fullReportPreview).toBe(false);
  });

  it('does not change the plan for an address on the list', () => {
    const access = accessFor(
      { email: 'owner@example.com' },
      { previewEmails: ['owner@example.com'] },
    );
    expect(access.planId).toBe('free');
    expect(includesFullReport(access)).toBe(false);
  });
});

describe('early access (D-290)', () => {
  const ON = { previewEmails: [], earlyAccess: true };

  it('opens the full report to every account, listed or not', () => {
    for (const email of ['founder@example.com', '', null, undefined]) {
      const access = accessFor({ email }, ON);
      expect(access.fullReportPreview, String(email)).toBe(true);
      expect(reportAccess('full', access)).toBe('full');
    }
  });

  it('still shows the summary only, or nothing, below the full gate', () => {
    const access = accessFor({ email: 'founder@example.com' }, ON);
    expect(reportAccess('summary', access)).toBe('summary');
    expect(reportAccess('none', access)).toBe('none');
  });

  it('changes nothing when it is off or missing', () => {
    for (const options of [{ previewEmails: [] }, { previewEmails: [], earlyAccess: false }]) {
      const access = accessFor({ email: 'founder@example.com' }, options);
      expect(access.fullReportPreview).toBe(false);
      expect(reportAccess('full', access)).toBe('summary_locked');
    }
  });

  it('does not change the plan or its entitlements', () => {
    const access = accessFor({ email: 'founder@example.com' }, ON);
    expect(access.planId).toBe('free');
    expect(access.entitlements).toBe(PLANS.free.entitlements);
    expect(includesFullReport(access)).toBe(false);
  });
});

describe('reportAccess', () => {
  const free = accessFor({ email: 'founder@example.com' }, NO_PREVIEW);
  const preview = accessFor(
    { email: 'owner@example.com' },
    { previewEmails: ['owner@example.com'] },
  );

  it('shows nothing before the summary gate, whatever the account', () => {
    for (const planId of PLAN_IDS) {
      const access = accessFor({ email: 'a@example.com', planId }, NO_PREVIEW);
      expect(reportAccess('none', access)).toBe('none');
    }
    expect(reportAccess('none', preview)).toBe('none');
  });

  it('shows the summary at the summary gate, even to the previewer', () => {
    expect(reportAccess('summary', free)).toBe('summary');
    expect(reportAccess('summary', preview)).toBe('summary');
  });

  it('locks the full report of a free account at the full gate', () => {
    expect(reportAccess('full', free)).toBe('summary_locked');
  });

  it('opens the full report of a free account on the preview list', () => {
    expect(reportAccess('full', preview)).toBe('full');
  });

  it.each(PLAN_IDS)('follows the entitlement of %s, not its name', (planId) => {
    const access = accessFor({ email: 'a@example.com', planId }, NO_PREVIEW);
    const expected = { summary: 'summary_locked', standard: 'numbers', full: 'full' } as const;
    expect(reportAccess('full', access)).toBe(expected[PLANS[planId].entitlements.report]);
  });

  it('opens the numbers report at its own gate to «استراتيجي», «قائد» and the preview (D-316)', () => {
    const at = (planId: (typeof PLAN_IDS)[number]) =>
      reportAccess('standard', accessFor({ email: null, planId }, NO_PREVIEW));
    expect(PLAN_IDS.map((planId) => [planId, at(planId)])).toEqual(
      PLAN_IDS.map((planId) => [planId, planId === 'free' ? 'summary_locked' : 'numbers']),
    );
    expect(reportAccess('standard', preview)).toBe('numbers');
  });

  it('opens the full report for «قائد» only; the course voucher opens the numbers report (D-319)', () => {
    const access = (planId: 'commander' | 'course') =>
      accessFor({ email: 'a@example.com', planId }, NO_PREVIEW);
    expect(reportAccess('full', access('commander'))).toBe('full');
    expect(reportAccess('full', access('course'))).toBe('numbers');
  });

  it('returns one of five values for every gate and account', () => {
    const accounts = [
      free,
      preview,
      ...PLAN_IDS.map((planId) => accessFor({ email: null, planId }, NO_PREVIEW)),
    ];
    for (const gate of GATES) {
      for (const access of accounts) {
        expect(['none', 'summary', 'summary_locked', 'numbers', 'full']).toContain(
          reportAccess(gate, access),
        );
      }
    }
  });
});

describe('entitlements module', () => {
  it('names no plan but the default (no branch on a plan name, CLAUDE.md §3)', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./entitlements.ts', import.meta.url)),
      'utf8',
    );
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    for (const planId of PLAN_IDS.filter((id) => id !== 'free')) {
      expect(code).not.toMatch(new RegExp(`['"]${planId}['"]`));
    }
  });
});
