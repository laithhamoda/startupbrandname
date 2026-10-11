import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import {
  engineInputFrom,
  PRICE_FROM_D4_RULE,
  type EngineInput,
  type ProjectContext,
  type ProvenanceBySteps,
} from './input';
import { makeMoney } from './money';
import { makeRate, parseRate } from './rate';

const project: ProjectContext = {
  country: 'JO',
  currency: 'JOD',
  mode: 'full',
  referenceDate: '2026-10-05',
};

const jod = (amount: number) => ({ amount, currency: 'JOD' });
const items = (...rows: [string, number, string?][]) => ({
  items: rows.map(([label, amount, currency]) => ({ label, amount, currency: currency ?? 'JOD' })),
});
const real = (value: unknown) => ({ status: 'answered' as const, value });
const UNKNOWN = { status: 'unknown' as const };

/** A JOD service: price 25, variable cost 10.5, fixed cost 320.5 a month, sales 10, 40, 100. */
const basic = (): Answers => ({
  F1: real(jod(25)),
  F3: real(items(['Parts', 8], ['Delivery', 2.5])),
  F4: real(items(['Rent', 300], ['Internet', 20.5])),
  F6: real({ month1: 10, month6: 40, month12: 100 }),
});

const without = (answers: Answers, id: keyof Answers): Answers =>
  Object.fromEntries(Object.entries(answers).filter(([key]) => key !== id));

const userHigh = { source: 'user', confidence: 'high', validated: true } as const;
const allUser = (...ids: (keyof Answers)[]): ProvenanceBySteps =>
  Object.fromEntries(ids.map((id) => [id, userHigh]));

function inputOf(
  answers: Answers,
  provenance: ProvenanceBySteps = {},
  context: ProjectContext = project,
): EngineInput {
  const result = engineInputFrom(answers, provenance, context);
  if (result.status !== 'ok') throw new Error(`not calculable: ${JSON.stringify(result.reasons)}`);
  return result.input;
}

function reasonsOf(answers: Answers, context: ProjectContext = project) {
  const result = engineInputFrom(answers, {}, context);
  if (result.status !== 'not_calculable') throw new Error('expected not calculable');
  return result.reasons;
}

describe('engineInputFrom: the four mandatory answers', () => {
  it('reads price, costs and sales into minor units of the project currency', () => {
    const input = inputOf(basic(), allUser('F1', 'F3', 'F4', 'F6'));
    expect(input.currency).toBe('JOD');
    expect(input.country).toBe('JO');
    expect(input.mode).toBe('full');
    expect(input.referenceDate).toBe('2026-10-05');
    expect(input.price.value).toEqual(makeMoney(25000n, 'JOD'));
    expect(input.variableCost.value).toEqual(makeMoney(10500n, 'JOD'));
    expect(input.fixedCosts.value).toEqual(makeMoney(320500n, 'JOD'));
    expect(input.sales.value).toEqual({
      month1: parseRate('10'),
      month6: parseRate('40'),
      month12: parseRate('100'),
    });
  });

  it('keeps the stored provenance of each answer and lists it as the answer used', () => {
    const input = inputOf(basic(), allUser('F1', 'F3', 'F4', 'F6'));
    expect(input.price).toMatchObject({
      source: 'user',
      confidence: 'high',
      validated: true,
      inputs: [{ kind: 'answer', id: 'F1' }],
    });
    expect(input.fixedCosts.inputs).toEqual([{ kind: 'answer', id: 'F4' }]);
  });

  it('counts an answer without stored provenance as an unvalidated low-confidence assumption', () => {
    const input = inputOf(basic(), { F1: userHigh });
    expect(input.price.confidence).toBe('high');
    expect(input.variableCost).toMatchObject({
      source: 'assumption',
      confidence: 'low',
      validated: false,
    });
  });

  it('counts an answer given by a picked range as an assumption, whatever was stored (D-157)', () => {
    const input = inputOf(basic(), { F3: { ...userHigh, pickedRange: true } });
    expect(input.variableCost).toMatchObject({ source: 'assumption', confidence: 'high' });
  });

  it('keeps the stored source of an external or assumed answer', () => {
    const input = inputOf(basic(), {
      F4: { source: 'external', confidence: 'medium', validated: true },
    });
    expect(input.fixedCosts).toMatchObject({ source: 'external', confidence: 'medium' });
  });

  it('works in a currency with two decimals', () => {
    const dzd = { ...project, currency: 'DZD', country: 'DZ' };
    const answers: Answers = {
      F1: real({ amount: 1500.5, currency: 'DZD' }),
      F3: real(items(['Matières', 700.25, 'DZD'])),
      F4: real(items(['Loyer', 40000, 'DZD'])),
      F6: real({ month1: 5, month6: 6, month12: 7 }),
    };
    const input = inputOf(answers, {}, dzd);
    expect(input.price.value).toEqual(makeMoney(150050n, 'DZD'));
    expect(input.variableCost.value).toEqual(makeMoney(70025n, 'DZD'));
    expect(input.fixedCosts.value).toEqual(makeMoney(4000000n, 'DZD'));
  });

  it('sums with exact decimals', () => {
    const answers = { ...basic(), F3: real(items(['a', 0.1], ['b', 0.2])) };
    expect(inputOf(answers).variableCost.value.minor).toBe(300n);
  });

  it('reads decimal sales points exactly', () => {
    const answers = { ...basic(), F6: real({ month1: 0.5, month6: 2.25, month12: 0 }) };
    expect(inputOf(answers).sales.value).toEqual({
      month1: makeRate(1n, 2n),
      month6: makeRate(9n, 4n),
      month12: makeRate(0n, 1n),
    });
  });
});

describe('engineInputFrom: F3, F4 and F6 must be real answers (D-110)', () => {
  it.each(['F3', 'F4', 'F6'] as const)('stops when %s was never answered', (id) => {
    expect(reasonsOf(without(basic(), id))).toEqual([{ code: 'missing_answer', questionId: id }]);
  });

  it.each(['F3', 'F4', 'F6'] as const)('stops when %s is «لا أعرف»', (id) => {
    expect(reasonsOf({ ...basic(), [id]: UNKNOWN })).toEqual([
      { code: 'unknown_answer', questionId: id },
    ]);
  });

  it('stops when F1 was never answered', () => {
    expect(reasonsOf(without(basic(), 'F1'))).toEqual([
      { code: 'missing_answer', questionId: 'F1' },
    ]);
  });

  it('reports every problem at once, in the order the adapter reads them', () => {
    expect(reasonsOf({})).toEqual([
      { code: 'missing_answer', questionId: 'F1' },
      { code: 'missing_answer', questionId: 'F3' },
      { code: 'missing_answer', questionId: 'F4' },
      { code: 'missing_answer', questionId: 'F6' },
    ]);
  });
});

describe('engineInputFrom: one currency (D-180)', () => {
  it('stops on a USD amount in a JOD project and names the question and the item', () => {
    const answers = { ...basic(), F3: real(items(['Parts', 8], ['Imported motor', 12, 'USD'])) };
    expect(reasonsOf(answers)).toEqual([
      { code: 'currency_mismatch', questionId: 'F3', item: 'Imported motor', currency: 'USD' },
    ]);
  });

  it('checks every amount the adapter reads', () => {
    const usd = (amount: number) => ({ amount, currency: 'USD' });
    const answers: Answers = {
      F1: real(usd(25)),
      F3: real(items(['Parts', 8, 'EUR'])),
      F4: real(items(['Rent', 300, 'DZD'])),
      'F4.1': real(usd(50)),
      E8: real({
        items: [{ role: 'Technician', monthlyCost: usd(400), startMonth: 3 }],
      }),
      D4: real({ items: [{ name: 'Rival', price: usd(30) }] }),
      F5: real(items(['Tools', 90, 'SAR'])),
      F6: real({ month1: 1, month6: 2, month12: 3 }),
    };
    expect(reasonsOf(answers)).toEqual([
      { code: 'currency_mismatch', questionId: 'D4', item: 'Rival', currency: 'USD' },
      { code: 'currency_mismatch', questionId: 'F1', currency: 'USD' },
      { code: 'currency_mismatch', questionId: 'F3', item: 'Parts', currency: 'EUR' },
      { code: 'currency_mismatch', questionId: 'F4', item: 'Rent', currency: 'DZD' },
      { code: 'currency_mismatch', questionId: 'F4.1', currency: 'USD' },
      { code: 'currency_mismatch', questionId: 'E8', item: 'Technician', currency: 'USD' },
      { code: 'currency_mismatch', questionId: 'F5', item: 'Tools', currency: 'SAR' },
    ]);
  });

  it('stops on a project currency the engine does not know', () => {
    expect(reasonsOf(basic(), { ...project, currency: 'dinar' })).toEqual([
      { code: 'invalid_project', questionId: null, item: 'currency', currency: 'dinar' },
    ]);
  });

  it('stops on a reference date that is no date', () => {
    expect(reasonsOf(basic(), { ...project, referenceDate: '2026-02-30' })).toEqual([
      { code: 'invalid_project', questionId: null, item: 'reference_date' },
    ]);
  });

  it('reports both project problems together', () => {
    const reasons = reasonsOf(basic(), { ...project, currency: 'XXX1', referenceDate: 'soon' });
    expect(reasons.map((reason) => reason.item)).toEqual(['currency', 'reference_date']);
  });
});

describe('engineInputFrom: numbers it cannot read', () => {
  it('refuses NaN, infinite and negative amounts, naming the row', () => {
    const answers = {
      ...basic(),
      F3: real(items(['Parts', Number.NaN], ['Fuel', -1], ['Oil', Number.POSITIVE_INFINITY])),
    };
    expect(reasonsOf(answers)).toEqual([
      { code: 'invalid_value', questionId: 'F3', item: 'Parts' },
      { code: 'invalid_value', questionId: 'F3', item: 'Fuel' },
      { code: 'invalid_value', questionId: 'F3', item: 'Oil' },
    ]);
  });

  it('refuses a sales point that is negative or not a number', () => {
    for (const month6 of [-1, Number.NaN]) {
      const answers = { ...basic(), F6: real({ month1: 1, month6, month12: 3 }) };
      expect(reasonsOf(answers)).toEqual([{ code: 'invalid_value', questionId: 'F6' }]);
    }
  });

  it('refuses a growth that is negative and a capacity that is not a whole number', () => {
    const answers = { ...basic(), 'F6.2': real(-5), E7: real(2.5) };
    expect(reasonsOf(answers)).toEqual([
      { code: 'invalid_value', questionId: 'F6.2' },
      { code: 'invalid_value', questionId: 'E7' },
    ]);
    expect(reasonsOf({ ...basic(), E7: real(-3) })).toEqual([
      { code: 'invalid_value', questionId: 'E7' },
    ]);
  });
});

describe('engineInputFrom: an unknown F1 takes the median of the known D4 prices (D-110)', () => {
  const d4 = (...prices: (number | null)[]) =>
    real({
      items: prices.map((price, index) => ({
        name: `Competitor ${String(index + 1)}`,
        price: price === null ? null : jod(price),
      })),
    });
  const withD4 = (value: Answers['D4']): Answers => ({ ...basic(), F1: UNKNOWN, D4: value });

  it('uses the middle price of an odd count, as an assumption of low confidence', () => {
    const input = inputOf(withD4(d4(40, 20, 30)), allUser('D4', 'F3', 'F4', 'F6'));
    expect(input.price.value).toEqual(makeMoney(30000n, 'JOD'));
    expect(input.price).toMatchObject({
      source: 'assumption',
      confidence: 'low',
      validated: false,
    });
    expect(input.price.inputs).toEqual([
      { kind: 'answer', id: 'F1' },
      { kind: 'answer', id: 'D4' },
      { kind: 'rule', id: PRICE_FROM_D4_RULE },
    ]);
    expect(input.notes).toContainEqual({
      code: 'price_from_competitors',
      questionId: 'F1',
      state: 'unknown',
    });
  });

  it('ignores a competitor whose price is unknown', () => {
    expect(inputOf(withD4(d4(null, 50, 10, null))).price.value.minor).toBe(30000n);
    expect(inputOf(withD4(d4(null, 12.5))).price.value.minor).toBe(12500n);
  });

  it('averages the two middle prices of an even count and rounds half away from zero', () => {
    expect(inputOf(withD4(d4(20, 50, 30, 40))).price.value.minor).toBe(35000n);
    // 20.000 and 20.001 JOD: 20000.5 fils rounds to 20001.
    expect(inputOf(withD4(d4(20, 20.001))).price.value.minor).toBe(20001n);
  });

  it('copes with equal prices', () => {
    expect(inputOf(withD4(d4(30, 30, 10, 30))).price.value.minor).toBe(30000n);
  });

  it('is not calculable without a known competitor price', () => {
    expect(reasonsOf(withD4(d4(null, null)))).toEqual([{ code: 'no_price', questionId: 'F1' }]);
    expect(reasonsOf(withD4(undefined))).toEqual([{ code: 'no_price', questionId: 'F1' }]);
  });

  it('reports only the currency when every known competitor price is in another currency', () => {
    const usd = (amount: number) => ({ amount, currency: 'USD' });
    const d4 = real({ items: [{ name: 'Rival', price: usd(30) }] });
    expect(reasonsOf(withD4(d4))).toEqual([
      { code: 'currency_mismatch', questionId: 'D4', item: 'Rival', currency: 'USD' },
    ]);
  });

  it('leaves F1 alone when it has a real answer', () => {
    const input = inputOf({ ...basic(), D4: d4(1, 2, 3) });
    expect(input.price.value.minor).toBe(25000n);
    expect(input.notes.some((note) => note.code === 'price_from_competitors')).toBe(false);
  });

  it('carries D4 for later, with the unknown prices as null', () => {
    const input = inputOf({ ...basic(), D4: d4(null, 40) }, allUser('D4'));
    expect(input.competitorPrices?.value).toEqual([
      { name: 'Competitor 1', price: null },
      { name: 'Competitor 2', price: makeMoney(40000n, 'JOD') },
    ]);
    expect(input.competitorPrices?.source).toBe('user');
  });
});

describe('engineInputFrom: the optional answers and their fallbacks', () => {
  it('counts an unknown or missing F4.1 as zero marketing, with a note (D-183)', () => {
    const missing = inputOf(basic());
    expect(missing.marketing.value).toEqual(makeMoney(0n, 'JOD'));
    expect(missing.marketing).toMatchObject({ source: 'assumption', confidence: 'low' });
    expect(missing.marketing.inputs).toEqual([{ kind: 'answer', id: 'F4.1' }]);
    expect(missing.notes).toContainEqual({
      code: 'marketing_assumed_zero',
      questionId: 'F4.1',
      state: 'missing',
    });
    const unknown = inputOf({ ...basic(), 'F4.1': UNKNOWN });
    expect(unknown.marketing.value.minor).toBe(0n);
    expect(unknown.notes).toContainEqual({
      code: 'marketing_assumed_zero',
      questionId: 'F4.1',
      state: 'unknown',
    });
  });

  it('reads a real F4.1', () => {
    const input = inputOf({ ...basic(), 'F4.1': real(jod(50)) }, { 'F4.1': userHigh });
    expect(input.marketing.value).toEqual(makeMoney(50000n, 'JOD'));
    expect(input.marketing.source).toBe('user');
    expect(input.notes.some((note) => note.code === 'marketing_assumed_zero')).toBe(false);
  });

  it('asks the engine to estimate the growth when F6.2 is unknown or missing', () => {
    const missing = inputOf(basic());
    expect(missing.yearlyGrowth.value).toBeNull();
    expect(missing.yearlyGrowth).toMatchObject({ source: 'assumption', confidence: 'low' });
    expect(missing.notes).toContainEqual({
      code: 'growth_estimated',
      questionId: 'F6.2',
      state: 'missing',
    });
    expect(inputOf({ ...basic(), 'F6.2': UNKNOWN }).notes).toContainEqual({
      code: 'growth_estimated',
      questionId: 'F6.2',
      state: 'unknown',
    });
  });

  it('reads F6.2 as a percentage, exactly', () => {
    const input = inputOf({ ...basic(), 'F6.2': real(12.5) }, { 'F6.2': userHigh });
    expect(input.yearlyGrowth.value).toEqual(makeRate(1n, 8n));
    expect(input.yearlyGrowth.source).toBe('user');
    expect(input.notes.some((note) => note.code === 'growth_estimated')).toBe(false);
  });

  it('means no cap when E7 is unknown or missing, and reads a real E7', () => {
    const missing = inputOf(basic());
    expect(missing.capacity.value).toBeNull();
    expect(missing.notes).toContainEqual({
      code: 'capacity_unlimited',
      questionId: 'E7',
      state: 'missing',
    });
    expect(inputOf({ ...basic(), E7: UNKNOWN }).capacity.confidence).toBe('low');
    const capped = inputOf({ ...basic(), E7: real(30) }, { E7: userHigh });
    expect(capped.capacity.value).toBe(30n);
    expect(capped.capacity.source).toBe('user');
  });

  it('reads the peak months of D7, sorted, and nothing when the demand is not seasonal', () => {
    const seasonal = inputOf({ ...basic(), D7: real({ seasonal: true, peakMonths: [12, 1, 6] }) });
    expect(seasonal.peakMonths.value).toEqual([1, 6, 12]);
    const flat = inputOf({ ...basic(), D7: real({ seasonal: false, peakMonths: [] }) });
    expect(flat.peakMonths.value).toEqual([]);
    expect(flat.notes.some((note) => note.code === 'seasonality_unset')).toBe(false);
    const missing = inputOf(basic());
    expect(missing.peakMonths).toMatchObject({
      value: [],
      source: 'assumption',
      confidence: 'low',
    });
    expect(missing.notes).toContainEqual({
      code: 'seasonality_unset',
      questionId: 'D7',
      state: 'missing',
    });
  });

  it('reads the staff plan in project money, and nothing when it is unknown or missing', () => {
    const staff = {
      items: [
        { role: 'Technician', monthlyCost: jod(400), startMonth: 4 },
        { role: 'Driver', monthlyCost: jod(250.5), startMonth: 1 },
      ],
    };
    const input = inputOf({ ...basic(), E8: real(staff) }, { E8: userHigh });
    expect(input.staff.value).toEqual([
      { role: 'Technician', monthlyCost: makeMoney(400000n, 'JOD'), startMonth: 4 },
      { role: 'Driver', monthlyCost: makeMoney(250500n, 'JOD'), startMonth: 1 },
    ]);
    const none = inputOf({ ...basic(), E8: UNKNOWN });
    expect(none.staff.value).toEqual([]);
    expect(none.notes).toContainEqual({ code: 'staff_unset', questionId: 'E8', state: 'unknown' });
    expect(inputOf({ ...basic(), E8: real({ items: [] }) }).notes).toEqual([
      expect.objectContaining({ code: 'marketing_assumed_zero' }),
      expect.objectContaining({ code: 'growth_estimated' }),
      expect.objectContaining({ code: 'seasonality_unset' }),
      expect.objectContaining({ code: 'capacity_unlimited' }),
      expect.objectContaining({ code: 'setup_costs_unset' }),
      expect.objectContaining({ code: 'capital_unset' }),
      expect.objectContaining({ code: 'runway_unset' }),
      expect.objectContaining({ code: 'break_even_target_unset' }),
    ]);
  });

  it('carries F5, F2 and F7 for the pull requests that need them', () => {
    const input = inputOf(
      {
        ...basic(),
        F5: real(items(['Tools', 1200], ['Licence', 300.5])),
        F2: real('subscription'),
        F7: real('deposit'),
      },
      allUser('F5', 'F2', 'F7'),
    );
    expect(input.setupCosts?.value).toEqual(makeMoney(1500500n, 'JOD'));
    expect(input.setupCosts?.inputs).toEqual([{ kind: 'answer', id: 'F5' }]);
    expect(input.pricingModel?.value).toBe('subscription');
    expect(input.paymentOption?.value).toBe('deposit');
    expect(input.paymentOption?.source).toBe('user');
  });

  it('leaves F5, F2 and F7 empty when not answered, and notes the missing set-up costs', () => {
    const input = inputOf(basic());
    expect(input.setupCosts).toBeNull();
    expect(input.pricingModel).toBeNull();
    expect(input.paymentOption).toBeNull();
    expect(input.competitorPrices).toBeNull();
    expect(input.notes).toContainEqual({
      code: 'setup_costs_unset',
      questionId: 'F5',
      state: 'missing',
    });
    expect(inputOf({ ...basic(), F5: UNKNOWN }).notes).toContainEqual({
      code: 'setup_costs_unset',
      questionId: 'F5',
      state: 'unknown',
    });
  });

  it('ignores a payment option the engine does not know', () => {
    expect(inputOf({ ...basic(), F7: real('barter') }).paymentOption).toBeNull();
  });
});

describe('engineInputFrom: churn (F2.1), capital (A5), runway (A7) and break-even target (H5)', () => {
  const subscription = (): Answers => ({ ...basic(), F2: real('subscription') });

  it('reads the churn of a subscription as an exact monthly rate', () => {
    const input = inputOf({ ...subscription(), 'F2.1': real(2.5) }, allUser('F2', 'F2.1'));
    expect(input.churn.value).toEqual(makeRate(1n, 40n));
    expect(input.churn).toMatchObject({ source: 'user', confidence: 'high', validated: true });
    expect(input.churn.inputs).toEqual([{ kind: 'answer', id: 'F2.1' }]);
    expect(input.notes.some((note) => note.code === 'churn_unset')).toBe(false);
  });

  it('accepts a churn of 0 and of 100', () => {
    expect(inputOf({ ...subscription(), 'F2.1': real(0) }).churn.value).toEqual(makeRate(0n, 1n));
    expect(inputOf({ ...subscription(), 'F2.1': real(100) }).churn.value).toEqual(makeRate(1n, 1n));
  });

  it('leaves the churn out, with a note, when F2.1 is missing or unknown', () => {
    const missing = inputOf(subscription());
    expect(missing.churn.value).toBeNull();
    expect(missing.churn).toMatchObject({
      source: 'assumption',
      confidence: 'low',
      validated: false,
    });
    expect(missing.notes).toContainEqual({
      code: 'churn_unset',
      questionId: 'F2.1',
      state: 'missing',
    });
    expect(inputOf({ ...subscription(), 'F2.1': UNKNOWN }).notes).toContainEqual({
      code: 'churn_unset',
      questionId: 'F2.1',
      state: 'unknown',
    });
  });

  it('does not read, or note, the churn when the pricing model is not a subscription', () => {
    for (const answers of [basic(), { ...basic(), F2: real('fixed'), 'F2.1': real(5) }]) {
      const input = inputOf(answers);
      expect(input.churn.value).toBeNull();
      expect(input.notes.some((note) => note.code === 'churn_unset')).toBe(false);
    }
  });

  it.each([[-1], [100.5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'refuses a churn of %s as an invalid value',
    (churn) => {
      expect(reasonsOf({ ...subscription(), 'F2.1': real(churn) })).toEqual([
        { code: 'invalid_value', questionId: 'F2.1', item: undefined },
      ]);
    },
  );

  it('reads the capital range in the project currency', () => {
    const range = { min: 2000, max: 5000.5, currency: 'JOD' };
    const input = inputOf({ ...basic(), A5: real(range) }, allUser('A5'));
    expect(input.capital.value).toEqual({
      min: makeMoney(2000000n, 'JOD'),
      max: makeMoney(5000500n, 'JOD'),
    });
    expect(input.capital.inputs).toEqual([{ kind: 'answer', id: 'A5' }]);
    expect(input.capital.source).toBe('user');
  });

  it('leaves the capital out, with a note, when A5 is missing or unknown', () => {
    expect(inputOf(basic()).capital.value).toBeNull();
    expect(inputOf(basic()).notes).toContainEqual({
      code: 'capital_unset',
      questionId: 'A5',
      state: 'missing',
    });
    expect(inputOf({ ...basic(), A5: UNKNOWN }).notes).toContainEqual({
      code: 'capital_unset',
      questionId: 'A5',
      state: 'unknown',
    });
  });

  it('does not convert a capital in another currency, and does not stop the run for it (D-113)', () => {
    const input = inputOf({ ...basic(), A5: real({ min: 3000, max: 9000, currency: 'USD' }) });
    expect(input.capital.value).toBeNull();
    expect(input.notes).toContainEqual({
      code: 'capital_other_currency',
      questionId: 'A5',
      currency: 'USD',
    });
    expect(input.notes.some((note) => note.code === 'capital_unset')).toBe(false);
  });

  it.each([
    [{ min: -1, max: 5, currency: 'JOD' }],
    [{ min: 1, max: Number.NaN, currency: 'JOD' }],
    [{ min: 9000, max: 3000, currency: 'JOD' }],
  ])('refuses a capital range that is negative, reversed or unreadable: %j', (range) => {
    expect(reasonsOf({ ...basic(), A5: real(range) })).toEqual([
      { code: 'invalid_value', questionId: 'A5', item: undefined },
    ]);
  });

  it.each([
    ['lt3', { kind: 'within', months: 3 }],
    ['3to6', { kind: 'within', months: 6 }],
    ['6to12', { kind: 'within', months: 12 }],
    ['gt12', { kind: 'unbounded' }],
  ])('reads the runway option %s (A7) as its upper bound', (option, limit) => {
    const input = inputOf({ ...basic(), A7: real(option) }, allUser('A7'));
    expect(input.runway.value).toEqual(limit);
    expect(input.runway).toMatchObject({ source: 'user', inputs: [{ kind: 'answer', id: 'A7' }] });
  });

  it.each([
    ['m6', { kind: 'within', months: 6 }],
    ['m12', { kind: 'within', months: 12 }],
    ['m18', { kind: 'within', months: 18 }],
    ['m24', { kind: 'within', months: 24 }],
    ['m36', { kind: 'within', months: 36 }],
    ['more', { kind: 'unbounded' }],
  ])('reads the break-even option %s (H5) as its upper bound', (option, limit) => {
    const input = inputOf({ ...basic(), H5: real(option) }, allUser('H5'));
    expect(input.breakEvenTarget.value).toEqual(limit);
    expect(input.breakEvenTarget.inputs).toEqual([{ kind: 'answer', id: 'H5' }]);
  });

  it('leaves the runway and the break-even target unset, with notes, when missing or unknown', () => {
    const input = inputOf(basic());
    expect(input.runway.value).toEqual({ kind: 'unset' });
    expect(input.breakEvenTarget.value).toEqual({ kind: 'unset' });
    expect(input.runway).toMatchObject({
      source: 'assumption',
      confidence: 'low',
      validated: false,
    });
    expect(input.notes).toContainEqual({
      code: 'runway_unset',
      questionId: 'A7',
      state: 'missing',
    });
    expect(input.notes).toContainEqual({
      code: 'break_even_target_unset',
      questionId: 'H5',
      state: 'missing',
    });
    const unknown = inputOf({ ...basic(), A7: UNKNOWN, H5: UNKNOWN });
    expect(unknown.notes).toContainEqual({
      code: 'runway_unset',
      questionId: 'A7',
      state: 'unknown',
    });
    expect(unknown.notes).toContainEqual({
      code: 'break_even_target_unset',
      questionId: 'H5',
      state: 'unknown',
    });
  });

  it('refuses an option the question bank does not offer', () => {
    expect(reasonsOf({ ...basic(), A7: real('forever'), H5: real('never') })).toEqual([
      { code: 'invalid_value', questionId: 'A7', item: undefined },
      { code: 'invalid_value', questionId: 'H5', item: undefined },
    ]);
  });
});
