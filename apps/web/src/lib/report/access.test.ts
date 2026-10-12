import { describe, expect, it } from 'vitest';
import { accessFor } from '@/lib/entitlements';
import { degradeWithoutRun, reportModeOf } from './access';

const ME = 'owner@example.com';

describe('reportModeOf', () => {
  const free = accessFor({ email: 'someone@example.com' }, { previewEmails: [ME] });

  it('shows nothing below the summary gate', () => {
    expect(reportModeOf('none', free)).toEqual({ access: 'none', kind: null, lockReason: null });
  });

  it('gives the summary at the summary gate, locked for the answers', () => {
    expect(reportModeOf('summary', free)).toEqual({
      access: 'summary',
      kind: 'summary',
      lockReason: 'completeness',
    });
  });

  it('gives the summary locked by the plan at the full gate to an account without the entitlement', () => {
    expect(reportModeOf('full', free)).toEqual({
      access: 'summary_locked',
      kind: 'summary',
      lockReason: 'plan',
    });
  });

  it('gives the full report at the full gate to an address on the preview list', () => {
    const owner = accessFor({ email: ME }, { previewEmails: [ME] });
    expect(reportModeOf('full', owner)).toEqual({
      access: 'full',
      kind: 'full',
      lockReason: null,
    });
  });

  it('keeps the preview from opening anything below the full gate', () => {
    const owner = accessFor({ email: ME }, { previewEmails: [ME] });
    expect(reportModeOf('summary', owner).access).toBe('summary');
    expect(reportModeOf('none', owner).access).toBe('none');
  });

  it('locks the full report when the list is empty', () => {
    const owner = accessFor({ email: ME }, { previewEmails: [] });
    expect(reportModeOf('full', owner).access).toBe('summary_locked');
  });

  it('compares the address without regard to case or surrounding spaces', () => {
    const shouting = accessFor({ email: '  OWNER@Example.COM ' }, { previewEmails: [ME] });
    expect(reportModeOf('full', shouting).access).toBe('full');
    const listed = accessFor({ email: ME }, { previewEmails: ['Owner@EXAMPLE.com'] });
    expect(reportModeOf('full', listed).access).toBe('full');
  });

  it('never opens the full report to an account without an address', () => {
    expect(reportModeOf('full', accessFor({ email: null }, { previewEmails: [ME] })).access).toBe(
      'summary_locked',
    );
    expect(
      reportModeOf('full', accessFor({ email: undefined }, { previewEmails: [''] })).access,
    ).toBe('summary_locked');
  });
});

describe('degradeWithoutRun', () => {
  const free = accessFor({ email: null }, { previewEmails: [] });
  const owner = accessFor({ email: ME }, { previewEmails: [ME] });

  it('has nothing for no access', () => {
    expect(degradeWithoutRun(reportModeOf('none', free), true)).toBeNull();
  });

  it('falls back from the full report to the summary when the run is missing', () => {
    expect(degradeWithoutRun(reportModeOf('full', owner), false)).toEqual({
      kind: 'summary',
      lockReason: 'completeness',
    });
  });

  it('keeps the full report with a run, and the summaries with or without one', () => {
    expect(degradeWithoutRun(reportModeOf('full', owner), true)).toEqual({
      kind: 'full',
      lockReason: null,
    });
    expect(degradeWithoutRun(reportModeOf('full', free), false)).toEqual({
      kind: 'summary',
      lockReason: 'plan',
    });
    expect(degradeWithoutRun(reportModeOf('summary', free), false)).toEqual({
      kind: 'summary',
      lockReason: 'completeness',
    });
  });
});
