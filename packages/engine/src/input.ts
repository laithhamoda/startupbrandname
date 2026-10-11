import {
  answerState,
  followUpValueOf,
  valueOf,
  type Answers,
  type Mode,
  type StepId,
} from '@sbn/question-bank';
import { at } from './array';
import { referenceMonth } from './calendar';
import { isKnownCurrency, type CurrencyCode } from './currency';
import {
  combineFigures,
  figureFromAnswer,
  type Figure,
  type FigureConfidence,
  type FigureSource,
} from './figure';
import { divRoundHalfAwayFromZero } from './integer';
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
    | 'inflation_not_applied';
  readonly questionId?: StepId;
  readonly state?: 'missing' | 'unknown';
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
  readonly notes: readonly EngineNote[];
}

/**
 * Why a project cannot be calculated: `invalid_project` (a currency the engine does not know, or a
 * reference date that is no date: `questionId` is null and `item` says which); `missing_answer` and
 * `unknown_answer` (F1, F3, F4 and F6 must be real answers, D-110); `currency_mismatch` (an amount
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

/** The rule behind a price taken from competitors; it is listed in that figure's inputs (D-201). */
export const PRICE_FROM_D4_RULE = 'F1.d4_median';

/** The middle of the values; for an even count, the mean of the two middle ones, rounded half away from zero. */
function median(values: readonly bigint[]): bigint {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return at(sorted, middle);
  return divRoundHalfAwayFromZero(at(sorted, middle - 1) + at(sorted, middle), 2n);
}

/**
 * Reads the stored answers of a project into the engine's typed input (D-200). Pure: the same
 * answers, provenance and project always give the same result.
 *
 * Every amount must be in the project currency, or the result is `not_calculable` and names the
 * question and the row (D-180). F3, F4 and F6 must be real answers (D-110). An unknown F1 takes
 * the median of D4's known prices as a low-confidence assumption (D-201). An unknown or missing
 * F4.1 counts as zero, F6.2 as the engine's estimate, E7 as no cap, E8 as no staff and D7 as no
 * season, each with a note (D-183, D-200). An answer given as a picked range, or without stored
 * provenance, counts as an assumption. Money is converted from major to minor units here, once
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
      reasons.push({ code: 'no_price', questionId: 'F1' });
    } else {
      price = combineFigures(
        { minor: median(known), currency },
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
      notes,
    },
  };
}
