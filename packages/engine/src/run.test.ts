import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import type { Alert } from './alerts';
import { defaultFigure } from './figure';
import type { ProjectContext } from './input';
import { makeMoney } from './money';
import { createEngineParams, listEngineParams } from './params';
import { makeRate } from './rate';
import { mergeAlerts, runEngine, type EngineRun, type RunAlert } from './run';
import { canonicalJson, serialiseRun } from './serialise';
import type { TaxAlert, TaxRule } from './tax';
import { ENGINE_VERSION } from './version';

const project: ProjectContext = {
  country: 'JO',
  currency: 'JOD',
  mode: 'full',
  referenceDate: '2026-10-05',
};
const real = (value: unknown) => ({ status: 'answered' as const, value });
const items = (label: string, amount: number) => ({
  items: [{ label, amount, currency: 'JOD' }],
});

/** A healthy flat project: 400 units at 10, VC 4, fixed costs 1,000 a month, set-up 6,000. */
const healthy = (more: Answers = {}): Answers => ({
  F1: real({ amount: 10, currency: 'JOD' }),
  F3: real(items('Materials', 4)),
  F4: real(items('Rent', 1000)),
  F5: real(items('Set-up', 6000)),
  F6: real({ month1: 400, month6: 400, month12: 400 }),
  ...more,
});

/** A project with a block, warnings and a note at once. */
const troubled = (): Answers =>
  healthy({
    F1: real({ amount: 3, currency: 'JOD' }),
    F5: real(items('Set-up', 3000)),
    A5: real({ min: 1000, max: 5000, currency: 'JOD' }),
  });

function ok(result: ReturnType<typeof runEngine>): EngineRun {
  if (result.status !== 'ok') throw new Error(JSON.stringify(result.reasons));
  return result.run;
}

const fixtureRule = (over: Partial<TaxRule> = {}): TaxRule => ({
  id: 'fixture.jo.sole.turnover',
  countryCode: 'JO',
  legalForm: 'sole',
  regime: 'fixture_regime',
  levy: 'fixture_levy',
  kind: 'tax',
  basis: 'turnover',
  rate: makeRate(1n, 10n),
  brackets: [],
  fixedAmount: null,
  minimum: null,
  turnoverCeiling: null,
  paymentMonth: 1,
  currency: 'JOD',
  effectiveFrom: '2020-01-01',
  sourceUrl: 'https://example.invalid/fixture',
  lastVerified: null,
  status: 'unverified',
  ...over,
});

describe('runEngine: the whole analysis of a project', () => {
  const run = ok(runEngine(healthy(), {}, project));

  it('holds the engine version, the input and its notes, and the parameters used', () => {
    expect(run.engineVersion).toBe(ENGINE_VERSION);
    expect(run.engineVersion).toBe('1.0.0');
    expect(run.input.currency).toBe('JOD');
    expect(run.input.notes.length).toBeGreaterThan(0);
    expect(run.parameters).toEqual(listEngineParams(createEngineParams()));
  });

  it('holds the projection, T8, T7, the cash analysis, the scenarios and the tornado', () => {
    expect(run.projection.units.monthly).toHaveLength(36);
    expect(run.unitEconomics.status).toBe('ok');
    expect(run.pricing.floor).not.toBeNull();
    expect(run.cash.cashFlow.status).toBe('ok');
    expect(run.cash.tax.status).toBe('not_calculated');
    expect(run.cash.fxTest).toBeNull();
    expect(run.scenarios.base.firstYearOperatingProfit.value).toEqual(
      makeMoney(16_800_000n, 'JOD'),
    );
    expect(run.tornado.top?.value).toBe('price');
  });

  it('agrees with itself: the base scenario is the plain projection, T8 and T9 share the break-even', () => {
    const [first] = run.projection.operatingProfit.monthly;
    expect(first?.minor).toBe(1_400_000n);
    const be = run.unitEconomics.status === 'ok' ? run.unitEconomics.breakEvenMonth.value : null;
    expect(be).toBe(run.scenarios.base.breakEvenMonth.value);
    const flow = run.cash.cashFlow;
    expect(
      flow.status === 'ok' &&
        run.scenarios.base.funding.status === 'ok' &&
        flow.fundingNeed.value.minor === run.scenarios.base.funding.need.value.minor,
    ).toBe(true);
  });

  it('has only the alert that no tax regime was calculated without rules, and none with one', () => {
    expect(run.alerts.map((alert) => alert.code)).toEqual(['tax_regime_not_calculated']);
    const taxed = ok(runEngine(healthy(), {}, project, { rules: [fixtureRule()] }));
    expect(taxed.alerts).toEqual([]);
  });

  it('does not repeat the alerts inside the cash analysis: they are in the one list', () => {
    expect('alerts' in run.cash).toBe(false);
    expect(run.cash.tax.alerts).toHaveLength(1);
    expect(run.alerts.filter((alert) => alert.origin === 'tax')).toHaveLength(1);
  });

  it('is pure and deterministic: the same arguments give a deeply equal run and the same text', () => {
    const again = ok(runEngine(healthy(), {}, project));
    expect(again).toEqual(run);
    expect(serialiseRun(again)).toBe(serialiseRun(run));
    const taxed = (): EngineRun =>
      ok(runEngine(healthy(), {}, project, { rules: [fixtureRule()] }));
    expect(taxed()).toEqual(taxed());
    expect(serialiseRun(taxed())).toBe(serialiseRun(taxed()));
  });

  it('does not change what it was given', () => {
    const answers = healthy();
    const before = canonicalJson(answers);
    runEngine(answers, {}, project, { rules: [fixtureRule()] });
    expect(canonicalJson(answers)).toBe(before);
  });
});

describe('runEngine: answers that cannot be calculated', () => {
  it('returns the reasons of the adapter and no run', () => {
    const withoutF4 = Object.fromEntries(
      Object.entries(healthy()).filter(([id]) => id !== 'F4'),
    ) as Answers;
    expect(runEngine(withoutF4, {}, project)).toEqual({
      status: 'not_calculable',
      reasons: [{ code: 'missing_answer', questionId: 'F4' }],
    });
  });

  it('returns the reason for a currency the engine does not know', () => {
    const result = runEngine(healthy(), {}, { ...project, currency: 'dinar' });
    expect(result.status).toBe('not_calculable');
  });

  it('still refuses an override out of its range, before reading the answers', () => {
    expect(() =>
      runEngine(healthy(), {}, project, undefined, {
        tornadoSwing: defaultFigure('t', makeRate(0n, 1n)),
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid_param' }) as Error);
  });
});

describe('runEngine: the context, the overrides and the options', () => {
  it('uses the tax rules of the context', () => {
    const run = ok(runEngine(healthy(), {}, project, { rules: [fixtureRule()] }));
    expect(run.cash.tax.status).toBe('calculated');
    const flow = run.cash.cashFlow;
    expect(flow.status === 'ok' && flow.taxIncluded).toBe(true);
  });

  it('uses the overrides of the engine parameters everywhere', () => {
    const swing = defaultFigure('t', makeRate(1n, 2n));
    const run = ok(runEngine(healthy(), {}, project, undefined, { tornadoSwing: swing }));
    expect(run.tornado.change).toBe(swing);
    expect(run.parameters).toContain(swing);
    // Price at half and one and a half: (2,000 - 1,600 - 1,000) x 12 = -7,200.
    expect(run.tornado.rows[0]?.atLow.value).toEqual(makeMoney(-7_200_000n, 'JOD'));
  });

  it('passes the pricing options on: the premium needs a D5 that passed R5', () => {
    const answers = healthy({
      D4: real({
        items: [
          { name: 'A', price: { amount: 9, currency: 'JOD' } },
          { name: 'B', price: { amount: 14, currency: 'JOD' } },
        ],
      }),
    });
    expect(ok(runEngine(answers, {}, project)).pricing.premium).toBeNull();
    const allowed = ok(runEngine(answers, {}, project, undefined, {}, { premiumAllowed: true }));
    expect(allowed.pricing.premium?.value).toEqual(makeMoney(14_000n, 'JOD'));
  });
});

describe('runEngine: one merged list of alerts', () => {
  const run = ok(runEngine(troubled(), {}, project));

  it('holds the alerts of T8, T7 and the tax engine, each once, blocks before warnings before notes', () => {
    expect(run.alerts.map((alert) => [alert.severity, alert.code, alert.origin])).toEqual([
      ['block', 'cm_not_positive', 'economics'],
      ['warning', 'price_below_floor', 'economics'],
      ['warning', 'tax_regime_not_calculated', 'tax'],
      ['note', 'setup_costs_within_capital_range', 'economics'],
    ]);
  });

  it('keeps the provenance and the typed fields of each alert', () => {
    const taxAlert = run.alerts.find((alert) => alert.origin === 'tax');
    expect(taxAlert).toMatchObject({ gap: { code: 'no_rule' }, year: null });
    const block = run.alerts[0];
    expect(block?.source).toBe('assumption');
    expect(block?.inputs.length).toBeGreaterThan(0);
  });

  it('adds the ceiling and VAT alerts of the tax engine by year', () => {
    const answers = healthy({ G1: real('company') });
    const rule = fixtureRule({
      legalForm: 'company',
      turnoverCeiling: makeMoney(1_000_000n, 'JOD'),
    });
    const taxed = ok(runEngine(answers, {}, project, { rules: [rule] }));
    const ceilings = taxed.alerts.filter((alert) => alert.code === 'turnover_above_regime_ceiling');
    expect(ceilings.map((alert) => (alert.origin === 'tax' ? alert.year : null))).toEqual([
      1, 2, 3,
    ]);
  });
});

describe('mergeAlerts', () => {
  const economic = (code: Alert['code'], severity: Alert['severity']): Alert => ({
    code,
    severity,
    measured: { kind: 'months', months: 1 },
    limit: { kind: 'months', months: 2 },
    source: 'user',
    confidence: 'high',
    validated: true,
    inputs: [],
  });
  const taxed = (code: TaxAlert['code'], year: number | null): TaxAlert => ({
    code,
    severity: 'warning',
    year,
    regime: 'r',
    measured: null,
    limit: null,
    gap: null,
    source: 'external',
    confidence: 'low',
    validated: false,
    inputs: [],
  });

  it('orders by severity, then by code, and keeps equal codes in the order they were raised', () => {
    const merged: readonly RunAlert[] = mergeAlerts(
      [
        economic('setup_costs_within_capital_range', 'note'),
        economic('price_below_floor', 'warning'),
        economic('cm_not_positive', 'block'),
        economic('break_even_month_above_target', 'warning'),
      ],
      [
        taxed('turnover_above_regime_ceiling', 2),
        taxed('turnover_above_regime_ceiling', 1),
        taxed('turnover_above_vat_threshold', 1),
      ],
    );
    expect(merged.map((alert) => alert.code)).toEqual([
      'cm_not_positive',
      'break_even_month_above_target',
      'price_below_floor',
      'turnover_above_regime_ceiling',
      'turnover_above_regime_ceiling',
      'turnover_above_vat_threshold',
      'setup_costs_within_capital_range',
    ]);
    // The two ceiling alerts stay in the order given: year 2 was raised before year 1 here.
    const years = merged.flatMap((alert) =>
      alert.origin === 'tax' && alert.code === 'turnover_above_regime_ceiling' ? [alert.year] : [],
    );
    expect(years).toEqual([2, 1]);
  });

  it('marks where each alert came from and does not touch its fields', () => {
    const [first, second] = mergeAlerts(
      [economic('cm_not_positive', 'block')],
      [taxed('tax_regime_not_calculated', null)],
    );
    expect(first).toMatchObject({ origin: 'economics', code: 'cm_not_positive' });
    expect(second).toMatchObject({ origin: 'tax', code: 'tax_regime_not_calculated', year: null });
  });

  it('is empty for no alerts', () => {
    expect(mergeAlerts([], [])).toEqual([]);
  });
});
