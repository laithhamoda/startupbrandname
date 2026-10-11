import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { ALERT_SEVERITY, type Alert, type AlertCode } from './alerts';
import { analyseEconomics } from './economics';
import { EngineError } from './errors';
import { defaultFigure } from './figure';
import { engineInputFrom, type EngineInput, type ProvenanceBySteps } from './input';
import { makeMoney } from './money';
import { createEngineParams, type EngineParams } from './params';
import { projectOperatingLines, type OperatingProjection } from './projection';
import { makeRate, parseRate } from './rate';

const jod = (amount: number) => ({ amount, currency: 'JOD' });
const items = (...rows: [string, number][]) => ({
  items: rows.map(([label, amount]) => ({ label, amount, currency: 'JOD' })),
});
const real = (value: unknown) => ({ status: 'answered' as const, value });
const UNKNOWN = { status: 'unknown' as const };
const fils = (amount: bigint) => makeMoney(amount, 'JOD');

/**
 * P 10.000, VC 4.000, fixed cost 3,000.000, a flat 400 units a month in year 1. Then CM is 6.000,
 * BE_units 500, the floor 11.500, and every month of the horizon loses money (6 x 400 < 3,000).
 */
const answersFor = (more: Answers = {}) =>
  ({
    F1: real(jod(10)),
    F3: real(items(['Materials', 4])),
    F4: real(items(['Rent', 3000])),
    F6: real({ month1: 400, month6: 400, month12: 400 }),
    ...more,
  }) satisfies Answers;

const userHigh = { source: 'user', confidence: 'high', validated: true } as const;
const everythingUser: ProvenanceBySteps = Object.fromEntries(
  ['F1', 'F2', 'F2.1', 'F3', 'F4', 'F4.1', 'F5', 'F6', 'A5', 'A7', 'H5', 'D4', 'E7'].map((id) => [
    id,
    userHigh,
  ]),
);

function inputOf(answers: Answers): EngineInput {
  const result = engineInputFrom(answers, everythingUser, {
    country: 'JO',
    currency: 'JOD',
    mode: 'full',
    referenceDate: '2026-10-05',
  });
  if (result.status !== 'ok') throw new Error(`not calculable: ${JSON.stringify(result.reasons)}`);
  return result.input;
}

interface Scene {
  readonly projection?: (projection: OperatingProjection) => OperatingProjection;
  readonly params?: EngineParams;
  readonly premiumAllowed?: boolean;
}

function analyse(answers: Answers, scene: Scene = {}) {
  const input = inputOf(answers);
  const projection = projectOperatingLines(input, scene.params);
  const shown = scene.projection ? scene.projection(projection) : projection;
  return {
    input,
    projection: shown,
    result: analyseEconomics(input, shown, { premiumAllowed: scene.premiumAllowed }, scene.params),
  };
}

const codes = (alerts: readonly Alert[]) => alerts.map((alert) => alert.code);
const alertOf = (alerts: readonly Alert[], code: AlertCode) =>
  alerts.find((alert) => alert.code === code);

/** The projection with the operating profit of each month replaced (in fils; the rest lose 1 fil). */
const profits =
  (...values: bigint[]) =>
  (projection: OperatingProjection): OperatingProjection => ({
    ...projection,
    operatingProfit: {
      ...projection.operatingProfit,
      monthly: projection.operatingProfit.monthly.map((_, index) => fils(values[index] ?? -1n)),
    },
  });

/** The projection with the units of months 11 and 12 replaced. */
const lastUnits =
  (month11: bigint, month12: bigint) =>
  (projection: OperatingProjection): OperatingProjection => {
    const monthly = [...projection.units.monthly];
    monthly[10] = month11;
    monthly[11] = month12;
    return { ...projection, units: { ...projection.units, monthly } };
  };

/** 14 months of loss, then a profit: break-even in month 15. */
const breaksEvenInMonth = (month: number) =>
  profits(...Array.from({ length: month - 1 }, () => -100n), 100n);

describe('the alerts and their severities (D-190, D-207)', () => {
  it('maps every code to one severity', () => {
    expect(ALERT_SEVERITY).toEqual({
      cm_not_positive: 'block',
      break_even_units_above_capacity: 'warning',
      break_even_month_above_target: 'warning',
      break_even_month_above_runway: 'warning',
      setup_costs_above_capital: 'warning',
      setup_costs_within_capital_range: 'note',
      price_below_floor: 'warning',
      ltv_to_cac_below_minimum: 'warning',
    });
  });

  it('raises only the price alert for the base plan, which has none of the optional answers', () => {
    // CM 6, BE_units 500 vs no capacity, no targets, no capital; F1 10 is below the floor of 11.5,
    // which is the only thing wrong with this plan.
    const { result } = analyse(answersFor());
    expect(codes(result.alerts)).toEqual(['price_below_floor']);
  });
});

describe('cm_not_positive: block', () => {
  it('blocks when the contribution margin is zero, and skips the break-even alerts', () => {
    const { result } = analyse(
      answersFor({
        F1: real(jod(4)),
        E7: real(10),
        H5: real('m6'),
        A7: real('lt3'),
      }),
    );
    expect(result.unitEconomics.status).toBe('blocked');
    const [first] = result.alerts;
    expect(first).toMatchObject({
      code: 'cm_not_positive',
      severity: 'block',
      measured: { kind: 'money', money: fils(0n) },
      limit: { kind: 'money', money: fils(0n) },
    });
    expect(first?.inputs.map((ref) => ref.id)).toEqual(expect.arrayContaining(['F1', 'F3']));
    expect(codes(result.alerts)).not.toContain('break_even_units_above_capacity');
    expect(codes(result.alerts)).not.toContain('break_even_month_above_target');
    expect(codes(result.alerts)).not.toContain('break_even_month_above_runway');
  });

  it('blocks when the contribution margin is negative', () => {
    const { result } = analyse(answersFor({ F1: real(jod(3)) }));
    expect(alertOf(result.alerts, 'cm_not_positive')?.measured).toEqual({
      kind: 'money',
      money: fils(-1000n),
    });
  });

  it('does not block a positive margin', () => {
    expect(codes(analyse(answersFor()).result.alerts)).not.toContain('cm_not_positive');
  });
});

describe('break_even_units_above_capacity: warning', () => {
  it('warns when BE_units 500 is above the capacity E7 of 400', () => {
    const { result } = analyse(answersFor({ E7: real(400) }));
    expect(alertOf(result.alerts, 'break_even_units_above_capacity')).toMatchObject({
      severity: 'warning',
      measured: { kind: 'units', units: 500n },
      limit: { kind: 'units', units: 400n },
    });
  });

  it('is quiet at exactly the capacity and above it', () => {
    for (const capacity of [500, 900]) {
      const { result } = analyse(answersFor({ E7: real(capacity) }));
      expect(codes(result.alerts)).not.toContain('break_even_units_above_capacity');
    }
  });

  it('is not evaluated without a capacity (E7 missing or unknown)', () => {
    for (const more of [{}, { E7: UNKNOWN }]) {
      const { result } = analyse(answersFor(more));
      expect(codes(result.alerts)).not.toContain('break_even_units_above_capacity');
    }
  });
});

describe('BE_month against H5 and A7: warnings, raised only when the limit is surely exceeded', () => {
  it('warns when break-even in month 14 is later than the 12 months of H5', () => {
    const { result } = analyse(answersFor({ H5: real('m12') }), {
      projection: breaksEvenInMonth(14),
    });
    expect(alertOf(result.alerts, 'break_even_month_above_target')).toMatchObject({
      severity: 'warning',
      measured: { kind: 'months', months: 14 },
      limit: { kind: 'months', months: 12 },
    });
    expect(codes(result.alerts)).not.toContain('break_even_month_above_runway');
  });

  it('is quiet at the limit itself and below it', () => {
    for (const month of [12, 5]) {
      const { result } = analyse(answersFor({ H5: real('m12') }), {
        projection: breaksEvenInMonth(month),
      });
      expect(codes(result.alerts)).not.toContain('break_even_month_above_target');
    }
  });

  it('uses the upper bound of the bucket for A7 as well', () => {
    const answers = answersFor({ A7: real('3to6') });
    const late = analyse(answers, { projection: breaksEvenInMonth(7) }).result.alerts;
    expect(alertOf(late, 'break_even_month_above_runway')).toMatchObject({
      measured: { kind: 'months', months: 7 },
      limit: { kind: 'months', months: 6 },
    });
    const onTime = analyse(answers, { projection: breaksEvenInMonth(6) }).result.alerts;
    expect(codes(onTime)).not.toContain('break_even_month_above_runway');
  });

  it('raises both when both limits are broken', () => {
    const { result } = analyse(answersFor({ A7: real('lt3'), H5: real('m6') }), {
      projection: breaksEvenInMonth(9),
    });
    expect(codes(result.alerts)).toEqual([
      'break_even_month_above_target',
      'break_even_month_above_runway',
      'price_below_floor',
    ]);
  });

  it('has no limit for "more than 36 months" (H5) or "more than 12 months" (A7)', () => {
    const { result } = analyse(answersFor({ A7: real('gt12'), H5: real('more') }), {
      projection: breaksEvenInMonth(30),
    });
    expect(codes(result.alerts)).not.toContain('break_even_month_above_target');
    expect(codes(result.alerts)).not.toContain('break_even_month_above_runway');
  });

  it('is not evaluated when H5 or A7 is unknown or missing', () => {
    for (const more of [{}, { H5: UNKNOWN, A7: UNKNOWN }]) {
      const { result } = analyse(answersFor(more), { projection: breaksEvenInMonth(30) });
      expect(codes(result.alerts)).not.toContain('break_even_month_above_target');
      expect(codes(result.alerts)).not.toContain('break_even_month_above_runway');
    }
  });

  it('warns when break-even is not reached in 36 months and the limit is within them', () => {
    // The base plan loses money in every month: break-even is after month 36, past 12 and past 36.
    const { result } = analyse(answersFor({ H5: real('m36'), A7: real('6to12') }));
    expect(alertOf(result.alerts, 'break_even_month_above_target')).toMatchObject({
      measured: { kind: 'months_after', months: 36 },
      limit: { kind: 'months', months: 36 },
    });
    expect(alertOf(result.alerts, 'break_even_month_above_runway')).toMatchObject({
      measured: { kind: 'months_after', months: 36 },
      limit: { kind: 'months', months: 12 },
    });
  });

  it('does not warn when break-even is not reached but the limit has no upper bound', () => {
    const { result } = analyse(answersFor({ H5: real('more'), A7: real('gt12') }));
    expect(codes(result.alerts)).not.toContain('break_even_month_above_target');
    expect(codes(result.alerts)).not.toContain('break_even_month_above_runway');
  });

  it('cannot tell when the horizon is shorter than the limit, so it does not warn', () => {
    // A 12-month horizon that never breaks even says nothing about an 18-month limit, but a 6-month
    // limit is surely exceeded.
    const params = createEngineParams({
      horizonMonths: defaultFigure('engine.horizon_months', 12),
    });
    const shorter = analyse(answersFor({ H5: real('m18') }), { params }).result.alerts;
    expect(codes(shorter)).not.toContain('break_even_month_above_target');
    const surely = analyse(answersFor({ H5: real('m6') }), { params }).result.alerts;
    expect(alertOf(surely, 'break_even_month_above_target')?.measured).toEqual({
      kind: 'months_after',
      months: 12,
    });
  });

  it('lists the break-even month and the answer among the inputs', () => {
    const { result } = analyse(answersFor({ H5: real('m12') }), {
      projection: breaksEvenInMonth(14),
    });
    const refs = alertOf(result.alerts, 'break_even_month_above_target')?.inputs ?? [];
    expect(refs).toContainEqual({ kind: 'answer', id: 'H5' });
    expect(refs).toContainEqual({ kind: 'rule', id: 'T8.break_even_month' });
  });
});

describe('F5 against A5: the H3 funding alert and a softer note', () => {
  const capital = (min: number, max: number, currency = 'JOD') => real({ min, max, currency });
  const setup = (amount: number) => real(items(['Fit-out', amount]));

  it('warns when the set-up costs are above the maximum of the capital', () => {
    const { result } = analyse(answersFor({ A5: capital(2000, 5000), F5: setup(6000) }));
    expect(alertOf(result.alerts, 'setup_costs_above_capital')).toMatchObject({
      severity: 'warning',
      measured: { kind: 'money', money: fils(6000000n) },
      limit: { kind: 'money', money: fils(5000000n) },
      lowerLimit: { kind: 'money', money: fils(2000000n) },
    });
    expect(codes(result.alerts)).not.toContain('setup_costs_within_capital_range');
  });

  it('gives a note when they fall between the minimum and the maximum, the maximum included', () => {
    for (const amount of [3000, 5000, 2000.001]) {
      const { result } = analyse(answersFor({ A5: capital(2000, 5000), F5: setup(amount) }));
      expect(alertOf(result.alerts, 'setup_costs_within_capital_range')).toMatchObject({
        severity: 'note',
        limit: { kind: 'money', money: fils(5000000n) },
        lowerLimit: { kind: 'money', money: fils(2000000n) },
      });
      expect(codes(result.alerts)).not.toContain('setup_costs_above_capital');
    }
  });

  it('says nothing when the minimum capital already covers the set-up costs', () => {
    for (const amount of [2000, 1500]) {
      const { result } = analyse(answersFor({ A5: capital(2000, 5000), F5: setup(amount) }));
      expect(codes(result.alerts)).not.toContain('setup_costs_above_capital');
      expect(codes(result.alerts)).not.toContain('setup_costs_within_capital_range');
    }
  });

  it('works with a capital range that is a single amount', () => {
    const { result } = analyse(answersFor({ A5: capital(3000, 3000), F5: setup(3000) }));
    expect(codes(result.alerts)).not.toContain('setup_costs_above_capital');
    expect(codes(result.alerts)).not.toContain('setup_costs_within_capital_range');
  });

  it('compares nothing when A5 is in another currency (D-113)', () => {
    const { result } = analyse(answersFor({ A5: capital(1, 2, 'USD'), F5: setup(6000) }));
    expect(codes(result.alerts)).not.toContain('setup_costs_above_capital');
    expect(codes(result.alerts)).not.toContain('setup_costs_within_capital_range');
  });

  it('compares nothing when A5 or F5 is unknown or missing', () => {
    for (const more of [
      { F5: setup(6000) },
      { A5: UNKNOWN, F5: setup(6000) },
      { A5: capital(2000, 5000) },
      { A5: capital(2000, 5000), F5: UNKNOWN },
    ]) {
      const { result } = analyse(answersFor(more));
      expect(codes(result.alerts)).not.toContain('setup_costs_above_capital');
      expect(codes(result.alerts)).not.toContain('setup_costs_within_capital_range');
    }
  });

  it('lists both answers among the inputs', () => {
    const { result } = analyse(answersFor({ A5: capital(2000, 5000), F5: setup(6000) }));
    const refs = alertOf(result.alerts, 'setup_costs_above_capital')?.inputs ?? [];
    expect(refs).toContainEqual({ kind: 'answer', id: 'F5' });
    expect(refs).toContainEqual({ kind: 'answer', id: 'A5' });
  });
});

describe('price_below_floor: warning', () => {
  it('warns when F1 10.000 is below the floor of 11.500', () => {
    const { result } = analyse(answersFor());
    expect(alertOf(result.alerts, 'price_below_floor')).toMatchObject({
      severity: 'warning',
      measured: { kind: 'money', money: fils(10000n) },
      limit: { kind: 'money', money: fils(11500n) },
    });
  });

  it('is quiet at the floor and above it', () => {
    for (const price of [11.5, 12]) {
      const { result } = analyse(answersFor({ F1: real(jod(price)) }));
      expect(codes(result.alerts)).not.toContain('price_below_floor');
    }
  });

  it('is not evaluated when no unit is sold in year 1, as there is no floor', () => {
    const none = { F6: real({ month1: 0, month6: 0, month12: 0 }) };
    const { result } = analyse(answersFor(none));
    expect(result.pricing.floor).toBeNull();
    expect(codes(result.alerts)).not.toContain('price_below_floor');
  });

  it('compares the price taken from competitors when F1 is unknown, as an assumption', () => {
    // The median of 9, 10 and 11 is 10, below the floor.
    const { result } = analyse(
      answersFor({
        F1: UNKNOWN,
        D4: real({ items: [9, 10, 11].map((p, i) => ({ name: `C${String(i)}`, price: jod(p) })) }),
      }),
    );
    const alert = alertOf(result.alerts, 'price_below_floor');
    expect(alert?.source).toBe('assumption');
    expect(alert?.inputs).toContainEqual({ kind: 'answer', id: 'D4' });
  });
});

describe('ltv_to_cac_below_minimum: warning', () => {
  const subscription = (churn: number, more: Answers = {}): Answers =>
    answersFor({
      F1: real(jod(10)),
      F4: real(items(['Rent', 2400])),
      'F4.1': real(jod(600)),
      F2: real('subscription'),
      'F2.1': real(churn),
      ...more,
    });

  it('warns when LTV / CAC is 1.5 (churn 20%, LTV 30.000, CAC 20.000)', () => {
    // P 10, VC 4: CM 6. LTV = 6 / 0.2 = 30; new customers = 110 - 100 x 0.8 = 30, CAC = 600 / 30 = 20.
    const answers = subscription(20);
    const { result } = analyse(answers, { projection: lastUnits(100n, 110n) });
    expect(alertOf(result.alerts, 'ltv_to_cac_below_minimum')).toMatchObject({
      severity: 'warning',
      measured: { kind: 'ratio', ratio: makeRate(3n, 2n) },
      limit: { kind: 'ratio', ratio: makeRate(3n, 1n) },
    });
  });

  it('is quiet at 6 (churn 5%, LTV 120.000, CAC 20.000) and at exactly 3', () => {
    const answers = subscription(5);
    expect(
      codes(analyse(answers, { projection: lastUnits(100n, 125n) }).result.alerts),
    ).not.toContain('ltv_to_cac_below_minimum');
    // 110 - 100 x 0.95 = 15 new customers: CAC 40.000, ratio 120 / 40 = 3, not below 3.
    expect(
      codes(analyse(answers, { projection: lastUnits(100n, 110n) }).result.alerts),
    ).not.toContain('ltv_to_cac_below_minimum');
  });

  it('follows the minimum of the parameters', () => {
    const params = createEngineParams({
      ltvCacMinimum: defaultFigure('unit_economics.ltv_cac_minimum', parseRate('7')),
    });
    const answers = subscription(5);
    const { result } = analyse(answers, { params, projection: lastUnits(100n, 125n) });
    expect(alertOf(result.alerts, 'ltv_to_cac_below_minimum')?.limit).toEqual({
      kind: 'ratio',
      ratio: makeRate(7n, 1n),
    });
  });

  it('is not evaluated without a churn, for a fixed price, or when CAC has no divisor', () => {
    const unknownChurn = analyse(subscription(5, { 'F2.1': UNKNOWN })).result;
    expect(codes(unknownChurn.alerts)).not.toContain('ltv_to_cac_below_minimum');
    const fixed = analyse(answersFor({ F2: real('fixed'), 'F2.1': real(20) })).result;
    expect(codes(fixed.alerts)).not.toContain('ltv_to_cac_below_minimum');
    const noMarketing = analyse(subscription(5, { 'F4.1': UNKNOWN }), {
      projection: lastUnits(100n, 125n),
    }).result;
    expect(codes(noMarketing.alerts)).not.toContain('ltv_to_cac_below_minimum');
  });

  it('lists the ratio and the minimum among the inputs', () => {
    const answers = subscription(20);
    const { result } = analyse(answers, { projection: lastUnits(100n, 110n) });
    const refs = alertOf(result.alerts, 'ltv_to_cac_below_minimum')?.inputs ?? [];
    expect(refs).toContainEqual({ kind: 'rule', id: 'T8.ltv_to_cac' });
    expect(refs).toContainEqual({ kind: 'default', id: 'unit_economics.ltv_cac_minimum' });
  });
});

describe('the composed analysis', () => {
  it('returns T8, T7 and the alerts in the order of D-190, from one input and projection', () => {
    const answers = answersFor({
      E7: real(400),
      H5: real('m12'),
      A7: real('3to6'),
      A5: real({ min: 1000, max: 2000, currency: 'JOD' }),
      F5: real(items(['Fit-out', 6000])),
      D4: real({ items: [{ name: 'A', price: jod(9) }] }),
    });
    const { result } = analyse(answers, { projection: breaksEvenInMonth(20) });
    expect(result.unitEconomics.status).toBe('ok');
    expect(result.pricing.floor?.value).toEqual(fils(11500n));
    expect(codes(result.alerts)).toEqual([
      'break_even_units_above_capacity',
      'break_even_month_above_target',
      'break_even_month_above_runway',
      'setup_costs_above_capital',
      'price_below_floor',
    ]);
  });

  it('passes the premium switch on to T7', () => {
    const d4 = { D4: real({ items: [{ name: 'A', price: jod(15) }] }) };
    expect(analyse(answersFor(d4)).result.pricing.premium).toBeNull();
    const allowed = analyse(answersFor(d4), { premiumAllowed: true }).result.pricing;
    expect(allowed.premium?.value).toEqual(fils(15000n));
  });

  it('is deterministic: the same input gives equal results', () => {
    const answers = answersFor({ H5: real('m12'), E7: real(400) });
    const first = analyse(answers).result;
    const second = analyse(answers).result;
    expect(second).toEqual(first);
  });

  it('refuses a projection made in another currency', () => {
    const { input, projection } = analyse(answersFor());
    expect(() => analyseEconomics(input, { ...projection, currency: 'USD' })).toThrow(EngineError);
  });
});
