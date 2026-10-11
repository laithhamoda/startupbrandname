import type { Answers } from '@sbn/question-bank';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cashFlow, CASH_FLOW_RULES, type CashFlow, type OkCashFlow } from './cash-flow';
import { engineInputFrom, type EngineInput, type ProjectContext } from './input';
import { makeMoney, type Money } from './money';
import { createEngineParams, PAYMENT_OPTIONS, type PaymentOption } from './params';
import { projectOperatingLines, type OperatingProjection, type ProjectionLine } from './projection';
import { makeRate } from './rate';
import { taxAnalysis, type TaxAnalysis, type TaxRule } from './tax';

const fils = (amount: bigint): Money => makeMoney(amount, 'JOD');
const jod = (units: number): Money => fils(BigInt(units) * 1000n);

const project: ProjectContext = {
  country: 'JO',
  currency: 'JOD',
  mode: 'full',
  referenceDate: '2026-10-05',
};
const real = (value: unknown) => ({ status: 'answered' as const, value });
const UNKNOWN = { status: 'unknown' as const };
const items = (label: string, amount: number) => ({
  items: [{ label, amount, currency: 'JOD' }],
});

/** Price 25, variable cost 10.5, fixed cost 320.5 a month, sales 10, 40, 100 at 20% a year. */
const answers = (more: Answers = {}): Answers => ({
  F1: real({ amount: 25, currency: 'JOD' }),
  F3: real(items('Parts', 10.5)),
  F4: real(items('Rent', 320.5)),
  F6: real({ month1: 10, month6: 40, month12: 100 }),
  'F6.2': real(20),
  F5: real(items('Tools', 2000)),
  ...more,
});

function inputFrom(given: Answers): EngineInput {
  const result = engineInputFrom(given, {}, project);
  if (result.status !== 'ok') throw new Error(JSON.stringify(result.reasons));
  return result.input;
}

const inputOf = (more: Answers = {}): EngineInput => inputFrom(answers(more));

const noTax = (input: EngineInput, projection: OperatingProjection): TaxAnalysis =>
  taxAnalysis(input, projection);

function run(more: Answers = {}, tax?: TaxRule[]) {
  const input = inputOf(more);
  const projection = projectOperatingLines(input);
  const analysis =
    tax === undefined ? noTax(input, projection) : taxAnalysis(input, projection, { rules: tax });
  return { input, projection, tax: analysis, flow: cashFlow(input, projection, analysis) };
}

function ok(flow: CashFlow): OkCashFlow {
  if (flow.status !== 'ok') throw new Error('expected a cash flow');
  return flow;
}

const minors = (line: ProjectionLine<Money>) => line.monthly.map((amount) => amount.minor);
const cumulativeJod = (flow: OkCashFlow) => flow.cumulative.value.map((amount) => amount.minor);

/** A projection whose monthly revenue, COGS and operating costs are the given fils (zero if not given, and after them). */
function withLines(
  base: OperatingProjection,
  lines: { revenue?: readonly bigint[]; cogs?: readonly bigint[]; costs?: readonly bigint[] },
): OperatingProjection {
  const horizon = base.calendar.horizonMonths;
  const set = (
    line: ProjectionLine<Money>,
    given: readonly bigint[] = [],
  ): ProjectionLine<Money> => ({
    ...line,
    monthly: Array.from({ length: horizon }, (_, index) => fils(given[index] ?? 0n)),
  });
  return {
    ...base,
    revenue: set(base.revenue, lines.revenue),
    cogs: set(base.cogs, lines.cogs),
    operatingCosts: set(base.operatingCosts, lines.costs),
  };
}

/** `first` values, then `rest` for every month up to 36. */
const series = (first: readonly bigint[], rest: bigint): bigint[] => [
  ...first,
  ...Array.from({ length: 36 - first.length }, () => rest),
];

function synthetic(
  more: Answers,
  lines: { revenue?: readonly bigint[]; cogs?: readonly bigint[]; costs?: readonly bigint[] },
  tax?: TaxRule[],
) {
  const input = inputOf(more);
  const projection = withLines(projectOperatingLines(input), lines);
  const analysis =
    tax === undefined ? noTax(input, projection) : taxAnalysis(input, projection, { rules: tax });
  return ok(cashFlow(input, projection, analysis));
}

describe('the funding need and the payback of the worked example', () => {
  // Set-up 5,000 JOD paid in month 0; net cash is -1,000 in month 1, -500 in month 2, then +200 a month.
  // Cumulative cash: -5,000 | -6,000, -6,500, -6,300, -6,100, ... Lowest -6,500 in month 2.
  const lines = {
    revenue: series([0n, 0n], 200_000n),
    costs: series([1_000_000n, 500_000n], 0n),
  };
  const flow = synthetic({ F5: real(items('Tools', 5000)) }, lines);

  it('starts from zero before the set-up costs and pays them in month 0', () => {
    expect(flow.cumulative.value).toHaveLength(37);
    expect(flow.cumulative.value[0]).toEqual(jod(-5000));
    expect(flow.setupCosts.value).toEqual(jod(5000));
  });

  it('has the cumulative cash of each month', () => {
    const cumulative = flow.cumulative.value;
    expect(cumulative.slice(0, 5)).toEqual([
      jod(-5000),
      jod(-6000),
      jod(-6500),
      jod(-6300),
      jod(-6100),
    ]);
    // Month 36: -6,500 + 34 months of +200 = +300.
    expect(cumulative[36]).toEqual(jod(300));
  });

  it('finds the lowest cumulative cash, -6,500 in month 2, and a funding need of 6,500', () => {
    expect(flow.lowest.value).toEqual({ month: 2, cumulative: jod(-6500) });
    expect(flow.fundingNeed.value).toEqual(jod(6500));
  });

  it('counts the payback from month 1 to the month the cash is back at zero for good', () => {
    // Month m has -6,500 + 200 (m - 2): month 34 is still -100 and month 35 is +100.
    expect(flow.cumulative.value[34]).toEqual(jod(-100));
    expect(flow.cumulative.value[35]).toEqual(jod(100));
    expect(flow.payback.value).toBe(35);
  });

  it('reports "not within 3 years" (null) when the cash is still negative in month 36', () => {
    const slow = synthetic(
      { F5: real(items('Tools', 5000)) },
      { revenue: series([0n, 0n], 100_000n), costs: series([1_000_000n, 500_000n], 0n) },
    );
    // Month 36: -6,500 + 34 * 100 = -3,100.
    expect(slow.cumulative.value[36]).toEqual(jod(-3100));
    expect(slow.fundingNeed.value).toEqual(jod(6500));
    expect(slow.payback.value).toBeNull();
  });

  it('reports a payback of zero, and no funding need, when the cash is never below zero', () => {
    const rich = synthetic({ F5: real(items('Tools', 0)) }, { revenue: series([], 1_000n) });
    expect(rich.payback.value).toBe(0);
    expect(rich.fundingNeed.value).toEqual(jod(0));
    expect(rich.lowest.value).toEqual({ month: 0, cumulative: jod(0) });
  });

  it('needs the cash to stay at zero or above: a dip after a first recovery moves the payback', () => {
    // Set-up 0.100: -0.100, then +0.200 (0.100), -0.300 (-0.200), +0.300 (0.100), then nothing.
    const dips = synthetic(
      { F5: real(items('Tools', 0.1)) },
      { revenue: [200n, 0n, 300n], costs: [0n, 300n] },
    );
    expect(cumulativeJod(dips).slice(0, 5)).toEqual([-100n, 100n, -200n, 100n, 100n]);
    expect(dips.payback.value).toBe(3);
    expect(dips.fundingNeed.value).toEqual(fils(200n));
  });

  it('pays back in month 1 when the first month already covers the set-up costs', () => {
    const quick = synthetic({ F5: real(items('Tools', 0.1)) }, { revenue: [150n] });
    expect(quick.payback.value).toBe(1);
  });

  it('takes the first month of the lowest value when two months tie', () => {
    const tie = synthetic({ F5: real(items('Tools', 1)) }, {});
    expect(tie.lowest.value).toEqual({ month: 0, cumulative: jod(-1) });
    expect(tie.fundingNeed.value).toEqual(jod(1));
    expect(tie.payback.value).toBeNull();
  });
});

describe('when the cash of a sale arrives (F7, D-187)', () => {
  const sale = (month: number, amount: bigint) =>
    Array.from({ length: month }, (_, index) => (index === month - 1 ? amount : 0n));
  const receiptsOf = (option: PaymentOption | undefined, revenue: readonly bigint[]) =>
    synthetic(option === undefined ? {} : { F7: real(option) }, { revenue });

  it('cash comes in the month of the sale', () => {
    expect(minors(receiptsOf('cash', sale(3, 700n)).receipts).slice(0, 5)).toEqual([
      0n,
      0n,
      700n,
      0n,
      0n,
    ]);
  });

  it('credit comes in the month after', () => {
    expect(minors(receiptsOf('credit', sale(3, 700n)).receipts).slice(0, 5)).toEqual([
      0n,
      0n,
      0n,
      700n,
      0n,
    ]);
  });

  it('instalments come in three equal parts from the month of the sale, the remainder in the first', () => {
    // 1,000.000 JOD is 1,000,000 fils: 333,333 twice and 333,334 first.
    const flow = receiptsOf('instalments', sale(1, 1_000_000n));
    expect(minors(flow.receipts).slice(0, 4)).toEqual([333_334n, 333_333n, 333_333n, 0n]);
    expect(flow.receipts.monthly[0]).toEqual(fils(333_334n));
  });

  it('a deposit is half in the month of the sale and half the month after, the odd fil in the first', () => {
    expect(minors(receiptsOf('deposit', sale(1, 1_001n)).receipts).slice(0, 3)).toEqual([
      501n,
      500n,
      0n,
    ]);
    expect(minors(receiptsOf('deposit', sale(1, 1_000n)).receipts).slice(0, 3)).toEqual([
      500n,
      500n,
      0n,
    ]);
  });

  it('adds the parts of different sales in the month they fall together', () => {
    const flow = receiptsOf('instalments', [300n, 600n, 900n]);
    // Sale 1: 100, 100, 100 in months 1, 2, 3. Sale 2: 200 in 2, 3, 4. Sale 3: 300 in 3, 4, 5.
    expect(minors(flow.receipts).slice(0, 6)).toEqual([100n, 300n, 600n, 500n, 300n, 0n]);
  });

  it('takes cash when F7 is missing, as an assumption, and says so', () => {
    const flow = receiptsOf(undefined, sale(2, 500n));
    expect(minors(flow.receipts).slice(0, 3)).toEqual([0n, 500n, 0n]);
    expect(flow.notes).toContainEqual({ code: 'payment_assumed_cash' });
    expect(flow.receipts.provenance).toMatchObject({
      source: 'assumption',
      confidence: 'low',
      validated: false,
    });
    expect(flow.receipts.provenance.inputs).toContainEqual({ kind: 'answer', id: 'F7' });
    expect(
      receiptsOf('cash', sale(2, 500n)).notes.some((note) => note.code === 'payment_assumed_cash'),
    ).toBe(false);
  });

  it('leaves out the receipts after month 36 and notes them', () => {
    // A sale of 1,000 fils every month on credit: month 36 sale arrives in month 37.
    const credit = receiptsOf('credit', series([], 1_000n));
    expect(credit.receipts.monthly[0]).toEqual(fils(0n));
    expect(credit.receipts.monthly[35]).toEqual(fils(1_000n));
    expect(credit.receiptsAfterHorizon.value).toEqual(fils(1_000n));
    expect(credit.notes).toContainEqual({ code: 'receipts_after_horizon' });
    // Instalments: the sales of months 35 and 36 have 1 and 2 parts of 333 (and 334) left over.
    const instalments = receiptsOf('instalments', series([], 3_000n));
    expect(instalments.receiptsAfterHorizon.value).toEqual(fils(3_000n));
    expect(instalments.receipts.monthly[0]).toEqual(fils(1_000n));
    expect(instalments.receipts.monthly[1]).toEqual(fils(2_000n));
    expect(instalments.receipts.monthly[2]).toEqual(fils(3_000n));
    // Month 35's sale puts 1,000 in month 37; month 36's puts 1,000 in 37 and 1,000 in 38: 3,000 in all.
    expect(sumOf(instalments.receipts) + instalments.receiptsAfterHorizon.value.minor).toBe(
      36n * 3_000n,
    );
  });

  it('notes nothing when everything arrives inside the horizon', () => {
    const flow = receiptsOf('cash', series([], 1_000n));
    expect(flow.receiptsAfterHorizon.value).toEqual(fils(0n));
    expect(flow.notes.some((note) => note.code === 'receipts_after_horizon')).toBe(false);
  });

  it('follows the timing parameter, with the share of each part adding up to the sale', () => {
    const params = createEngineParams({
      paymentTiming: {
        credit: {
          ...createEngineParams().paymentTiming.credit,
          value: [
            { delayMonths: 2, share: makeRate(1n, 4n) },
            { delayMonths: 0, share: makeRate(3n, 4n) },
          ],
        },
      },
    });
    const input = inputOf({ F7: real('credit') });
    const projection = withLines(projectOperatingLines(input), { revenue: [1_001n] });
    const flow = ok(cashFlow(input, projection, noTax(input, projection), params));
    // 3/4 of 1,001 is 750 (floored) in month 1; the first part, 2 months after the sale, gets the
    // remainder, 251.
    expect(minors(flow.receipts).slice(0, 4)).toEqual([750n, 0n, 251n, 0n]);
  });
});

const sumOf = (line: ProjectionLine<Money>): bigint =>
  line.monthly.reduce((sum, amount) => sum + amount.minor, 0n);

describe('the cash flow of the hand-checked project (set-up 2,000 JOD)', () => {
  // Month 1 to 12 units 10, 13, 17, 23, 30, 40, 47, 54, 63, 74, 86, 100; a unit earns 14.5 JOD over
  // its COGS and the fixed cost is 320.5 a month. Operating profit of the first months, in JOD:
  // -175.5, -132, -74, +13, +114.5, +259.5, +361, +462.5, +593, +752.5, +926.5, +1129.5.
  const cash = run({ F7: real('cash') });
  const cashFlowOk = ok(cash.flow);

  it('adds up to the operating profit of the horizon less the set-up costs when everything is paid in cash', () => {
    const profit = cash.projection.operatingProfit.monthly.reduce(
      (sum, amount) => sum + amount.minor,
      0n,
    );
    // 4,230.5 + 15,395.5 + 19,252.5 = 38,878.5 JOD of operating profit in three years.
    expect(profit).toBe(38_878_500n);
    expect(cashFlowOk.cumulative.value[36]).toEqual(fils(38_878_500n - 2_000_000n));
    expect(minors(cashFlowOk.netCash)).toEqual(minors(cash.projection.operatingProfit));
    expect(cashFlowOk.receiptsAfterHorizon.value).toEqual(fils(0n));
  });

  it('has a funding need of 2,381.5 JOD in month 3 and pays back in month 10', () => {
    // Cumulative: -2,000 | -2,175.5, -2,307.5, -2,381.5, -2,368.5, -2,254, -1,994.5, -1,633.5, -1,171, -578, +174.5.
    expect(cumulativeJod(cashFlowOk).slice(0, 11)).toEqual([
      -2_000_000n,
      -2_175_500n,
      -2_307_500n,
      -2_381_500n,
      -2_368_500n,
      -2_254_000n,
      -1_994_500n,
      -1_633_500n,
      -1_171_000n,
      -578_000n,
      174_500n,
    ]);
    expect(cashFlowOk.lowest.value.month).toBe(3);
    expect(cashFlowOk.fundingNeed.value).toEqual(fils(2_381_500n));
    expect(cashFlowOk.payback.value).toBe(10);
  });

  it('on credit the cash comes a month late: funding need 3,004 JOD in month 5, payback in month 13', () => {
    // Cumulative on credit = cumulative in cash less the revenue of the same month:
    // month 5 is -2,254 - 750 = -3,004; month 12 is 2,230.5 - 2,500 = -269.5; month 13 is 3,389 - 2,550 = +839.
    const credit = ok(run({ F7: real('credit') }).flow);
    expect(credit.lowest.value).toEqual({ month: 5, cumulative: fils(-3_004_000n) });
    expect(credit.fundingNeed.value).toEqual(fils(3_004_000n));
    expect(credit.cumulative.value[12]).toEqual(fils(-269_500n));
    expect(credit.cumulative.value[13]).toEqual(fils(839_000n));
    expect(credit.payback.value).toBe(13);
    // The month-36 sale (144 units at 25 JOD = 3,600 JOD) arrives after the horizon.
    expect(credit.receiptsAfterHorizon.value).toEqual(jod(3_600));
    expect(credit.cumulative.value[36]).toEqual(fils(38_878_500n - 2_000_000n - 3_600_000n));
  });

  it('keeps the columns as sums of the months', () => {
    expect(cashFlowOk.receipts.byPeriod).toHaveLength(20);
    expect(cashFlowOk.netCash.byPeriod.reduce((sum, amount) => sum + amount.minor, 0n)).toBe(
      sumOf(cashFlowOk.netCash),
    );
    expect(cashFlowOk.cogsPaid).toBe(cash.projection.cogs);
    expect(cashFlowOk.operatingCostsPaid).toBe(cash.projection.operatingCosts);
  });
});

describe('tax in the cash flow (D-186, D-187)', () => {
  // 2% of turnover paid in month 4 of the next year: 278.5 JOD in month 16, 663.5 in month 28 and
  // 796.5 in month 40, which is after the horizon.
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
    turnoverCeiling: null,
    paymentMonth: 4,
    currency: 'JOD',
    effectiveFrom: '2020-01-01',
    sourceUrl: 'https://example.test/fixture',
    lastVerified: null,
    status: 'unverified',
  };
  const untaxed = ok(run({ F7: real('cash') }).flow);
  const taxed = ok(run({ F7: real('cash') }, [rule]).flow);

  it('pays the tax of year 1 in month 16 and of year 2 in month 28', () => {
    const paid = taxed.taxPaid;
    expect(paid?.monthly[15]).toEqual(fils(278_500n));
    expect(paid?.monthly[27]).toEqual(fils(663_500n));
    expect(paid?.monthly.filter((amount) => amount.minor !== 0n)).toHaveLength(2);
    expect(taxed.taxIncluded).toBe(true);
  });

  it('takes the tax out of the net cash of the month it is paid', () => {
    expect(taxed.netCash.monthly[15]?.minor).toBe(
      (untaxed.netCash.monthly[15]?.minor ?? 0n) - 278_500n,
    );
    expect(taxed.netCash.monthly[14]).toEqual(untaxed.netCash.monthly[14]);
  });

  it('leaves the tax of year 3, paid in month 40, after the horizon and notes it', () => {
    expect(taxed.taxAfterHorizon?.value).toEqual(fils(796_500n));
    expect(taxed.notes).toContainEqual({ code: 'tax_after_horizon' });
    // Only the taxes inside the 36 months reduce the cash: 278.5 + 663.5 = 942.
    expect(untaxed.cumulative.value[36]?.minor).toBe(
      (taxed.cumulative.value[36]?.minor ?? 0n) + 942_000n,
    );
  });

  it('flags a cash flow without tax when the regime was not calculated, and says so', () => {
    expect(untaxed.taxIncluded).toBe(false);
    expect(untaxed.taxPaid).toBeNull();
    expect(untaxed.taxAfterHorizon).toBeNull();
    expect(untaxed.notes).toContainEqual({ code: 'tax_not_calculated' });
    expect(taxed.notes.some((note) => note.code === 'tax_not_calculated')).toBe(false);
  });

  it('lists the tax rule among the inputs of the net cash, so a fixture shows', () => {
    expect(taxed.netCash.provenance.inputs).toContainEqual({
      kind: 'country_pack_item',
      id: 'fixture.jo.sole.income',
    });
    expect(untaxed.netCash.provenance.inputs.some((ref) => ref.kind === 'country_pack_item')).toBe(
      false,
    );
  });

  it('does not note the tax after the horizon when nothing is due', () => {
    const zero = ok(run({ F7: real('cash') }, [{ ...rule, rate: makeRate(0n, 1n) }]).flow);
    expect(zero.taxAfterHorizon?.value).toEqual(fils(0n));
    expect(zero.notes.some((note) => note.code === 'tax_after_horizon')).toBe(false);
  });
});

describe('the cash flow without set-up costs (F5)', () => {
  it('is not calculable when F5 was never answered, and says so; the projection stays', () => {
    const input = inputFrom(
      Object.fromEntries(Object.entries(answers()).filter(([id]) => id !== 'F5')),
    );
    const projection = projectOperatingLines(input);
    expect(input.setupCosts).toBeNull();
    expect(projection.operatingProfit.monthly).toHaveLength(36);
    expect(cashFlow(input, projection, noTax(input, projection))).toEqual({
      status: 'not_calculable',
      reason: { code: 'setup_costs_unset', questionId: 'F5', state: 'missing' },
    });
  });

  it('says "unknown" for «لا أعرف»', () => {
    const input = inputOf({ F5: UNKNOWN });
    const projection = projectOperatingLines(input);
    expect(cashFlow(input, projection, noTax(input, projection))).toEqual({
      status: 'not_calculable',
      reason: { code: 'setup_costs_unset', questionId: 'F5', state: 'unknown' },
    });
  });

  it('says "missing" when the input has no set-up costs and no note', () => {
    const input = { ...inputOf(), setupCosts: null, notes: [] };
    const projection = projectOperatingLines(input);
    expect(cashFlow(input, projection, noTax(input, projection))).toMatchObject({
      reason: { state: 'missing' },
    });
  });

  it('refuses a projection made in another currency', () => {
    const input = inputOf();
    const projection = projectOperatingLines(input);
    expect(() =>
      cashFlow(input, { ...projection, currency: 'USD' }, noTax(input, projection)),
    ).toThrow(expect.objectContaining({ code: 'currency_mismatch' }) as Error);
  });
});

describe('provenance of the cash flow (D-181)', () => {
  const flow = ok(run({ F7: real('deposit') }).flow);

  it('lists the payment option, its timing, the revenue and the set-up costs where they are used', () => {
    const refs = (line: { provenance: { inputs: readonly { kind: string; id: string }[] } }) =>
      line.provenance.inputs.map((ref) => `${ref.kind}:${ref.id}`);
    expect(refs(flow.receipts)).toEqual(
      expect.arrayContaining([
        'answer:F7',
        'default:payment.deposit',
        'answer:F1',
        `rule:${CASH_FLOW_RULES.receipts}`,
      ]),
    );
    expect(refs(flow.netCash)).toContain(`rule:${CASH_FLOW_RULES.netCash}`);
    expect(flow.cumulative.inputs).toContainEqual({ kind: 'answer', id: 'F5' });
    expect(flow.cumulative.inputs).toContainEqual({ kind: 'rule', id: CASH_FLOW_RULES.cumulative });
    expect(flow.fundingNeed.inputs).toContainEqual({
      kind: 'rule',
      id: CASH_FLOW_RULES.fundingNeed,
    });
    expect(flow.payback.inputs).toContainEqual({ kind: 'rule', id: CASH_FLOW_RULES.payback });
    expect(flow.lowest.inputs).toContainEqual({ kind: 'rule', id: CASH_FLOW_RULES.fundingNeed });
  });

  it('takes the weakest source and confidence of everything it used', () => {
    expect(flow.fundingNeed).toMatchObject({
      source: 'assumption',
      confidence: 'low',
      validated: false,
    });
    expect(flow.paymentTiming.inputs).toEqual([{ kind: 'default', id: 'payment.deposit' }]);
  });
});

describe('invariants over random cash flows', () => {
  const amounts = fc.array(fc.integer({ min: 0, max: 5_000_000 }), {
    minLength: 36,
    maxLength: 36,
  });
  const option = fc.constantFrom<PaymentOption>(...PAYMENT_OPTIONS);

  it('keeps every sale: what arrives inside the horizon plus what arrives after it is the revenue', () => {
    fc.assert(
      fc.property(amounts, option, (revenue, way) => {
        const flow = synthetic({ F7: real(way) }, { revenue: revenue.map(BigInt) });
        const total = revenue.reduce((sum, amount) => sum + BigInt(amount), 0n);
        expect(sumOf(flow.receipts) + flow.receiptsAfterHorizon.value.minor).toBe(total);
        expect(flow.receipts.monthly.every((amount) => amount.minor >= 0n)).toBe(true);
      }),
    );
  });

  it('ends at the set-up costs less the sum of the net cash, and defines the funding need and payback as D-188 says', () => {
    fc.assert(
      fc.property(
        amounts,
        amounts,
        amounts,
        fc.integer({ min: 0, max: 20_000_000 }),
        option,
        (revenue, cogs, costs, setup, way) => {
          const flow = synthetic(
            { F7: real(way), F5: real(items('Tools', setup / 1000)) },
            { revenue: revenue.map(BigInt), cogs: cogs.map(BigInt), costs: costs.map(BigInt) },
          );
          const cumulative = flow.cumulative.value.map((amount) => amount.minor);
          expect(cumulative[0]).toBe(-BigInt(setup));
          expect(cumulative[36]).toBe(-BigInt(setup) + sumOf(flow.netCash));
          const lowest = cumulative.reduce((low, next) => (next < low ? next : low));
          expect(flow.lowest.value.cumulative.minor).toBe(lowest);
          expect(flow.fundingNeed.value.minor).toBe(lowest < 0n ? -lowest : 0n);
          expect(cumulative[flow.lowest.value.month]).toBe(lowest);
          const payback = flow.payback.value;
          if (payback === null) {
            expect(cumulative[36] ?? 0n).toBeLessThan(0n);
          } else if (payback === 0) {
            expect(cumulative.every((amount) => amount >= 0n)).toBe(true);
          } else {
            expect(cumulative.slice(payback).every((amount) => amount >= 0n)).toBe(true);
            expect(cumulative[payback - 1] ?? 0n).toBeLessThan(0n);
          }
        },
      ),
    );
  });
});
