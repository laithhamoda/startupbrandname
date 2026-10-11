import type { Answers } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { defaultFigure } from './figure';
import { fxTest, FX_RULES, type FxTest } from './fx-test';
import { engineInputFrom, type EngineInput, type ProjectContext } from './input';
import { makeMoney, type Money } from './money';
import { createEngineParams } from './params';
import { firstProfitableMonth, projectOperatingLines } from './projection';
import { makeRate, parseRate } from './rate';
import type { TaxRule } from './tax';

const fils = (amount: bigint): Money => makeMoney(amount, 'JOD');

const project: ProjectContext = {
  country: 'JO',
  currency: 'JOD',
  mode: 'full',
  referenceDate: '2026-10-05',
};
const real = (value: unknown) => ({ status: 'answered' as const, value });

/**
 * Price 25, variable cost 10.5, fixed cost 320.5 a month, sales 10, 40, 100 at 20% a year, set-up
 * costs 2,000, paid in cash. Year 1 sells 557 units (10, 13, 17, 23, 30, 40, 47, 54, 63, 74, 86, 100).
 */
const answers = (more: Answers = {}): Answers => ({
  F1: real({ amount: 25, currency: 'JOD' }),
  F3: real({ items: [{ label: 'Parts', amount: 10.5, currency: 'JOD' }] }),
  F4: real({ items: [{ label: 'Rent', amount: 320.5, currency: 'JOD' }] }),
  F6: real({ month1: 10, month6: 40, month12: 100 }),
  'F6.2': real(20),
  F5: real({ items: [{ label: 'Tools', amount: 2000, currency: 'JOD' }] }),
  F7: real('cash'),
  ...more,
});

function inputOf(more: Answers = {}): EngineInput {
  const result = engineInputFrom(answers(more), {}, project);
  if (result.status !== 'ok') throw new Error(JSON.stringify(result.reasons));
  return result.input;
}

function test(more: Answers = {}, context?: { rules: TaxRule[] }): FxTest {
  const result = fxTest(
    inputOf({ D6: real({ answer: true, percent: 50 }), ...more }),
    undefined,
    context,
  );
  if (result === null) throw new Error('expected an FX test');
  return result;
}

describe('the FX test with half of the costs imported (D6 = yes, 50%)', () => {
  const result = test();

  it('keeps D6 as the share and tries -20%, -10%, +10% and +20%, in that order', () => {
    expect(result.share.value).toEqual(makeRate(1n, 2n));
    expect(result.share.inputs).toEqual([{ kind: 'answer', id: 'D6' }]);
    expect(result.shocks.map((shock) => shock.shock)).toEqual([
      parseRate('-0.2'),
      parseRate('-0.1'),
      parseRate('0.1'),
      parseRate('0.2'),
    ]);
  });

  it('multiplies COGS by 1 - share + share x (1 + shock): 0.9, 0.95, 1.05 and 1.1', () => {
    // 1/2 of the COGS is unchanged and 1/2 moves by the shock: 0.5 + 0.5 x 1.2 = 1.1.
    expect(result.shocks.map((shock) => shock.cogsMultiplier)).toEqual([
      parseRate('0.9'),
      parseRate('0.95'),
      parseRate('1.05'),
      parseRate('1.1'),
    ]);
  });

  it('reports the operating profit of year 1 with the shocked COGS', () => {
    // A unit costs 10,500 fils; times the multiplier it costs 9,450 / 9,975 / 11,025 / 11,550 fils and
    // earns 25,000 less that. Year 1 sells 557 units against 12 x 320.500 = 3,846.000 of fixed cost.
    // -20%: 557 x 15,550 - 3,846,000 = 4,815,350 fils.  -10%: 557 x 15,025 - 3,846,000 = 4,522,925.
    // +10%: 557 x 13,975 - 3,846,000 = 3,938,075.     +20%: 557 x 13,450 - 3,846,000 = 3,645,650.
    expect(result.shocks.map((shock) => shock.firstYearOperatingProfit.value)).toEqual([
      fils(4_815_350n),
      fils(4_522_925n),
      fils(3_938_075n),
      fils(3_645_650n),
    ]);
  });

  it('reports the break-even month with the shocked COGS', () => {
    // Break-even needs units x margin >= 320.5: at +20% the margin is 13.45, so 24 units (month 5);
    // at the other shocks 23 units are enough (month 4), as in the plain project.
    expect(result.shocks.map((shock) => shock.breakEvenMonth.value)).toEqual([4, 4, 4, 5]);
  });

  it('reports the funding need of the cash flow with the shocked COGS', () => {
    // Cumulative cash starts at -2,000. At +20% the first months lose 186, 145.65, 91.85 and 11.15,
    // so the lowest point is -2,434.65 in month 4; at -20% they lose 165, 118.35 and 56.15, so it is
    // -2,339.5 in month 3. The plain project needs 2,381.5.
    expect(result.shocks[3]?.fundingNeed?.value).toEqual(fils(2_434_650n));
    expect(result.shocks[0]?.fundingNeed?.value).toEqual(fils(2_339_500n));
  });

  it('is worse for a dearer import: the funding need rises and the profit falls with the shock', () => {
    const needs = result.shocks.map((shock) => shock.fundingNeed?.value.minor ?? 0n);
    const profits = result.shocks.map((shock) => shock.firstYearOperatingProfit.value.minor);
    expect([...needs].sort((a, b) => Number(a - b))).toEqual(needs);
    expect([...profits].sort((a, b) => Number(b - a))).toEqual(profits);
  });

  it('lists D6, the shocks, the multiplier and the test among the inputs of every figure', () => {
    for (const shock of result.shocks) {
      for (const figure of [
        shock.breakEvenMonth,
        shock.fundingNeed,
        shock.firstYearOperatingProfit,
      ]) {
        expect(figure?.inputs).toContainEqual({ kind: 'answer', id: 'D6' });
        expect(figure?.inputs).toContainEqual({ kind: 'default', id: 'fx.cogs_shocks' });
        expect(figure?.inputs).toContainEqual({ kind: 'rule', id: FX_RULES.test });
      }
      expect(shock.firstYearOperatingProfit.inputs).toContainEqual({
        kind: 'rule',
        id: 'T9.cogs_multiplier',
      });
      expect(shock.breakEvenMonth.source).toBe('assumption');
    }
  });
});

describe('the FX test on other shares and shocks', () => {
  it('shocks all of the COGS when the whole cost is imported, down to zero at -100%', () => {
    const input = inputOf({ D6: real({ answer: true, percent: 100 }) });
    const params = createEngineParams({ fxShocks: defaultFigure('f', [parseRate('-1')]) });
    const result = fxTest(input, params);
    expect(result?.shocks[0]?.cogsMultiplier).toEqual(parseRate('0'));
    // No COGS: a unit earns 25 and 13 units cover 320.5 in month 2. Year 1: 557 x 25,000 - 3,846,000.
    expect(result?.shocks[0]?.breakEvenMonth.value).toBe(2);
    expect(result?.shocks[0]?.firstYearOperatingProfit.value).toEqual(fils(10_079_000n));
  });

  it('gives the break-even month null when the shocked project never reaches it', () => {
    // A margin of 25 - 10.5 x 3.5 is negative: the project never earns its fixed cost.
    const input = inputOf({ D6: real({ answer: true, percent: 100 }) });
    const params = createEngineParams({ fxShocks: defaultFigure('f', [parseRate('2.5')]) });
    expect(fxTest(input, params)?.shocks[0]?.breakEvenMonth.value).toBeNull();
  });

  it('has no test when D6 is "no", 0 percent, unknown or missing', () => {
    expect(fxTest(inputOf({ D6: real({ answer: false }) }))).toBeNull();
    expect(fxTest(inputOf({ D6: real({ answer: true, percent: 0 }) }))).toBeNull();
    expect(fxTest(inputOf({ D6: { status: 'unknown' } }))).toBeNull();
    expect(fxTest(inputOf())).toBeNull();
  });

  it('still reports the break-even month and the profit without F5, but no funding need', () => {
    const input = inputOf({ D6: real({ answer: true, percent: 50 }), F5: { status: 'unknown' } });
    const result = fxTest(input);
    expect(result?.shocks.map((shock) => shock.fundingNeed)).toEqual([null, null, null, null]);
    expect(result?.shocks.map((shock) => shock.breakEvenMonth.value)).toEqual([4, 4, 4, 5]);
  });

  it('runs the tax and the cash flow again on the shocked profit', () => {
    // A tax of 100,000 JOD a year, paid in month 13: it deepens the funding need of every shock.
    const heavy: TaxRule = {
      id: 'fixture.jo.heavy',
      countryCode: 'JO',
      legalForm: 'sole',
      regime: 'fixture_regime',
      levy: 'heavy',
      kind: 'tax',
      basis: 'fixed',
      rate: null,
      brackets: [],
      fixedAmount: makeMoney(100_000_000n, 'JOD'),
      minimum: null,
      turnoverCeiling: null,
      paymentMonth: 1,
      currency: 'JOD',
      effectiveFrom: '2020-01-01',
      sourceUrl: 'https://example.test/fixture',
      lastVerified: null,
      status: 'unverified',
    };
    const plain = test();
    const taxed = test({}, { rules: [heavy] });
    taxed.shocks.forEach((shock, index) => {
      const without = plain.shocks[index]?.fundingNeed?.value.minor ?? 0n;
      expect(shock.fundingNeed?.value.minor ?? 0n).toBeGreaterThan(without);
    });
    // The operating profit and the break-even month are before tax.
    expect(taxed.shocks.map((shock) => shock.firstYearOperatingProfit.value)).toEqual(
      plain.shocks.map((shock) => shock.firstYearOperatingProfit.value),
    );
    expect(taxed.shocks[3]?.fundingNeed?.inputs).toContainEqual({
      kind: 'country_pack_item',
      id: 'fixture.jo.heavy',
    });
  });

  it('leaves the plain projection alone', () => {
    const input = inputOf({ D6: real({ answer: true, percent: 50 }) });
    const before = projectOperatingLines(input);
    fxTest(input);
    expect(projectOperatingLines(input)).toEqual(before);
    expect(firstProfitableMonth(before)).toBe(4);
  });
});
