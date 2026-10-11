import { at } from './array';
import { EngineError } from './errors';
import {
  combineFigures,
  combineProvenance,
  makeFigure,
  type Figure,
  type InputRef,
} from './figure';
import type { EngineInput } from './input';
import { divCeil, divRoundHalfAwayFromZero } from './integer';
import { makeMoney, subtractMoney, type Money } from './money';
import type { OperatingProjection } from './projection';
import {
  compareRates,
  divideRates,
  makeRate,
  multiplyRates,
  ONE_RATE,
  subtractRates,
  ZERO_RATE,
  type Rate,
} from './rate';

/** The stable IDs of the T8 rules, listed in the inputs of the figures they produce (D-181). */
export const T8_RULES = {
  contributionMargin: 'T8.contribution_margin',
  fixedCost: 'T8.fixed_cost',
  breakEvenUnits: 'T8.break_even_units',
  breakEvenRevenue: 'T8.break_even_revenue',
  breakEvenMonth: 'T8.break_even_month',
  ltv: 'T8.ltv',
  newCustomers: 'T8.new_customers',
  cac: 'T8.cac',
  ltvToCac: 'T8.ltv_to_cac',
} as const;

/**
 * Why a figure of a subscription is missing (D-208): `churn_unset` (F2.1 is unknown or missing),
 * `churn_zero` (nobody ever leaves, so LTV has no end), `no_new_customers` (month 12 wins no
 * customer, so CAC has no divisor) and `no_marketing` (the budget is zero, so CAC is zero and
 * LTV / CAC has no divisor).
 */
export type SubscriptionGap = 'churn_unset' | 'churn_zero' | 'no_new_customers' | 'no_marketing';

/**
 * The extra figures of T8 when F2 is "subscription" (D-183). A figure that cannot be computed is
 * `null` and `gaps` says why, so the report can say it instead of showing a wrong number.
 */
export interface SubscriptionEconomics {
  /** Average revenue per user a month: the price (F1). */
  readonly arpu: Figure<Money>;
  /** F2.1 as a monthly rate; null when unknown or missing. */
  readonly churn: Figure<Rate> | null;
  /** ARPU x CM% / churn: what a customer is worth over their lifetime, rounded to the minor unit. */
  readonly ltv: Figure<Money> | null;
  /**
   * The customers month 12 gains: units(12) - units(11) x (1 - churn), as an exact number that is
   * not rounded to whole customers. Null when the churn is unknown; it can be zero or negative,
   * and then there is no CAC (D-208).
   */
  readonly newCustomers: Figure<Rate> | null;
  /** The marketing of month 12 divided by the new customers, rounded to the minor unit. */
  readonly cac: Figure<Money> | null;
  /** LTV / CAC, an exact ratio. */
  readonly ltvToCac: Figure<Rate> | null;
  /** Why anything above is null, in the order they were found; empty when all is defined. */
  readonly gaps: readonly SubscriptionGap[];
}

/**
 * T8 when the contribution margin is zero or negative: every unit sold loses money or breaks even,
 * so no break-even exists and none is computed (SPEC F3, D-207). The alert `cm_not_positive` blocks.
 */
export interface BlockedUnitEconomics {
  readonly status: 'blocked';
  readonly contributionMargin: Figure<Money>;
  /** CM / P; null when the price is zero. */
  readonly contributionMarginRate: Figure<Rate> | null;
}

/** T8 for a project whose contribution margin is positive (D-182, D-183). */
export interface OkUnitEconomics {
  readonly status: 'ok';
  /** CM = P - VC, in the project currency. */
  readonly contributionMargin: Figure<Money>;
  /** CM% = CM / P, exact. */
  readonly contributionMarginRate: Figure<Rate>;
  /** FC: the full fixed cost of month 12 (F4, the payroll of the staff started by then, F4.1). */
  readonly fixedCost: Figure<Money>;
  /** BE_units = ceil(FC / CM). Units: whole units a month. */
  readonly breakEvenUnits: Figure<bigint>;
  /** BE_rev = FC / CM%, rounded half away from zero to the minor unit. A month's revenue. */
  readonly breakEvenRevenue: Figure<Money>;
  /**
   * BE_month: the first projection month (from 1) whose operating profit before tax is zero or
   * more; null when no month of the horizon reaches it (D-207).
   */
  readonly breakEvenMonth: Figure<number | null>;
  /** LTV, CAC and their ratio; null unless F2 is "subscription". */
  readonly subscription: SubscriptionEconomics | null;
}

/** The result of T8: ok, or blocked by a contribution margin that is not positive. */
export type UnitEconomics = OkUnitEconomics | BlockedUnitEconomics;

const rule = (id: string): InputRef => ({ kind: 'rule', id });

/** The month the break-even and the new customers of a subscription are read from (D-182, D-208). */
const STEADY_STATE_INDEX = 11;

/**
 * LTV and CAC of a subscription (D-183, D-208). LTV is exact CM / churn, which equals
 * ARPU x CM% / churn because CM% = CM / P and ARPU = P. CAC divides the marketing of month 12 by
 * the customers it gains. Both are rounded once; their ratio comes from the unrounded values.
 */
function subscriptionEconomics(
  input: EngineInput,
  projection: OperatingProjection,
  contributionMargin: Figure<Money>,
): SubscriptionEconomics {
  const arpu = input.price;
  const churnValue = input.churn.value;
  const none = { churn: null, ltv: null, newCustomers: null, cac: null, ltvToCac: null };
  if (churnValue === null) return { arpu, ...none, gaps: ['churn_unset'] };

  const churn = makeFigure(churnValue, input.churn);
  const gaps: SubscriptionGap[] = [];

  // LTV = CM / churn, with churn = c.num / c.den: CM x c.den / c.num.
  let ltv: Figure<Money> | null = null;
  let ltvExact: Rate | null = null;
  if (churnValue.num === 0n) {
    gaps.push('churn_zero');
  } else {
    const cm = contributionMargin.value;
    ltvExact = makeRate(cm.minor * churnValue.den, churnValue.num);
    ltv = combineFigures(
      makeMoney(divRoundHalfAwayFromZero(cm.minor * churnValue.den, churnValue.num), cm.currency),
      [input.price, input.variableCost, churn],
      [rule(T8_RULES.ltv)],
    );
  }

  // New customers of month 12 = units(12) - units(11) x (1 - churn).
  const units = projection.units.monthly;
  const stay = multiplyRates(
    makeRate(at(units, STEADY_STATE_INDEX - 1), 1n),
    subtractRates(ONE_RATE, churnValue),
  );
  const gained = subtractRates(makeRate(at(units, STEADY_STATE_INDEX), 1n), stay);
  const newCustomers = combineFigures(
    gained,
    [projection.units.provenance, churn],
    [rule(T8_RULES.newCustomers)],
  );

  if (compareRates(gained, ZERO_RATE) <= 0) {
    gaps.push('no_new_customers');
    return { arpu, churn, ltv, newCustomers, cac: null, ltvToCac: null, gaps };
  }

  // CAC = marketing / new customers, with new customers = g.num / g.den: marketing x g.den / g.num.
  const marketing = at(projection.marketing.monthly, STEADY_STATE_INDEX);
  const cac = combineFigures(
    makeMoney(
      divRoundHalfAwayFromZero(marketing.minor * gained.den, gained.num),
      marketing.currency,
    ),
    [newCustomers, projection.marketing.provenance],
    [rule(T8_RULES.cac)],
  );
  if (marketing.minor === 0n) {
    gaps.push('no_marketing');
    return { arpu, churn, ltv, newCustomers, cac, ltvToCac: null, gaps };
  }
  const ltvToCac =
    ltv === null || ltvExact === null
      ? null
      : combineFigures(
          divideRates(ltvExact, makeRate(marketing.minor * gained.den, gained.num)),
          [ltv, cac],
          [rule(T8_RULES.ltvToCac)],
        );
  return { arpu, churn, ltv, newCustomers, cac, ltvToCac, gaps };
}

/**
 * T8: unit economics, break-even, and for a subscription LTV and CAC (SPEC §4; D-182, D-183, D-207,
 * D-208). Pure and exact: the contribution margin is P minus VC; when it is zero or negative the
 * result is `blocked` and nothing else is computed. Otherwise the fixed cost is month 12's full
 * fixed cost from the projection (F4, the payroll of the staff who have started, and F4.1),
 * `breakEvenUnits` is that cost divided by CM and rounded up, `breakEvenRevenue` divides it by CM%
 * (rounded once, half away from zero), and `breakEvenMonth` is read from the projection's
 * operating profit so T8 and T9 agree. Throws `currency_mismatch` if the projection was made in
 * another currency than the input.
 */
export function unitEconomics(input: EngineInput, projection: OperatingProjection): UnitEconomics {
  if (projection.currency !== input.currency) {
    throw new EngineError('currency_mismatch', 'The projection and the input differ in currency.');
  }
  const price = input.price.value;
  const cm = subtractMoney(price, input.variableCost.value);
  const cmProvenance = combineProvenance(
    [input.price, input.variableCost],
    [rule(T8_RULES.contributionMargin)],
  );
  const contributionMargin = makeFigure(cm, cmProvenance);

  if (cm.minor <= 0n) {
    return {
      status: 'blocked',
      contributionMargin,
      contributionMarginRate:
        price.minor === 0n ? null : makeFigure(makeRate(cm.minor, price.minor), cmProvenance),
    };
  }
  const contributionMarginRate = makeFigure(makeRate(cm.minor, price.minor), cmProvenance);

  const fixedCost = combineFigures(
    at(projection.operatingCosts.monthly, STEADY_STATE_INDEX),
    [projection.operatingCosts.provenance],
    [rule(T8_RULES.fixedCost)],
  );
  const breakEvenUnits = combineFigures(
    divCeil(fixedCost.value.minor, cm.minor),
    [fixedCost, contributionMargin],
    [rule(T8_RULES.breakEvenUnits)],
  );
  const breakEvenRevenue = combineFigures(
    makeMoney(
      divRoundHalfAwayFromZero(fixedCost.value.minor * price.minor, cm.minor),
      input.currency,
    ),
    [fixedCost, contributionMargin],
    [rule(T8_RULES.breakEvenRevenue)],
  );

  const first = projection.operatingProfit.monthly.findIndex((profit) => profit.minor >= 0n);
  const breakEvenMonth = combineFigures(
    first === -1 ? null : at(projection.calendar.months, first).index,
    [projection.operatingProfit.provenance],
    [rule(T8_RULES.breakEvenMonth)],
  );

  return {
    status: 'ok',
    contributionMargin,
    contributionMarginRate,
    fixedCost,
    breakEvenUnits,
    breakEvenRevenue,
    breakEvenMonth,
    subscription:
      input.pricingModel?.value === 'subscription'
        ? subscriptionEconomics(input, projection, contributionMargin)
        : null,
  };
}
