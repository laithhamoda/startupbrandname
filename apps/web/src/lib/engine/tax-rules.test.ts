import { runEngine } from '@sbn/engine';
import { sampleAnswers } from '@sbn/question-bank/testing';
import { describe, expect, it } from 'vitest';
import { rateFromFraction, type TaxRuleRow, toTaxRule, toTaxRules } from './tax-rules';

const row = (changes: Partial<TaxRuleRow> = {}): TaxRuleRow => ({
  id: '3f5c1e0a-0b9e-4a53-8f55-2f0f6a9c1111',
  country_code: 'JO',
  legal_form: 'sole',
  regime: 'simple',
  levy: 'income_tax',
  kind: 'tax',
  basis: 'turnover',
  rate: '1/20',
  brackets: [],
  fixed_amount: null,
  min_amount: null,
  ceiling: null,
  currency: 'JOD',
  payment_month: 4,
  effective_from: '2026-01-01',
  source_url: 'https://example.test/rules/jo',
  last_verified: '2026-09-01',
  status: 'verified',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...changes,
});

describe('rateFromFraction (D-243)', () => {
  it('builds an exact rate from the two integers, in lowest terms', () => {
    expect(rateFromFraction('1/20')).toEqual({ num: 1n, den: 20n });
    expect(rateFromFraction('2/4')).toEqual({ num: 1n, den: 2n });
    expect(rateFromFraction('0/7')).toEqual({ num: 0n, den: 1n });
  });

  it('keeps digits a float could not hold', () => {
    expect(rateFromFraction('12345678901234567890/24691357802469135780')).toEqual({
      num: 1n,
      den: 2n,
    });
  });

  it.each(['1/0', '0.05', '5%', '-1/2', '1/-2', ' 1/2', '1/2 ', '', '1'])('refuses %j', (text) => {
    expect(() => rateFromFraction(text)).toThrow(/fraction/);
  });
});

describe('toTaxRule (D-243)', () => {
  it('maps a flat rate on turnover one to one', () => {
    expect(toTaxRule(row())).toEqual({
      id: '3f5c1e0a-0b9e-4a53-8f55-2f0f6a9c1111',
      countryCode: 'JO',
      legalForm: 'sole',
      regime: 'simple',
      levy: 'income_tax',
      kind: 'tax',
      basis: 'turnover',
      rate: { num: 1n, den: 20n },
      brackets: [],
      fixedAmount: null,
      minimum: null,
      turnoverCeiling: null,
      paymentMonth: 4,
      currency: 'JOD',
      effectiveFrom: '2026-01-01',
      sourceUrl: 'https://example.test/rules/jo',
      lastVerified: '2026-09-01',
      status: 'verified',
    });
  });

  it('turns the amounts into money in minor units, and the ceiling into the turnover ceiling', () => {
    const rule = toTaxRule(
      row({ min_amount: 150_000, ceiling: 60_000_000, currency: 'DZD', country_code: 'DZ' }),
    );
    expect(rule.minimum).toEqual({ minor: 150_000n, currency: 'DZD' });
    expect(rule.turnoverCeiling).toEqual({ minor: 60_000_000n, currency: 'DZD' });
    expect(rule.fixedAmount).toBeNull();
  });

  it('maps marginal brackets, the last one open, with each rate from its fraction', () => {
    const rule = toTaxRule(
      row({
        basis: 'profit',
        rate: null,
        brackets: [
          { up_to: '1500000', rate: '1/10' },
          { up_to: '3000000', rate: '3/20' },
          { up_to: null, rate: '1/5' },
        ],
      }),
    );
    expect(rule.rate).toBeNull();
    expect(rule.brackets).toEqual([
      { upTo: { minor: 1_500_000n, currency: 'JOD' }, rate: { num: 1n, den: 10n } },
      { upTo: { minor: 3_000_000n, currency: 'JOD' }, rate: { num: 3n, den: 20n } },
      { upTo: null, rate: { num: 1n, den: 5n } },
    ]);
  });

  it('maps a fixed amount of a social contribution', () => {
    const rule = toTaxRule(
      row({
        kind: 'social_contribution',
        basis: 'fixed',
        rate: null,
        fixed_amount: 24_000,
        legal_form: 'company',
      }),
    );
    expect(rule).toMatchObject({
      kind: 'social_contribution',
      basis: 'fixed',
      legalForm: 'company',
      rate: null,
      fixedAmount: { minor: 24_000n, currency: 'JOD' },
    });
  });

  it.each(['unverified', 'under_review', 'stale'])(
    'reads the status %s as unverified, so its figures stay external and low confidence',
    (status) => {
      expect(toTaxRule(row({ status })).status).toBe('unverified');
    },
  );

  it('keeps a missing verification date as null', () => {
    expect(toTaxRule(row({ status: 'unverified', last_verified: null })).lastVerified).toBeNull();
  });

  it.each([
    ['a currency the engine does not know', { currency: 'ZZZ' }],
    ['a rate that is not a fraction', { rate: '0.05' }],
    ['an amount a number cannot hold', { basis: 'fixed', rate: null, fixed_amount: 2 ** 60 }],
    ['a verified rule with no verification date', { last_verified: null }],
    [
      'a bracket list with an unknown part',
      { rate: null, brackets: [{ up_to: null, rate: '1/5', extra: 1 }] },
    ],
    ['brackets that do not end open', { rate: null, brackets: [{ up_to: '100', rate: '1/5' }] }],
    ['a legal form the engine lacks', { legal_form: 'ngo' }],
    ['a basis the engine lacks', { basis: 'wealth' }],
    ['a kind the engine lacks', { kind: 'fee' }],
    ['a payment month out of range', { payment_month: 13 }],
  ] as const)('refuses %s', (_name, changes) => {
    expect(() => toTaxRule(row(changes as Partial<TaxRuleRow>))).toThrow();
  });
});

describe('toTaxRules', () => {
  it('is an empty list for an empty table, the case until step 4', () => {
    expect(toTaxRules([])).toEqual({ rules: [], skipped: 0 });
  });

  it('skips a row the engine cannot read and counts it', () => {
    const { rules, skipped } = toTaxRules([
      row(),
      row({ id: 'bad', currency: 'ZZZ' }),
      row({ id: 'second', levy: 'social_security' }),
    ]);
    expect(rules.map((rule) => rule.levy)).toEqual(['income_tax', 'social_security']);
    expect(skipped).toBe(1);
  });

  it('gives the engine a regime to calculate', () => {
    const answers = sampleAnswers();
    const context = {
      country: 'JO',
      currency: 'JOD',
      mode: 'full',
      referenceDate: '2026-10-12',
    } as const;
    const without = runEngine(answers, {}, context, { rules: [] });
    const withRule = runEngine(answers, {}, context, { rules: toTaxRules([row()]).rules });
    expect(without.status === 'ok' && without.run.cash.tax.status).toBe('not_calculated');
    expect(withRule.status === 'ok' && withRule.run.cash.tax.status).toBe('calculated');
  });
});
