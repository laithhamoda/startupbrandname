import { ENGINE_VERSION } from '@sbn/engine';
import { sampleAnswers } from '@sbn/question-bank/testing';
import { describe, expect, it } from 'vitest';
import { summaryOf } from './summary';
import { runOf, sampleSource } from './testing';

describe('summaryOf (D-238, D-251)', () => {
  const run = runOf();
  const summary = summaryOf(run) as Record<string, unknown>;

  it('is plain JSON: it survives being written and read back', () => {
    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });

  it('carries the engine version and the verdict with what stops or holds it back', () => {
    expect(summary.engineVersion).toBe(ENGINE_VERSION);
    expect(summary.status).toBe('ok');
    expect(summary.verdict).toEqual({
      value: run.verdict.verdict.value,
      blockers: run.verdict.blockers.map((blocker) => blocker.code),
      holdBacks: [...run.verdict.holdBacks],
    });
  });

  it('carries the score as passed over evaluated and an exact decimal, and the confidence', () => {
    expect(summary.score).toEqual({
      passed: run.feasibility.passed,
      evaluated: run.feasibility.evaluated,
      rate: expect.stringMatching(/^\d\.\d{4}$/) as unknown,
    });
    expect(summary.confidence).toBe(run.confidence.level.value);
  });

  it('writes the headline numbers as decimal strings in major units', () => {
    expect(summary.headline).toMatchObject({
      currency: 'JOD',
      fixedCostsMonthly: '8.000',
      variableCostPerUnit: '8.000',
      setupCosts: '8.000',
    });
    const headline = summary.headline as Record<string, unknown>;
    for (const key of ['revenueYear1', 'profitYear1']) {
      expect(headline[key], key).toMatch(/^-?\d+\.\d{3}$/);
    }
  });

  it('lists each alert code once', () => {
    const codes = summary.alerts as string[];
    expect(codes).toEqual([...new Set(run.alerts.map((alert) => alert.code))]);
    expect(codes).toContain('tax_regime_not_calculated');
  });

  it('leaves a headline out (null) when the project cannot support it', () => {
    // A price below the variable cost: no positive margin, so no break-even (T8 is blocked).
    const losing = runOf(
      sampleSource(
        {},
        {
          ...sampleAnswers(),
          F1: { status: 'answered', value: { amount: 5, currency: 'JOD' } },
        },
      ),
    );
    const headline = (summaryOf(losing) as { headline: Record<string, unknown> }).headline;
    expect(headline.contributionMargin).toBe('-3.000');
    expect(headline.breakEvenUnits).toBeNull();
    expect(headline.breakEvenRevenue).toBeNull();
    expect(headline.breakEvenMonth).toBeNull();
  });

  it('leaves the set-up total out when F5 is «لا أعرف»', () => {
    const run = runOf(sampleSource({}, { ...sampleAnswers(), F5: { status: 'unknown' } }));
    expect(
      (summaryOf(run) as { headline: Record<string, unknown> }).headline.setupCosts,
    ).toBeNull();
  });
});
