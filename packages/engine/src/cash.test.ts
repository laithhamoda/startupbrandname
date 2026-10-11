import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { analyseCash } from './cash';
import { cashFlow } from './cash-flow';
import { fxTest } from './fx-test';
import { engineInputFrom, type EngineInput, type ProjectContext } from './input';
import { makeMoney } from './money';
import { createEngineParams } from './params';
import { projectOperatingLines } from './projection';
import { makeRate } from './rate';
import { taxAnalysis, type TaxRule } from './tax';

const project: ProjectContext = {
  country: 'JO',
  currency: 'JOD',
  mode: 'full',
  referenceDate: '2026-10-05',
};
const real = (value: unknown) => ({ status: 'answered' as const, value });

const answers = (more: Answers = {}): Answers => ({
  F1: real({ amount: 25, currency: 'JOD' }),
  F3: real({ items: [{ label: 'Parts', amount: 10.5, currency: 'JOD' }] }),
  F4: real({ items: [{ label: 'Rent', amount: 320.5, currency: 'JOD' }] }),
  F6: real({ month1: 10, month6: 40, month12: 100 }),
  'F6.2': real(20),
  F5: real({ items: [{ label: 'Tools', amount: 2000, currency: 'JOD' }] }),
  F7: real('credit'),
  D6: real({ answer: true, percent: 50 }),
  ...more,
});

function inputOf(more: Answers = {}): EngineInput {
  const result = engineInputFrom(answers(more), {}, project);
  if (result.status !== 'ok') throw new Error(JSON.stringify(result.reasons));
  return result.input;
}

const rule: TaxRule = {
  id: 'fixture.jo.sole.income',
  countryCode: 'JO',
  legalForm: 'sole',
  regime: 'fixture_regime',
  levy: 'income_tax',
  kind: 'tax',
  basis: 'turnover',
  rate: makeRate(1n, 50n),
  brackets: [],
  fixedAmount: null,
  minimum: null,
  turnoverCeiling: makeMoney(20_000_000n, 'JOD'),
  paymentMonth: 4,
  currency: 'JOD',
  effectiveFrom: '2020-01-01',
  sourceUrl: 'https://example.test/fixture',
  lastVerified: null,
  status: 'unverified',
};

describe('analyseCash', () => {
  const input = inputOf();
  const projection = projectOperatingLines(input);

  it('is the tax, the cash flow and the FX test of the same input, projection and rules', () => {
    const context = { rules: [rule] };
    const analysis = analyseCash(input, projection, context);
    const tax = taxAnalysis(input, projection, context);
    expect(analysis.tax).toEqual(tax);
    expect(analysis.cashFlow).toEqual(cashFlow(input, projection, tax));
    expect(analysis.fxTest).toEqual(fxTest(input, undefined, context));
    expect(analysis.alerts).toBe(analysis.tax.alerts);
    expect(analysis.alerts.map((alert) => alert.code)).toEqual([
      'turnover_above_regime_ceiling',
      'turnover_above_regime_ceiling',
    ]);
  });

  it('calculates before tax, and says so, when the caller knows no rules', () => {
    const analysis = analyseCash(input, projection);
    expect(analysis.tax.status).toBe('not_calculated');
    expect(analysis.alerts.map((alert) => alert.code)).toEqual(['tax_regime_not_calculated']);
    expect(analysis.cashFlow).toMatchObject({ status: 'ok', taxIncluded: false });
  });

  it('follows the engine parameters', () => {
    const params = createEngineParams();
    expect(analyseCash(input, projection, undefined, params)).toEqual(
      analyseCash(input, projection),
    );
  });

  it('has no FX test without D6', () => {
    const plain = inputOf({ D6: real({ answer: false }) });
    expect(analyseCash(plain, projectOperatingLines(plain)).fxTest).toBeNull();
  });

  it('is deterministic', () => {
    expect(analyseCash(input, projection, { rules: [rule] })).toEqual(
      analyseCash(input, projection, { rules: [rule] }),
    );
  });
});
