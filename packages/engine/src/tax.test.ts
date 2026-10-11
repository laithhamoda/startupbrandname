import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import { makeFigure } from './figure';
import { engineInputFrom, type EngineInput, type ProjectContext } from './input';
import { makeMoney, type Money } from './money';
import { projectOperatingLines, type OperatingProjection } from './projection';
import { makeRate } from './rate';
import {
  TAX_ALERT_SEVERITY,
  TAX_RULES,
  taxAnalysis,
  taxDue,
  validateTaxRule,
  type CalculatedTax,
  type TaxContext,
  type TaxRule,
} from './tax';

const jod = (units: number): Money => makeMoney(BigInt(units) * 1000n, 'JOD');
const fils = (amount: bigint): Money => makeMoney(amount, 'JOD');
const dzd = (units: number): Money => makeMoney(BigInt(units) * 100n, 'DZD');

/** A JOD tax on turnover of 2%, in force since 2020, a fixture (not verified). */
const jordan = (over: Partial<TaxRule> = {}): TaxRule => ({
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
  turnoverCeiling: null,
  paymentMonth: 4,
  currency: 'JOD',
  effectiveFrom: '2020-01-01',
  sourceUrl: 'https://example.test/fixture',
  lastVerified: null,
  status: 'unverified',
  ...over,
});

/** The Algerian auto-entrepreneur values of SPEC section 7, as an unverified fixture. */
const algerian = (): TaxRule =>
  jordan({
    id: 'fixture.dz.ae.ifu',
    countryCode: 'DZ',
    regime: 'auto_entrepreneur',
    levy: 'ifu',
    rate: makeRate(1n, 200n),
    minimum: dzd(10_000),
    turnoverCeiling: dzd(5_000_000),
    currency: 'DZD',
    paymentMonth: 3,
  });

/** First 10,000 at 5%, the next 10,000 at 10%, above that at 20%, on profit. */
const progressive = (): TaxRule =>
  jordan({
    id: 'fixture.jo.progressive',
    levy: 'progressive_income_tax',
    basis: 'profit',
    rate: null,
    brackets: [
      { upTo: jod(10_000), rate: makeRate(1n, 20n) },
      { upTo: jod(20_000), rate: makeRate(1n, 10n) },
      { upTo: null, rate: makeRate(1n, 5n) },
    ],
  });

describe('taxDue: a turnover rate with a minimum (SPEC section 7, Algeria)', () => {
  const rule = algerian();

  it('charges 0.5% of a turnover of 2,000,000: 10,000, which is the minimum itself', () => {
    // 2,000,000.00 DZD = 200,000,000 centimes; times 1/200 = 1,000,000 centimes = 10,000.00 DZD.
    const due = taxDue(rule, dzd(2_000_000), dzd(0));
    expect(due.amount).toEqual(dzd(10_000));
    expect(due.base).toEqual(dzd(2_000_000));
    expect(due.minimumApplied).toBe(false);
  });

  it('raises 5,000 to the minimum of 10,000 for a turnover of 1,000,000', () => {
    const due = taxDue(rule, dzd(1_000_000), dzd(0));
    expect(due.amount).toEqual(dzd(10_000));
    expect(due.minimumApplied).toBe(true);
  });

  it('charges 30,000 for a turnover of 6,000,000, which is above the ceiling (the alert is the analysis)', () => {
    expect(taxDue(rule, dzd(6_000_000), dzd(0)).amount).toEqual(dzd(30_000));
  });

  it('still charges the minimum for a year with no turnover (SPEC: the minimum applies when set)', () => {
    expect(taxDue(rule, dzd(0), dzd(0)).amount).toEqual(dzd(10_000));
  });

  it('ignores the profit of a turnover basis', () => {
    expect(taxDue(rule, dzd(2_000_000), dzd(-5_000_000)).amount).toEqual(dzd(10_000));
  });
});

describe('taxDue: a progressive tax on profit', () => {
  const rule = progressive();

  it('is marginal: profit 25,000 pays 500 + 1,000 + 1,000 = 2,500', () => {
    // 10,000 at 5% = 500; the next 10,000 at 10% = 1,000; the last 5,000 at 20% = 1,000.
    expect(taxDue(rule, jod(0), jod(25_000)).amount).toEqual(jod(2_500));
  });

  it('pays only the first bracket up to its limit, and only what is in each bracket after it', () => {
    expect(taxDue(rule, jod(0), jod(10_000)).amount).toEqual(jod(500));
    expect(taxDue(rule, jod(0), jod(15_000)).amount).toEqual(jod(1_000));
    expect(taxDue(rule, jod(0), jod(20_000)).amount).toEqual(jod(1_500));
    expect(taxDue(rule, jod(0), jod(4_000)).amount).toEqual(jod(200));
  });

  it('uses the larger of the profit and zero: a loss pays nothing', () => {
    const due = taxDue(rule, jod(1_000_000), jod(-5));
    expect(due.amount).toEqual(jod(0));
    expect(due.base).toEqual(jod(0));
    expect(due.minimumApplied).toBe(false);
  });

  it('applies the minimum to a loss when the rule has one', () => {
    const due = taxDue({ ...rule, minimum: jod(100) }, jod(0), jod(-5));
    expect(due.amount).toEqual(jod(100));
    expect(due.minimumApplied).toBe(true);
  });

  it('adds the brackets exactly and rounds once', () => {
    // 50% of the first fil and 50% of the second: 0.5 + 0.5 = 1 fil. Rounding each part would give 2.
    const halves = jordan({
      basis: 'profit',
      rate: null,
      brackets: [
        { upTo: fils(1n), rate: makeRate(1n, 2n) },
        { upTo: null, rate: makeRate(1n, 2n) },
      ],
    });
    expect(taxDue(halves, jod(0), fils(2n)).amount).toEqual(fils(1n));
  });
});

describe('taxDue: a flat rate, a fixed amount and the rounding', () => {
  it('rounds half away from zero to the minor unit', () => {
    const half = jordan({ rate: makeRate(1n, 2n) });
    expect(taxDue(half, fils(1n), fils(0n)).amount).toEqual(fils(1n));
    expect(taxDue(half, fils(3n), fils(0n)).amount).toEqual(fils(2n));
    const third = jordan({ rate: makeRate(1n, 3n) });
    expect(taxDue(third, jod(1), fils(0n)).amount).toEqual(fils(333n));
    expect(taxDue(third, jod(2), fils(0n)).amount).toEqual(fils(667n));
  });

  it('charges a fixed amount whatever the turnover and profit, at least the minimum', () => {
    const fixed = jordan({ basis: 'fixed', rate: null, fixedAmount: jod(300) });
    const due = taxDue(fixed, jod(90_000), jod(40_000));
    expect(due.amount).toEqual(jod(300));
    expect(due.base).toBeNull();
    expect(due.minimumApplied).toBe(false);
    expect(taxDue({ ...fixed, minimum: jod(400) }, jod(0), jod(0))).toMatchObject({
      amount: jod(400),
      minimumApplied: true,
    });
  });

  it('refuses amounts in another currency than the rule (the engine never converts)', () => {
    expect(() => taxDue(jordan(), dzd(1), dzd(1))).toThrow(
      expect.objectContaining({ code: 'currency_mismatch' }) as Error,
    );
    expect(() => taxDue(jordan(), jod(1), dzd(1))).toThrow(EngineError);
  });
});

describe('validateTaxRule', () => {
  const codeOf = (rule: TaxRule): string => {
    try {
      validateTaxRule(rule);
    } catch (error) {
      return error instanceof EngineError ? error.code : 'other';
    }
    return 'none';
  };
  const brackets = (...upTo: (Money | null)[]) =>
    upTo.map((limit) => ({ upTo: limit, rate: makeRate(1n, 10n) }));

  it('accepts the good rules', () => {
    expect(codeOf(jordan())).toBe('none');
    expect(codeOf(algerian())).toBe('none');
    expect(codeOf(progressive())).toBe('none');
    expect(
      codeOf(jordan({ status: 'verified', lastVerified: '2026-09-01', turnoverCeiling: jod(0) })),
    ).toBe('none');
    expect(codeOf(jordan({ basis: 'fixed', rate: null, fixedAmount: jod(1) }))).toBe('none');
  });

  it.each([
    ['a country code in lower case', { countryCode: 'jo' }],
    ['no id', { id: '' }],
    ['no regime', { regime: '' }],
    ['no levy', { levy: '' }],
    ['a source that is not a web address', { sourceUrl: 'ftp://example.test' }],
    ['a verified rule with no verification date', { status: 'verified' as const }],
    ['a payment month of 0', { paymentMonth: 0 }],
    ['a payment month of 13', { paymentMonth: 13 }],
    ['a payment month that is not whole', { paymentMonth: 1.5 }],
    ['a minimum in another currency', { minimum: dzd(1) }],
    ['a negative minimum', { minimum: fils(-1n) }],
    ['a ceiling in another currency', { turnoverCeiling: dzd(1) }],
    ['both a rate and brackets', { brackets: brackets(null) }],
    ['neither a rate nor brackets', { rate: null }],
    ['a fixed amount with a turnover basis', { fixedAmount: jod(1) }],
    ['a negative rate', { rate: makeRate(-1n, 10n) }],
    ['a fixed basis with no amount', { basis: 'fixed' as const, rate: null }],
    [
      'a fixed basis with a rate',
      { basis: 'fixed' as const, fixedAmount: jod(1), rate: makeRate(1n, 10n) },
    ],
    [
      'a fixed basis with brackets',
      { basis: 'fixed' as const, fixedAmount: jod(1), rate: null, brackets: brackets(null) },
    ],
    ['brackets whose last is not open', { rate: null, brackets: brackets(jod(5)) }],
    ['brackets with an open one in the middle', { rate: null, brackets: brackets(null, null) }],
    ['brackets that do not rise', { rate: null, brackets: brackets(jod(5), jod(5), null) }],
    ['brackets that start at zero', { rate: null, brackets: brackets(jod(0), null) }],
    [
      'a negative bracket rate',
      { rate: null, brackets: [{ upTo: null, rate: makeRate(-1n, 10n) }] },
    ],
  ])('refuses %s', (_name, over) => {
    expect(codeOf(jordan(over))).toBe('invalid_param');
  });

  it.each([
    ['an effective date that is no date', { effectiveFrom: '2020-13-01' }],
    ['a verification date that is no date', { lastVerified: '2020-02-30' }],
  ])('refuses %s', (_name, over) => {
    expect(codeOf(jordan(over))).toBe('invalid_date');
  });

  it('is called by taxDue', () => {
    expect(() => taxDue(jordan({ paymentMonth: 0 }), jod(1), jod(1))).toThrow(EngineError);
  });
});

// Hand-checked projection of the answers below (no inflation, no staff, no marketing). Units a month:
// year 1 is 10, 13, 17, 23, 30, 40, 47, 54, 63, 74, 86, 100 (557); year 2 is 1327; year 3 is 1593.
// Price 25 JOD, so turnover is 13,925 / 33,175 / 39,825 JOD. A unit earns 14.5 JOD over its COGS and
// the year's fixed cost is 12 * 320.5 = 3,846 JOD, so the operating profit is
// 557 * 14.5 - 3,846 = 4,230.5; 1327 * 14.5 - 3,846 = 15,395.5; 1593 * 14.5 - 3,846 = 19,252.5 JOD.
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
  ...more,
});

function build(
  more: Answers = {},
  context: ProjectContext = project,
): { input: EngineInput; projection: OperatingProjection } {
  const result = engineInputFrom(answers(more), {}, context);
  if (result.status !== 'ok') throw new Error(JSON.stringify(result.reasons));
  return { input: result.input, projection: projectOperatingLines(result.input) };
}

function analyse(
  context: TaxContext,
  more: Answers = {},
  projectContext: ProjectContext = project,
): CalculatedTax {
  const { input, projection } = build(more, projectContext);
  const result = taxAnalysis(input, projection, context);
  if (result.status !== 'calculated') throw new Error('expected a calculated tax');
  return result;
}

const amounts = (tax: CalculatedTax, pick: 'turnover' | 'profit' | 'total') =>
  tax.years.map((year) => {
    const value = year[pick];
    return 'minor' in value ? value : value.value;
  });

describe('taxAnalysis: the tax of each year of the projection', () => {
  it('reads the turnover and the profit of each projection year from the projection', () => {
    const tax = analyse({ rules: [jordan()] });
    expect(amounts(tax, 'turnover')).toEqual([jod(13_925), jod(33_175), jod(39_825)]);
    expect(amounts(tax, 'profit')).toEqual([
      fils(4_230_500n),
      fils(15_395_500n),
      fils(19_252_500n),
    ]);
    expect(tax.years.map((year) => year.year)).toEqual([1, 2, 3]);
  });

  it('charges a turnover rule on the year turnover: 2% is 278.5, 663.5 and 796.5 JOD', () => {
    const tax = analyse({ rules: [jordan()] });
    expect(amounts(tax, 'total')).toEqual([fils(278_500n), fils(663_500n), fils(796_500n)]);
    expect(tax.regime).toBe('fixture_regime');
    expect(tax.legalForm).toBe('sole');
  });

  it('charges a profit rule on the year profit: 10% is 423.05, 1539.55 and 1925.25 JOD', () => {
    const tax = analyse({ rules: [jordan({ basis: 'profit', rate: makeRate(1n, 10n) })] });
    expect(amounts(tax, 'total')).toEqual([fils(423_050n), fils(1_539_550n), fils(1_925_250n)]);
  });

  it('adds a social contribution to the tax of the same regime, tax first', () => {
    const social = jordan({
      id: 'fixture.jo.sole.social',
      levy: 'social_security',
      kind: 'social_contribution',
      basis: 'fixed',
      rate: null,
      fixedAmount: jod(300),
      paymentMonth: 1,
    });
    // Passed in the other order on purpose: the order of the result does not depend on it.
    const tax = analyse({ rules: [social, jordan()] });
    const first = tax.years[0];
    expect(first?.charges.map((charge) => charge.levy)).toEqual(['income_tax', 'social_security']);
    expect(first?.charges.map((charge) => charge.due.value)).toEqual([fils(278_500n), jod(300)]);
    expect(first?.total.value).toEqual(fils(578_500n));
    expect(first?.charges.map((charge) => charge.kind)).toEqual(['tax', 'social_contribution']);
  });

  it('pays each tax in its month of the next projection year, the last one after the horizon', () => {
    const tax = analyse({ rules: [jordan({ paymentMonth: 4 })] });
    // Year 1 accrues in months 1 to 12 and is paid in month 12 + 4; year 3 in month 36 + 4.
    expect(tax.years.map((year) => year.charges[0]?.paymentMonth)).toEqual([16, 28, 40]);
  });

  it('reports the base and whether the minimum applied on each charge', () => {
    const tax = analyse({ rules: [jordan({ minimum: jod(300) })] });
    const charges = tax.years.map((year) => year.charges[0]);
    // 278.5 is raised to 300; 663.5 and 796.5 are above it.
    expect(charges.map((charge) => charge?.minimumApplied)).toEqual([true, false, false]);
    expect(charges[0]?.due.value).toEqual(jod(300));
    expect(charges[0]?.base).toEqual(jod(13_925));
  });

  it('is deterministic and does not change its inputs', () => {
    const { input, projection } = build();
    const context: TaxContext = { rules: [jordan(), progressive()] };
    expect(taxAnalysis(input, projection, context)).toEqual(
      taxAnalysis(input, projection, context),
    );
  });
});

describe('taxAnalysis: provenance (D-181)', () => {
  const fixed = (over: Partial<TaxRule> = {}) =>
    jordan({ basis: 'fixed', rate: null, fixedAmount: jod(300), ...over });

  it('makes a figure from a fixture rule external, low confidence and unvalidated', () => {
    const due = analyse({ rules: [fixed()] }).years[0]?.charges[0]?.due;
    expect(due).toMatchObject({ source: 'external', confidence: 'low', validated: false });
    expect(due?.inputs).toEqual([
      { kind: 'country_pack_item', id: 'fixture.jo.sole.income' },
      { kind: 'rule', id: TAX_RULES.due },
    ]);
  });

  it('makes a figure from a verified rule external, high confidence and validated', () => {
    const verified = fixed({ status: 'verified', lastVerified: '2026-09-01' });
    const due = analyse({ rules: [verified] }).years[0]?.charges[0]?.due;
    expect(due).toMatchObject({ source: 'external', confidence: 'high', validated: true });
  });

  it('takes the weakest provenance of the rule and of the projection it is applied to', () => {
    const due = analyse({ rules: [jordan()] }).years[0]?.charges[0]?.due;
    // Turnover is built on a sales forecast with unknown seasonality and capacity: an assumption.
    expect(due).toMatchObject({ source: 'assumption', confidence: 'low', validated: false });
    expect(due?.inputs).toContainEqual({ kind: 'answer', id: 'F1' });
    expect(due?.inputs).toContainEqual({ kind: 'country_pack_item', id: 'fixture.jo.sole.income' });
    const total = analyse({ rules: [jordan()] }).years[0]?.total;
    expect(total?.inputs).toContainEqual({ kind: 'rule', id: TAX_RULES.yearTotal });
    expect(total?.inputs).toContainEqual({ kind: 'rule', id: TAX_RULES.due });
  });
});

describe('taxAnalysis: the regime from the country and G1 (D-186)', () => {
  const company = (over: Partial<TaxRule> = {}) =>
    jordan({ id: 'fixture.jo.company.income', legalForm: 'company', regime: 'company', ...over });

  it('uses the sole proprietor, and says so, when G1 is missing or "not sure yet"', () => {
    expect(analyse({ rules: [jordan(), company()] }).legalFormAssumed).toBe(true);
    const unsure = analyse({ rules: [jordan(), company()] }, { G1: real('dont_know') });
    expect(unsure.legalForm).toBe('sole');
    expect(unsure.legalFormAssumed).toBe(true);
    expect(unsure.regime).toBe('fixture_regime');
  });

  it('uses the rules of the chosen legal form', () => {
    const tax = analyse(
      { rules: [jordan(), company({ rate: makeRate(1n, 10n) })] },
      { G1: real('company') },
    );
    expect(tax.legalForm).toBe('company');
    expect(tax.legalFormAssumed).toBe(false);
    expect(tax.regime).toBe('company');
    expect(tax.years[0]?.charges[0]?.ruleId).toBe('fixture.jo.company.income');
    expect(tax.years[0]?.total.value).toEqual(fils(1_392_500n));
  });

  it('reads G1 = sole as the founder choice, not an assumption', () => {
    expect(analyse({ rules: [jordan()] }, { G1: real('sole') }).legalFormAssumed).toBe(false);
  });

  it('ignores the rules of other countries', () => {
    const { input, projection } = build();
    const result = taxAnalysis(input, projection, { rules: [algerian()] });
    expect(result).toMatchObject({ status: 'not_calculated', gap: { code: 'no_rule' } });
  });

  it('ignores a rule that takes effect after the reference date', () => {
    const { input, projection } = build();
    const result = taxAnalysis(input, projection, {
      rules: [jordan({ effectiveFrom: '2026-10-06' })],
    });
    expect(result).toMatchObject({ status: 'not_calculated', gap: { code: 'no_rule' } });
    const same = taxAnalysis(input, projection, {
      rules: [jordan({ effectiveFrom: '2026-10-05' })],
    });
    expect(same.status).toBe('calculated');
  });

  it('lets a newer rule of the same levy replace the older one', () => {
    const older = jordan({ id: 'old', effectiveFrom: '2020-01-01', rate: makeRate(1n, 100n) });
    const newer = jordan({ id: 'new', effectiveFrom: '2026-01-01' });
    const later = jordan({ id: 'later', effectiveFrom: '2027-01-01', rate: makeRate(1n, 10n) });
    for (const rules of [
      [older, newer, later],
      [later, newer, older],
    ]) {
      const tax = analyse({ rules });
      expect(tax.years[0]?.charges.map((charge) => charge.ruleId)).toEqual(['new']);
      expect(tax.years[0]?.total.value).toEqual(fils(278_500n));
    }
  });

  it('refuses two rules of one levy that take effect on the same day', () => {
    const { input, projection } = build();
    expect(() =>
      taxAnalysis(input, projection, { rules: [jordan({ id: 'a' }), jordan({ id: 'b' })] }),
    ).toThrow(expect.objectContaining({ code: 'invalid_param' }) as Error);
  });

  it('does not guess between rules of several regimes', () => {
    const { input, projection } = build();
    const result = taxAnalysis(input, projection, {
      rules: [jordan({ id: 'b', regime: 'b_regime' }), jordan({ id: 'a', regime: 'a_regime' })],
    });
    expect(result).toMatchObject({
      status: 'not_calculated',
      gap: { code: 'ambiguous_regime', regimes: ['a_regime', 'b_regime'] },
    });
  });

  it('does not convert rules in another currency', () => {
    const { input, projection } = build();
    const usd = jordan({ currency: 'USD', minimum: makeMoney(100n, 'USD') });
    const result = taxAnalysis(input, projection, { rules: [usd] });
    expect(result).toMatchObject({
      status: 'not_calculated',
      gap: { code: 'rule_other_currency', currency: 'USD' },
    });
  });

  it('is not calculated without a context, and raises the alert with the legal form it used', () => {
    const { input, projection } = build();
    const result = taxAnalysis(input, projection);
    expect(result).toMatchObject({ status: 'not_calculated', legalForm: 'sole' });
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]).toMatchObject({
      code: 'tax_regime_not_calculated',
      severity: 'warning',
      year: null,
      gap: { code: 'no_rule' },
      source: 'assumption',
      confidence: 'low',
      validated: false,
    });
    expect(result.alerts[0]?.inputs).toEqual([
      { kind: 'answer', id: 'G1' },
      { kind: 'rule', id: 'alert.tax_regime_not_calculated' },
    ]);
  });

  it('refuses a malformed rule of the country, even before using it', () => {
    const { input, projection } = build();
    expect(() => taxAnalysis(input, projection, { rules: [jordan({ paymentMonth: 0 })] })).toThrow(
      EngineError,
    );
  });

  it('refuses a projection made in another currency', () => {
    const { input, projection } = build();
    expect(() => taxAnalysis(input, { ...projection, currency: 'USD' })).toThrow(
      expect.objectContaining({ code: 'currency_mismatch' }) as Error,
    );
  });
});

describe('taxAnalysis: the alerts', () => {
  it('raises the ceiling alert for each year whose turnover is above it, with what was measured', () => {
    const tax = analyse({ rules: [jordan({ turnoverCeiling: jod(20_000) })] });
    expect(tax.alerts.map((alert) => [alert.code, alert.year])).toEqual([
      ['turnover_above_regime_ceiling', 2],
      ['turnover_above_regime_ceiling', 3],
    ]);
    expect(tax.alerts[0]).toMatchObject({
      severity: TAX_ALERT_SEVERITY.turnover_above_regime_ceiling,
      regime: 'fixture_regime',
      measured: { kind: 'money', money: jod(33_175) },
      limit: { kind: 'money', money: jod(20_000) },
      gap: null,
      source: 'assumption',
    });
    expect(tax.alerts[0]?.inputs).toContainEqual({
      kind: 'country_pack_item',
      id: 'fixture.jo.sole.income',
    });
    expect(tax.alerts[0]?.inputs).toContainEqual({
      kind: 'rule',
      id: 'alert.turnover_above_regime_ceiling',
    });
  });

  it('does not raise it for a turnover equal to the ceiling, or without a ceiling', () => {
    const equal = analyse({ rules: [jordan({ turnoverCeiling: jod(33_175) })] });
    expect(equal.alerts.map((alert) => alert.year)).toEqual([3]);
    expect(analyse({ rules: [jordan()] }).alerts).toEqual([]);
  });

  it('uses the lowest ceiling of the regime once for each year', () => {
    const social = jordan({
      id: 'fixture.jo.social',
      levy: 'social',
      kind: 'social_contribution',
      turnoverCeiling: jod(30_000),
    });
    const tax = analyse({ rules: [jordan({ turnoverCeiling: jod(45_000) }), social] });
    expect(tax.alerts.map((alert) => alert.year)).toEqual([2, 3]);
    expect(tax.alerts[0]?.limit).toEqual({ kind: 'money', money: jod(30_000) });
    // The same when the tax, which comes first, has the lower ceiling.
    const first = analyse({
      rules: [
        jordan({ turnoverCeiling: jod(30_000) }),
        { ...social, turnoverCeiling: jod(45_000) },
      ],
    });
    expect(first.alerts.map((alert) => alert.year)).toEqual([2, 3]);
    expect(first.alerts[0]?.limit).toEqual({ kind: 'money', money: jod(30_000) });
  });

  it('raises the VAT alert for each year above the threshold the caller gives', () => {
    const threshold = makeFigure(jod(15_000), {
      source: 'external',
      confidence: 'high',
      validated: true,
      inputs: [{ kind: 'country_pack_item', id: 'fixture.jo.vat' }],
    });
    const tax = analyse({ rules: [jordan()], vatThreshold: threshold });
    expect(tax.alerts.map((alert) => [alert.code, alert.year])).toEqual([
      ['turnover_above_vat_threshold', 2],
      ['turnover_above_vat_threshold', 3],
    ]);
    expect(tax.alerts[0]).toMatchObject({
      measured: { kind: 'money', money: jod(33_175) },
      limit: { kind: 'money', money: jod(15_000) },
      regime: null,
    });
    expect(tax.alerts[0]?.inputs).toContainEqual({
      kind: 'country_pack_item',
      id: 'fixture.jo.vat',
    });
  });

  it('puts the ceiling alerts before the VAT alerts', () => {
    const threshold = makeFigure(jod(1), {
      source: 'external',
      confidence: 'low',
      validated: false,
      inputs: [{ kind: 'country_pack_item', id: 'fixture.jo.vat' }],
    });
    const tax = analyse({
      rules: [jordan({ turnoverCeiling: jod(20_000) })],
      vatThreshold: threshold,
    });
    expect(tax.alerts.map((alert) => alert.code)).toEqual([
      'turnover_above_regime_ceiling',
      'turnover_above_regime_ceiling',
      'turnover_above_vat_threshold',
      'turnover_above_vat_threshold',
      'turnover_above_vat_threshold',
    ]);
  });

  it('still raises the VAT alert when no regime could be calculated, after the regime alert', () => {
    const { input, projection } = build();
    const threshold = makeFigure(jod(30_000), {
      source: 'external',
      confidence: 'high',
      validated: true,
      inputs: [{ kind: 'country_pack_item', id: 'fixture.jo.vat' }],
    });
    const result = taxAnalysis(input, projection, { rules: [], vatThreshold: threshold });
    expect(result.alerts.map((alert) => [alert.code, alert.year])).toEqual([
      ['tax_regime_not_calculated', null],
      ['turnover_above_vat_threshold', 2],
      ['turnover_above_vat_threshold', 3],
    ]);
  });

  it('raises the alerts of the Algerian fixture of SPEC section 7 for a turnover of 6,000,000 DZD', () => {
    // 1,000 units a month at 500 DZD a unit is 6,000,000 DZD a year.
    const dz: ProjectContext = {
      country: 'DZ',
      currency: 'DZD',
      mode: 'full',
      referenceDate: '2026-10-05',
    };
    const result = engineInputFrom(
      {
        F1: real({ amount: 500, currency: 'DZD' }),
        F3: real({ items: [{ label: 'Matières', amount: 100, currency: 'DZD' }] }),
        F4: real({ items: [{ label: 'Loyer', amount: 50_000, currency: 'DZD' }] }),
        F6: real({ month1: 1_000, month6: 1_000, month12: 1_000 }),
        'F6.2': real(0),
      },
      {},
      dz,
    );
    if (result.status !== 'ok') throw new Error(JSON.stringify(result.reasons));
    const projection = projectOperatingLines(result.input);
    const tax = taxAnalysis(result.input, projection, { rules: [algerian()] });
    if (tax.status !== 'calculated') throw new Error('expected a calculated tax');
    expect(tax.years[0]?.turnover).toEqual(dzd(6_000_000));
    expect(tax.years[0]?.total.value).toEqual(dzd(30_000));
    expect(tax.alerts.map((alert) => alert.year)).toEqual([1, 2, 3]);
    expect(tax.alerts[0]).toMatchObject({
      code: 'turnover_above_regime_ceiling',
      regime: 'auto_entrepreneur',
      limit: { kind: 'money', money: dzd(5_000_000) },
    });
    // Paid in March of the following year: month 15 for year 1.
    expect(tax.years[0]?.charges[0]?.paymentMonth).toBe(15);
  });
});
