import { at } from './array';
import { sumByPeriod } from './calendar';
import type { CurrencyCode } from './currency';
import { EngineError } from './errors';
import {
  combineFigures,
  combineProvenance,
  makeFigure,
  type Figure,
  type InputRef,
  type Provenance,
} from './figure';
import type { EngineInput } from './input';
import { makeMoney, type Money } from './money';
import { DEFAULT_ENGINE_PARAMS, type EngineParams, type PaymentPart } from './params';
import type { OperatingProjection, ProjectionLine } from './projection';
import type { TaxAnalysis } from './tax';

/** The stable IDs of the cash flow rules, listed in the inputs of the figures they produce (D-181). */
export const CASH_FLOW_RULES = {
  receipts: 'T9.cash_receipts',
  taxPaid: 'T9.tax_paid',
  netCash: 'T9.net_cash',
  cumulative: 'T9.cumulative_cash',
  fundingNeed: 'T9.funding_need',
  payback: 'T9.payback',
} as const;

/**
 * Something the reader should be told about the cash flow (D-212): `receipts_after_horizon` (cash
 * from sales that arrives after the last month, left out), `tax_after_horizon` (a tax paid after
 * the last month, left out: the tax of the last year), `tax_not_calculated` (the regime could not
 * be calculated, so the cash flow has no tax in it) and `payment_assumed_cash` (F7 was not
 * answered, so cash on sale was assumed).
 */
export interface CashFlowNote {
  readonly code:
    'receipts_after_horizon' | 'tax_after_horizon' | 'tax_not_calculated' | 'payment_assumed_cash';
}

/** The cash flow, funding need and payback of a project (SPEC §4 T9; D-187, D-188, D-212, D-213, D-215). */
export interface OkCashFlow {
  readonly status: 'ok';
  readonly currency: CurrencyCode;
  /** F5, paid in month 0, before month 1. */
  readonly setupCosts: Figure<Money>;
  /** When the cash of a sale arrives: the engine's timing for F7's option (D-187). */
  readonly paymentTiming: Figure<readonly PaymentPart[]>;
  /** Cash received each month from the sales of that month and the months before it. */
  readonly receipts: ProjectionLine<Money>;
  /** COGS, paid in the month it arises: the projection's line. */
  readonly cogsPaid: ProjectionLine<Money>;
  /** Operating costs, paid in the month they arise: the projection's line. */
  readonly operatingCostsPaid: ProjectionLine<Money>;
  /** Tax paid in each month (D-212); null when the regime was not calculated. */
  readonly taxPaid: ProjectionLine<Money> | null;
  /** True when `taxPaid` is in the cash flow; false means every cash figure here is before tax. */
  readonly taxIncluded: boolean;
  /** Receipts less COGS, operating costs and tax, for months 1 to the horizon. */
  readonly netCash: ProjectionLine<Money>;
  /**
   * Cumulative cash: the entry at index `m` is the cash after month `m`, so index 0 is minus the
   * set-up costs, before month 1, and the last index is the end of the horizon.
   */
  readonly cumulative: Figure<readonly Money[]>;
  /** The lowest cumulative cash over months 0 to the horizon and the first month it was reached in. */
  readonly lowest: Figure<{ readonly month: number; readonly cumulative: Money }>;
  /** abs(lowest cumulative cash) when it is below zero, otherwise zero: the headline number (SPEC T9). */
  readonly fundingNeed: Figure<Money>;
  /**
   * Months, counted from month 1, until the cumulative cash is back at zero or above and stays
   * there to the end of the horizon (D-188, D-215). Zero when it was never below zero; null for
   * "not within 3 years".
   */
  readonly payback: Figure<number | null>;
  /** Cash from sales that arrives after the last month. Left out of the cumulative cash. */
  readonly receiptsAfterHorizon: Figure<Money>;
  /** Tax that falls due after the last month. Left out of the cumulative cash; null without tax. */
  readonly taxAfterHorizon: Figure<Money> | null;
  readonly notes: readonly CashFlowNote[];
}

/**
 * The cash flow cannot be made: F5 (the set-up costs) is missing or «لا أعرف» (D-200, D-212).
 * The projection and T8 are unaffected.
 */
export interface BlockedCashFlow {
  readonly status: 'not_calculable';
  readonly reason: {
    readonly code: 'setup_costs_unset';
    readonly questionId: 'F5';
    readonly state: 'missing' | 'unknown';
  };
}

export type CashFlow = OkCashFlow | BlockedCashFlow;

const rule = (id: string): InputRef => ({ kind: 'rule', id });

/** F7 was not answered: the engine takes cash on sale, an unvalidated low-confidence assumption (D-104). */
const ASSUMED_CASH: Provenance = {
  source: 'assumption',
  confidence: 'low',
  validated: false,
  inputs: [{ kind: 'answer', id: 'F7' }],
};

/**
 * Splits one sale over the parts of a payment option. Every part but the first gets its share of
 * the sale rounded down; the first gets what is left, so the parts add up to the sale exactly
 * (D-213): 1,000.000 in three equal parts is 333.334, 333.333 and 333.333.
 */
function splitSale(sale: bigint, parts: readonly PaymentPart[]): bigint[] {
  const rest = parts.map((part, index) =>
    index === 0 ? 0n : (sale * part.share.num) / part.share.den,
  );
  rest[0] = sale - rest.reduce((sum, amount) => sum + amount, 0n);
  return rest;
}

/**
 * The cash flow of a project, month by month (SPEC §4 T9; D-186 to D-188, D-212, D-213, D-215): for the
 * months 1 to the horizon, the cash received from sales (delayed as F7 says, `splitSale`), less
 * COGS and operating costs (paid in the month they arise) and the taxes of `tax` (paid in the
 * month the rules give, D-212). Cumulative cash starts from zero before month 0, where the set-up
 * costs (F5) are paid. Cash that arrives, and tax that falls due, after the last month is left out
 * and noted. From the cumulative cash: the funding need is the absolute value of its lowest point
 * (zero when it never goes below zero), and the payback is the month after the last month it was
 * below zero (D-188, D-215): zero when never below zero, null when it is still below zero in the
 * last month. Without F5 the result is `not_calculable`. Without a tax regime the cash flow has no
 * tax and says so (`taxIncluded` false). Every figure carries the provenance of what it used;
 * money stays in whole minor units and nothing is rounded here (D-179). Throws `currency_mismatch`
 * if the projection was made in another currency than the input.
 */
export function cashFlow(
  input: EngineInput,
  projection: OperatingProjection,
  tax: TaxAnalysis,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): CashFlow {
  if (projection.currency !== input.currency) {
    throw new EngineError('currency_mismatch', 'The projection and the input differ in currency.');
  }
  const setup = input.setupCosts;
  if (setup === null) {
    const unset = input.notes.find((note) => note.code === 'setup_costs_unset');
    return {
      status: 'not_calculable',
      reason: {
        code: 'setup_costs_unset',
        questionId: 'F5',
        state: unset?.state ?? 'missing',
      },
    };
  }

  const { currency } = input;
  const horizon = projection.calendar.horizonMonths;
  const zeros = (): bigint[] => Array.from({ length: horizon }, () => 0n);
  const notes: CashFlowNote[] = [];

  // Receipts: each sale arrives in its parts, later than its month for a delayed option.
  const option = input.paymentOption;
  if (option === null) notes.push({ code: 'payment_assumed_cash' });
  const paymentTiming = params.paymentTiming[option?.value ?? 'cash'];
  const receipts = zeros();
  let lateReceipts = 0n;
  projection.revenue.monthly.forEach((sale, index) => {
    const amounts = splitSale(sale.minor, paymentTiming.value);
    paymentTiming.value.forEach((part, partIndex) => {
      const month = index + 1 + part.delayMonths;
      if (month > horizon) lateReceipts += at(amounts, partIndex);
      else receipts[month - 1] = at(receipts, month - 1) + at(amounts, partIndex);
    });
  });
  if (lateReceipts > 0n) notes.push({ code: 'receipts_after_horizon' });
  const receiptsProvenance = combineProvenance(
    [projection.revenue.provenance, option ?? ASSUMED_CASH, paymentTiming],
    [rule(CASH_FLOW_RULES.receipts)],
  );

  // Tax: each charge is paid in its month, or falls after the horizon.
  const taxPaid = zeros();
  let lateTax = 0n;
  const charges = tax.status === 'calculated' ? tax.years.flatMap((year) => year.charges) : [];
  for (const charge of charges) {
    if (charge.paymentMonth > horizon) lateTax += charge.due.value.minor;
    else
      taxPaid[charge.paymentMonth - 1] =
        at(taxPaid, charge.paymentMonth - 1) + charge.due.value.minor;
  }
  const taxIncluded = tax.status === 'calculated';
  if (!taxIncluded) notes.push({ code: 'tax_not_calculated' });
  if (lateTax > 0n) notes.push({ code: 'tax_after_horizon' });
  const taxProvenance = taxIncluded
    ? combineProvenance(
        charges.map((charge) => charge.due),
        [rule(CASH_FLOW_RULES.taxPaid)],
      )
    : null;

  const line = (amounts: readonly bigint[], provenance: Provenance): ProjectionLine<Money> => {
    const monthly = amounts.map((minor) => makeMoney(minor, currency));
    return { monthly, byPeriod: sumByPeriod(projection.calendar, monthly, currency), provenance };
  };

  // Net cash and the cumulative cash from month 0.
  const net = receipts.map(
    (received, index) =>
      received -
      at(projection.cogs.monthly, index).minor -
      at(projection.operatingCosts.monthly, index).minor -
      at(taxPaid, index),
  );
  const netProvenance = combineProvenance(
    [
      receiptsProvenance,
      projection.cogs.provenance,
      projection.operatingCosts.provenance,
      ...(taxProvenance === null ? [] : [taxProvenance]),
    ],
    [rule(CASH_FLOW_RULES.netCash)],
  );
  let running = -setup.value.minor;
  const cumulativeMinors = [running];
  for (const amount of net) {
    running += amount;
    cumulativeMinors.push(running);
  }
  const cumulativeProvenance = combineProvenance(
    [netProvenance, setup],
    [rule(CASH_FLOW_RULES.cumulative)],
  );

  // The lowest point, the funding need and the payback.
  let lowestMonth = 0;
  let lastNegative = -1;
  cumulativeMinors.forEach((minor, month) => {
    if (minor < at(cumulativeMinors, lowestMonth)) lowestMonth = month;
    if (minor < 0n) lastNegative = month;
  });
  const lowestMinor = at(cumulativeMinors, lowestMonth);
  const lowestProvenance = combineProvenance(
    [cumulativeProvenance],
    [rule(CASH_FLOW_RULES.fundingNeed)],
  );
  const paybackMonths = lastNegative === horizon ? null : lastNegative + 1;

  return {
    status: 'ok',
    currency,
    setupCosts: setup,
    paymentTiming,
    receipts: line(receipts, receiptsProvenance),
    cogsPaid: projection.cogs,
    operatingCostsPaid: projection.operatingCosts,
    taxPaid: taxProvenance === null ? null : line(taxPaid, taxProvenance),
    taxIncluded,
    netCash: line(net, netProvenance),
    cumulative: makeFigure(
      cumulativeMinors.map((minor) => makeMoney(minor, currency)),
      cumulativeProvenance,
    ),
    lowest: makeFigure(
      { month: lowestMonth, cumulative: makeMoney(lowestMinor, currency) },
      lowestProvenance,
    ),
    fundingNeed: makeFigure(
      makeMoney(lowestMinor < 0n ? -lowestMinor : 0n, currency),
      lowestProvenance,
    ),
    payback: combineFigures(paybackMonths, [cumulativeProvenance], [rule(CASH_FLOW_RULES.payback)]),
    receiptsAfterHorizon: makeFigure(makeMoney(lateReceipts, currency), receiptsProvenance),
    taxAfterHorizon:
      taxProvenance === null ? null : makeFigure(makeMoney(lateTax, currency), taxProvenance),
    notes,
  };
}
