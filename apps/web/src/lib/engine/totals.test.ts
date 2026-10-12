import { sampleAnswers } from '@sbn/question-bank/testing';
import { describe, expect, it } from 'vitest';
import { runOf, sampleSource } from './testing';
import { canvasTotals } from './totals';

describe('canvasTotals (D-231)', () => {
  const arabic = {
    language: 'ar',
    currencyLabel: (code: string) => (code === 'JOD' ? 'د.أ' : code),
  } as const;

  it('gives the monthly fixed total, the variable cost of a unit and the set-up total', () => {
    expect(canvasTotals(runOf(), arabic).map(({ kind, text }) => ({ kind, text }))).toEqual([
      { kind: 'fixedMonthly', text: '8 د.أ' },
      { kind: 'variableUnit', text: '8 د.أ' },
      { kind: 'setup', text: '8 د.أ' },
    ]);
  });

  it('writes the currency after the number in the page language, with no padding zeros', () => {
    const english = { language: 'en', currencyLabel: (code: string) => code } as const;
    expect(canvasTotals(runOf(), english).map((total) => total.text)).toEqual([
      '8 JOD',
      '8 JOD',
      '8 JOD',
    ]);
  });

  it('adds the amounts of the items and keeps the cents the founder gave', () => {
    const answers = {
      ...sampleAnswers(),
      F4: {
        status: 'answered' as const,
        value: {
          items: [
            { label: 'إيجار', amount: 300.5, currency: 'JOD' },
            { label: 'إنترنت', amount: 20.25, currency: 'JOD' },
          ],
        },
      },
    };
    const totals = canvasTotals(runOf(sampleSource({}, answers)), arabic);
    expect(totals[0]).toMatchObject({ kind: 'fixedMonthly', text: '320.75 د.أ' });
  });

  it('totals the fixed costs list only: the marketing budget and the staff plan stay apart', () => {
    const answers = {
      ...sampleAnswers(),
      'F4.1': { status: 'answered' as const, value: { amount: 100, currency: 'JOD' } },
      E8: {
        status: 'answered' as const,
        value: {
          items: [{ role: 'فنّي', monthlyCost: { amount: 500, currency: 'JOD' }, startMonth: 1 }],
        },
      },
    };
    const run = runOf(sampleSource({}, answers));
    expect(run.input.marketing.value.minor).not.toBe(0n);
    expect(canvasTotals(run, arabic)[0]).toMatchObject({ kind: 'fixedMonthly', text: '8 د.أ' });
  });

  it('carries the provenance the engine gave each figure', () => {
    const run = runOf();
    const [fixed, variable, setup] = canvasTotals(run, arabic);
    expect(fixed?.provenance).toEqual({
      source: run.input.fixedCosts.source,
      confidence: run.input.fixedCosts.confidence,
      validated: run.input.fixedCosts.validated,
    });
    expect(variable?.provenance.source).toBe(run.input.variableCost.source);
    expect(setup?.provenance.source).toBe(run.input.setupCosts?.source);
  });

  it('leaves the set-up total out when there is none to add', () => {
    const run = runOf(sampleSource({}, { ...sampleAnswers(), F5: { status: 'unknown' } }));
    expect(canvasTotals(run, arabic).map((total) => total.kind)).toEqual([
      'fixedMonthly',
      'variableUnit',
    ]);
  });
});
