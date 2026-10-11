import {
  answerState,
  followUpValueOf,
  valueOf,
  type Answers,
  type Mode,
  type StepId,
} from '@sbn/question-bank';
import { referenceMonth } from './calendar';
import { isKnownCurrency, type CurrencyCode } from './currency';
import {
  combineFigures,
  figureFromAnswer,
  type Figure,
  type FigureConfidence,
  type FigureSource,
} from './figure';
import { medianBigInt } from './integer';
import { addMoney, moneyFromMajor, zeroMoney, type Money } from './money';
import { PAYMENT_OPTIONS, type PaymentOption } from './params';
import { rateFromNumber, rateFromPercent, type Rate } from './rate';
import type { SalesPoints } from './sales-curve';

/**
 * What the database stores next to an answer (CLAUDE.md rule 2): where it came from, how far it can
 * be trusted and whether it was confirmed. The adapter passes it on and never works it out again;
 * `pickedRange` marks an answer given by choosing a range (D-157), which always counts as an
 * assumption.
 */
export interface StoredProvenance {
  readonly source: FigureSource;
  readonly confidence: FigureConfidence;
  readonly validated: boolean;
  readonly pickedRange?: boolean;
}

/** The stored provenance of each step the founder answered, by question or follow-up ID. */
export type ProvenanceBySteps = Partial<Record<StepId, StoredProvenance>>;

/** The project settings a run needs besides the answers. */
export interface ProjectContext {
  /** ISO 3166-1 alpha-2 code of the project's country. Carried; the adapter reads no rules from it. */
  readonly country: string;
  /** The project's currency (`projects.currency`, D-180): every amount is calculated in it. */
  readonly currency: string;
  readonly mode: Mode;
  /** The date the run is made, YYYY-MM-DD. Month 1 is the calendar month after it (D-184). */
  readonly referenceDate: string;
}

/** A competitor's price (D4); `price` is null when the founder does not know it. */
export interface CompetitorPrice {
  readonly name: string;
  readonly price: Money | null;
}

/** A person on the payroll (E8) from `startMonth` of the projection onwards. */
export interface StaffMember {
  readonly role: string;
  readonly monthlyCost: Money;
  /** Projection month, from 1, in which the monthly cost starts. */
  readonly startMonth: number;
}

/** The range of capital the founder has available now (A5), in the project currency. */
export interface CapitalRange {
  readonly min: Money;
  readonly max: Money;
}

/**
 * A limit on a number of months read from a bucket answer (A7, H5, D-190): `within` is the upper
 * bound of the chosen bucket, so a value above it surely breaks the limit; `unbounded` is the top
 * bucket ("more than 12 months"), which no value in the horizon can break; `unset` is an answer
 * that was never given or is «لا أعرف».
 */
export type MonthLimit =
  | { readonly kind: 'within'; readonly months: number }
  | { readonly kind: 'unbounded' }
  | { readonly kind: 'unset' };

/**
 * Something the reader should be told about the way an answer was read, so the report can say it
 * (D-183). `state` is why the answer was replaced: never given (`missing`) or «لا أعرف» (`unknown`).
 */
export interface EngineNote {
  readonly code:
    | 'price_from_competitors'
    | 'marketing_assumed_zero'
    | 'growth_estimated'
    | 'capacity_unlimited'
    | 'seasonality_unset'
    | 'staff_unset'
    | 'setup_costs_unset'
    | 'seasonality_ignored'
    | 'capacity_reached'
    | 'inflation_not_applied'
    | 'churn_unset'
    | 'capital_unset'
    | 'capital_other_currency'
    | 'runway_unset'
    | 'break_even_target_unset';
  readonly questionId?: StepId;
  readonly state?: 'missing' | 'unknown';
  /** For `capital_other_currency`, the currency A5 was given in. */
  readonly currency?: string;
}

/**
 * The typed input of the engine, read from the stored answers (D-200). Every amount is in
 * `currency`, the project's, and every field is a figure with the provenance of the answers it
 * came from (D-181). An answer that was never given or is «لا أعرف» is replaced by the fallback the
 * decisions name, as an unvalidated low-confidence assumption (D-104), and a note says so.
 */
export interface EngineInput {
  readonly country: string;
  readonly currency: CurrencyCode;
  readonly mode: Mode;
  readonly referenceDate: string;
  /** F1: the selling price per unit; when F1 is «لا أعرف», the median of D4's known prices. */
  readonly price: Figure<Money>;
  /** F3: the variable cost of one unit, the sum of the items. */
  readonly variableCost: Figure<Money>;
  /** F4: the fixed cost of one month, the sum of the items. */
  readonly fixedCosts: Figure<Money>;
  /** F4.1: the monthly marketing budget; zero when unknown or missing. */
  readonly marketing: Figure<Money>;
  /** E8: the staff plan; empty when unknown or missing. */
  readonly staff: Figure<readonly StaffMember[]>;
  /** F6: sales in units in months 1, 6 and 12 of the projection, as the founder gave them. */
  readonly sales: Figure<SalesPoints>;
  /** F6.2: yearly growth after year 1; the value is null when the engine must estimate it. */
  readonly yearlyGrowth: Figure<Rate | null>;
  /** D7: the calendar months (1 to 12) of the peak season, sorted; empty when none. */
  readonly peakMonths: Figure<readonly number[]>;
  /** E7: the most units a month can serve; null for no cap. */
  readonly capacity: Figure<bigint | null>;
  /** D4: the competitors' prices; null when not answered. Carried for T7. */
  readonly competitorPrices: Figure<readonly CompetitorPrice[]> | null;
  /** F2: the pricing model (an option ID of F2); null when not answered. Carried for later. */
  readonly pricingModel: Figure<string> | null;
  /** F5: the one-off set-up costs, the sum of the items; null when unknown or missing. */
  readonly setupCosts: Figure<Money> | null;
  /** F7: how the customer pays; null when not answered. Carried for the cash flow. */
  readonly paymentOption: Figure<PaymentOption> | null;
  /**
   * F2.1: the share of subscribers who cancel each month, an exact rate from 0 to 1. Null when F2
   * is not "subscription" (the question is not asked), or when the answer is missing or «لا أعرف»
   * (a note says so): LTV and LTV / CAC are then left out (D-183).
   */
  readonly churn: Figure<Rate | null>;
  /**
   * A5: the capital available now. Null when missing, «لا أعرف», or given in another currency
   * than the project's (a note says which): nothing is converted, so nothing is compared (D-190).
   * The one amount the adapter reads that does not stop the run for being in another currency.
   */
  readonly capital: Figure<CapitalRange | null>;
  /** A7: how long the founder can go without income, as a limit on the break-even month. */
  readonly runway: Figure<MonthLimit>;
  /** H5: the longest wait for break-even the founder accepts, as a limit on the break-even month. */
  readonly breakEvenTarget: Figure<MonthLimit>;
  readonly notes: readonly EngineNote[];
}

/**
 * Why a project cannot be calculated: `invalid_project` (a currency the engine does not know, or a
 * reference date that is no date: `questionId` is null and `item` says which); `missing_answer` and
 * `unknown_answer` (F1, F3, F4 and F6 must be real answers, D-110, D-200); `currency_mismatch` (an amount
 * in a currency other than the project's, D-180; `currency` is the one found); `invalid_value` (a
 * number the engine cannot read, or a negative one); `no_price` (F1 is «لا أعرف» and D4 holds no
 * known price).
 */
export interface NotCalculableReason {
  readonly code:
    | 'invalid_project'
    | 'missing_answer'
    | 'unknown_answer'
    | 'currency_mismatch'
    | 'invalid_value'
    | 'no_price';
  readonly questionId: StepId | null;
  /** The row at fault: a cost item's label, a competitor's name, a role, or a project setting. */
  readonly item?: string;
  /** For `currency_mismatch`, the currency found. */
  readonly currency?: string;
}

/** The result of reading the answers: an input to calculate with, or the reasons it cannot be. */
export type EngineInputResult =
  | { readonly status: 'ok'; readonly input: EngineInput }
  | { readonly status: 'not_calculable'; readonly reasons: readonly NotCalculableReason[] };

/** The upper bound of each A7 option, in months (D-190); the top option has none. */
const RUNWAY_LIMITS: ReadonlyMap<string, MonthLimit> = new Map<string, MonthLimit>([
  ['lt3', { kind: 'within', months: 3 }],
  ['3to6', { kind: 'within', months: 6 }],
  ['6to12', { kind: 'within', months: 12 }],
  ['gt12', { kind: 'unbounded' }],
]);

/** The upper bound of each H5 option, in months (D-190); the top option has none. */
const BREAK_EVEN_LIMITS: ReadonlyMap<string, MonthLimit> = new Map<string, MonthLimit>([
  ['m6', { kind: 'within', months: 6 }],
  ['m12', { kind: 'within', months: 12 }],
  ['m18', { kind: 'within', months: 18 }],
  ['m24', { kind: 'within', months: 24 }],
  ['m36', { kind: 'within', months: 36 }],
  ['more', { kind: 'unbounded' }],
]);

/** The rule behind a price taken from competitors; it is listed in that figure's inputs (D-201). */
export const PRICE_FROM_D4_RULE = 'F1.d4_median';

/**
 * Reads the stored answers of a project into the engine's typed input (D-200). Pure: the same
 * answers, provenance and project always give the same result.
 *
 * Every amount must be in the project currency, or the result is `not_calculable` and names the
 * question and the row (D-180). F3, F4 and F6 must be real answers: the projection cannot run
 * without them (D-110 names F3 and F4; F6 is the sales forecast itself). F5 is not required here:
 * the projection does not use it, and the run that needs set-up costs (payback, funding need, D-187
 * and D-188) decides what an unknown F5 means. An unknown F1 takes
 * the median of D4's known prices as a low-confidence assumption (D-201). An unknown or missing
 * F4.1 counts as zero, F6.2 as the engine's estimate, E7 as no cap, E8 as no staff and D7 as no
 * season, each with a note (D-183, D-200). An unknown or missing F2.1 (asked only for a
 * subscription), A5, A7 or H5 is left unset with a note, and the alert that needs it is not
 * evaluated; an A5 in another currency is likewise left unset, never converted (D-190, D-206).
 * An answer given as a picked range, or without stored provenance, counts as an assumption. Money is converted from major to minor units here, once
 * (D-179). Every problem is reported, not only the first.
 */
export function engineInputFrom(
  answers: Answers,
  provenance: ProvenanceBySteps,
  project: ProjectContext,
): EngineInputResult {
  const reasons: NotCalculableReason[] = [];
  const notes: EngineNote[] = [];
  const { currency } = project;

  if (!isKnownCurrency(currency)) {
    reasons.push({ code: 'invalid_project', questionId: null, item: 'currency', currency });
  }
  try {
    referenceMonth(project.referenceDate);
  } catch {
    reasons.push({ code: 'invalid_project', questionId: null, item: 'reference_date' });
  }
  if (reasons.length > 0) return { status: 'not_calculable', reasons };

  /** The founder's real answer, with the provenance the database stored for it. */
  function answered<T>(id: StepId, value: T): Figure<T> {
    const stored = provenance[id];
    const figure = figureFromAnswer<T>({
      id,
      status: 'answered',
      value,
      source: stored?.source ?? 'assumption',
      confidence: stored?.confidence ?? 'low',
      validated: stored?.validated ?? false,
      pickedRange: stored?.pickedRange === true,
    });
    return { ...figure, value };
  }

  /** A stand-in for an answer that is missing or «لا أعرف»: an unvalidated low-confidence assumption (D-104). */
  function standIn<T>(id: StepId, value: T): Figure<T> {
    const figure = figureFromAnswer<T>({
      id,
      status: 'unknown',
      source: 'assumption',
      confidence: 'low',
      validated: false,
    });
    return { ...figure, value };
  }

  const state = (id: StepId): 'missing' | 'unknown' =>
    answerState(answers, id) === 'none' ? 'missing' : 'unknown';

  const note = (code: EngineNote['code'], id: StepId) => {
    notes.push({ code, questionId: id, state: state(id) });
  };

  const absent = (id: StepId) => {
    reasons.push({
      code: state(id) === 'missing' ? 'missing_answer' : 'unknown_answer',
      questionId: id,
    });
  };

  const unreadable = (id: StepId, item?: string) => {
    reasons.push({ code: 'invalid_value', questionId: id, item });
  };

  /** An amount in the project currency, in minor units; null (and a reason) otherwise. */
  function money(id: StepId, amount: number, amountCurrency: string, item?: string): Money | null {
    if (amountCurrency !== currency) {
      reasons.push({ code: 'currency_mismatch', questionId: id, item, currency: amountCurrency });
      return null;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      unreadable(id, item);
      return null;
    }
    return moneyFromMajor(amount, currency);
  }

  /** A quantity that cannot be negative, as an exact rate; null for NaN, infinity or a negative number. */
  const quantity = (value: number): Rate | null =>
    Number.isFinite(value) && value >= 0 ? rateFromNumber(value) : null;

  function costTotal(
    id: StepId,
    items: readonly { label: string; amount: number; currency: string }[],
  ): Money | null {
    let total: Money | null = zeroMoney(currency);
    for (const item of items) {
      const amount = money(id, item.amount, item.currency, item.label);
      total = total !== null && amount !== null ? addMoney(total, amount) : null;
    }
    return total;
  }

  function requiredCosts(id: 'F3' | 'F4'): Figure<Money> | null {
    const given = valueOf(answers, id, 'cost_items');
    if (given === undefined) {
      absent(id);
      return null;
    }
    const total = costTotal(id, given.items);
    return total === null ? null : answered(id, total);
  }

  // D4 is read first: an unknown F1 falls back on it.
  let competitorPrices: Figure<readonly CompetitorPrice[]> | null = null;
  const d4 = valueOf(answers, 'D4', 'competitor_prices');
  if (d4 !== undefined) {
    const list = d4.items.map((item) => ({
      name: item.name,
      price:
        item.price === null ? null : money('D4', item.price.amount, item.price.currency, item.name),
    }));
    competitorPrices = answered('D4', list);
  }

  let price: Figure<Money> | null = null;
  const f1 = valueOf(answers, 'F1', 'money');
  if (f1 !== undefined) {
    const amount = money('F1', f1.amount, f1.currency);
    price = amount === null ? null : answered('F1', amount);
  } else if (state('F1') === 'missing') {
    absent('F1');
  } else {
    const known = (competitorPrices?.value ?? []).flatMap((item) =>
      item.price === null ? [] : [item.price.minor],
    );
    if (competitorPrices === null || known.length === 0) {
      // A D4 price in another currency is already reported; it is not an absent price.
      if (!reasons.some((reason) => reason.questionId === 'D4')) {
        reasons.push({ code: 'no_price', questionId: 'F1' });
      }
    } else {
      price = combineFigures(
        { minor: medianBigInt(known), currency },
        [standIn('F1', null), competitorPrices],
        [{ kind: 'rule', id: PRICE_FROM_D4_RULE }],
      );
      notes.push({ code: 'price_from_competitors', questionId: 'F1', state: 'unknown' });
    }
  }

  const variableCost = requiredCosts('F3');
  const fixedCosts = requiredCosts('F4');

  let marketing = standIn('F4.1', zeroMoney(currency));
  const f41 = followUpValueOf(answers, 'F4.1', 'money');
  if (f41 === undefined) {
    note('marketing_assumed_zero', 'F4.1');
  } else {
    const amount = money('F4.1', f41.amount, f41.currency);
    if (amount !== null) marketing = answered('F4.1', amount);
  }

  let staff = standIn<readonly StaffMember[]>('E8', []);
  const e8 = valueOf(answers, 'E8', 'staff_plan');
  if (e8 === undefined) {
    note('staff_unset', 'E8');
  } else {
    const list: StaffMember[] = [];
    for (const member of e8.items) {
      const cost = money('E8', member.monthlyCost.amount, member.monthlyCost.currency, member.role);
      if (cost !== null)
        list.push({ role: member.role, monthlyCost: cost, startMonth: member.startMonth });
    }
    staff = answered('E8', list);
  }

  let sales: Figure<SalesPoints> | null = null;
  const f6 = valueOf(answers, 'F6', 'sales_forecast');
  if (f6 === undefined) {
    absent('F6');
  } else {
    const [month1, month6, month12] = [f6.month1, f6.month6, f6.month12].map(quantity);
    if (month1 && month6 && month12) sales = answered('F6', { month1, month6, month12 });
    else unreadable('F6');
  }

  let yearlyGrowth = standIn<Rate | null>('F6.2', null);
  const f62 = followUpValueOf(answers, 'F6.2', 'number');
  if (f62 === undefined) {
    note('growth_estimated', 'F6.2');
  } else if (Number.isFinite(f62) && f62 >= 0) {
    yearlyGrowth = answered<Rate | null>('F6.2', rateFromPercent(f62));
  } else {
    unreadable('F6.2');
  }

  let peakMonths = standIn<readonly number[]>('D7', []);
  const d7 = valueOf(answers, 'D7', 'seasonality');
  if (d7 === undefined) {
    note('seasonality_unset', 'D7');
  } else {
    peakMonths = answered('D7', d7.seasonal ? [...d7.peakMonths].sort((a, b) => a - b) : []);
  }

  let capacity = standIn<bigint | null>('E7', null);
  const e7 = valueOf(answers, 'E7', 'number');
  if (e7 === undefined) {
    note('capacity_unlimited', 'E7');
  } else if (Number.isSafeInteger(e7) && e7 >= 0) {
    capacity = answered<bigint | null>('E7', BigInt(e7));
  } else {
    unreadable('E7');
  }

  let setupCosts: Figure<Money> | null = null;
  const f5 = valueOf(answers, 'F5', 'cost_items');
  if (f5 === undefined) {
    note('setup_costs_unset', 'F5');
  } else {
    const total = costTotal('F5', f5.items);
    setupCosts = total === null ? null : answered('F5', total);
  }

  const model = valueOf(answers, 'F2', 'single');
  const pricingModel = model === undefined ? null : answered('F2', model);

  // F2.1 is asked, and read, only for a subscription: a stale answer after F2 changed is ignored.
  let churn = standIn<Rate | null>('F2.1', null);
  if (model === 'subscription') {
    const f21 = followUpValueOf(answers, 'F2.1', 'number');
    if (f21 === undefined) {
      note('churn_unset', 'F2.1');
    } else if (Number.isFinite(f21) && f21 >= 0 && f21 <= 100) {
      churn = answered<Rate | null>('F2.1', rateFromPercent(f21));
    } else {
      unreadable('F2.1');
    }
  }

  let capital = standIn<CapitalRange | null>('A5', null);
  const a5 = valueOf(answers, 'A5', 'money_range');
  if (a5 === undefined) {
    note('capital_unset', 'A5');
  } else if (a5.currency !== currency) {
    notes.push({
      code: 'capital_other_currency',
      questionId: 'A5',
      currency: a5.currency,
    });
  } else if (
    [a5.min, a5.max].some((amount) => !Number.isFinite(amount) || amount < 0) ||
    a5.min > a5.max
  ) {
    unreadable('A5');
  } else {
    capital = answered<CapitalRange | null>('A5', {
      min: moneyFromMajor(a5.min, currency),
      max: moneyFromMajor(a5.max, currency),
    });
  }

  /** A bucket answer as a limit on months; an option the question bank does not offer is unreadable. */
  function limitOf(
    id: 'A7' | 'H5',
    option: string | undefined,
    limits: ReadonlyMap<string, MonthLimit>,
    unsetNote: EngineNote['code'],
  ): Figure<MonthLimit> {
    if (option === undefined) {
      note(unsetNote, id);
      return standIn<MonthLimit>(id, { kind: 'unset' });
    }
    const limit = limits.get(option);
    if (limit === undefined) {
      unreadable(id);
      return standIn<MonthLimit>(id, { kind: 'unset' });
    }
    return answered(id, limit);
  }
  const runway = limitOf('A7', valueOf(answers, 'A7', 'single'), RUNWAY_LIMITS, 'runway_unset');
  const breakEvenTarget = limitOf(
    'H5',
    valueOf(answers, 'H5', 'single'),
    BREAK_EVEN_LIMITS,
    'break_even_target_unset',
  );
  const way = valueOf(answers, 'F7', 'single');
  const option = PAYMENT_OPTIONS.find((candidate) => candidate === way);
  const paymentOption = option === undefined ? null : answered('F7', option);

  if (reasons.length > 0 || !price || !variableCost || !fixedCosts || !sales) {
    return { status: 'not_calculable', reasons };
  }
  return {
    status: 'ok',
    input: {
      country: project.country,
      currency,
      mode: project.mode,
      referenceDate: project.referenceDate,
      price,
      variableCost,
      fixedCosts,
      marketing,
      staff,
      sales,
      yearlyGrowth,
      peakMonths,
      capacity,
      competitorPrices,
      pricingModel,
      setupCosts,
      paymentOption,
      churn,
      capital,
      runway,
      breakEvenTarget,
      notes,
    },
  };
}
