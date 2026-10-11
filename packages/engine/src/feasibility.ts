import type { CashFlow } from './cash-flow';
import {
  combineFigures,
  combineProvenance,
  missingProvenance,
  type Figure,
  type InputRef,
  type Provenance,
} from './figure';
import type { EngineInput, MonthLimit } from './input';
import { compareMoney } from './money';
import type { EngineParams } from './params';
import type { Pricing } from './pricing';
import type { OperatingProjection } from './projection';
import { compareRates, makeRate, type Rate } from './rate';
import type { Scenarios } from './scenarios';
import type { UnitEconomics } from './unit-economics';

/** The stable IDs of the feasibility rules, listed in the inputs of the figures they produce (D-181). */
export const FEASIBILITY_RULES = {
  score: 'feasibility.score',
} as const;

/**
 * The criteria of the feasibility score, in the order of D-227. Each is the T8, T7, T9 or T10
 * result an alert or a number already shows, read as pass or fail, so the verdict adds no second
 * source of truth. The code is stable: the report words it.
 */
export type CriterionId =
  | 'margin_positive'
  | 'break_even_within_window'
  | 'break_even_within_target'
  | 'break_even_within_runway'
  | 'funding_within_capital'
  | 'setup_within_capital'
  | 'price_above_floor'
  | 'ltv_cac_at_minimum'
  | 'conservative_break_even'
  | 'payback_within_window'
  | 'break_even_units_within_capacity';

/** Every criterion, in the order of D-227. */
export const CRITERION_IDS: readonly CriterionId[] = [
  'margin_positive',
  'break_even_within_window',
  'break_even_within_target',
  'break_even_within_runway',
  'funding_within_capital',
  'setup_within_capital',
  'price_above_floor',
  'ltv_cac_at_minimum',
  'conservative_break_even',
  'payback_within_window',
  'break_even_units_within_capacity',
];

/** `not_evaluated` is a criterion whose inputs are missing or that does not apply: it is left out of the count. */
export type CriterionStatus = 'pass' | 'fail' | 'not_evaluated';

/**
 * Why a criterion was not evaluated: `input_missing` (an answer it reads is missing or «لا أعرف»),
 * `not_applicable` (the project has nothing to measure, such as no LTV / CAC without a
 * subscription, or no price floor without units) or `beyond_projection` (the limit lies past the
 * end of the projection, so the projection cannot show it was exceeded).
 */
export type NotEvaluatedReason = 'input_missing' | 'not_applicable' | 'beyond_projection';

/**
 * One criterion: its id and status, and, as the provenance, the answers, defaults and rules it
 * used (`inputs`) so the report can say where a pass or a fail comes from (D-181). `reason` is set
 * only when the status is `not_evaluated`.
 */
export interface Criterion extends Provenance {
  readonly id: CriterionId;
  readonly status: CriterionStatus;
  readonly reason: NotEvaluatedReason | null;
}

/** Something the reader should be told about the score. */
export interface FeasibilityNote {
  readonly code: 'no_criterion_evaluated';
}

/**
 * The feasibility score (D-227): the share of evaluated criteria that pass, each of equal weight.
 * `score` is an exact rate `passed / evaluated`, or null when nothing was evaluated (a note says
 * so). The score is not a probability of success, and the report says so.
 */
export interface Feasibility {
  readonly criteria: readonly Criterion[];
  /** How many criteria were evaluated (pass or fail); the report shows it. */
  readonly evaluated: number;
  readonly passed: number;
  readonly score: Figure<Rate> | null;
  readonly notes: readonly FeasibilityNote[];
}

const ruleOf = (id: CriterionId): InputRef => ({ kind: 'rule', id: `feasibility.${id}` });

const judged = (id: CriterionId, pass: boolean, used: readonly Provenance[]): Criterion => ({
  id,
  status: pass ? 'pass' : 'fail',
  reason: null,
  ...combineProvenance(used, [ruleOf(id)]),
});

const skipped = (
  id: CriterionId,
  reason: NotEvaluatedReason,
  used: readonly Provenance[],
): Criterion => ({
  id,
  status: 'not_evaluated',
  reason,
  ...combineProvenance(used, [ruleOf(id)]),
});

/**
 * A break-even month against a limit in months. The month is null when none was reached (or the
 * contribution margin leaves none); it passes when it falls within the limit.
 */
function withinMonths(
  id: CriterionId,
  month: number | null,
  limit: number,
  used: readonly Provenance[],
): Criterion {
  return judged(id, month !== null && month <= limit, used);
}

/**
 * The break-even month against a limit of the founder (H5 or A7), read exactly as the T8 alerts
 * read it (D-190, D-210): a bucket gives an upper bound, so a break-even after it, or none within
 * a horizon that reaches it, fails; "more than" has no bound and passes; an unset answer is not
 * evaluated. A contribution margin of zero or less has no break-even at all, so it fails whatever
 * the bound, unless the limit is unset. A bound beyond the projection cannot be shown exceeded by
 * a missing break-even, so that case is not evaluated.
 */
function againstLimit(
  id: 'break_even_within_target' | 'break_even_within_runway',
  limit: Figure<MonthLimit>,
  unit: UnitEconomics,
  horizon: number,
): Criterion {
  const used: Provenance[] = [
    unit.status === 'ok' ? unit.breakEvenMonth : unit.contributionMargin,
    limit,
  ];
  const bound = limit.value;
  if (bound.kind === 'unset') return skipped(id, 'input_missing', used);
  if (unit.status === 'blocked') return judged(id, false, used);
  const found = unit.breakEvenMonth.value;
  if (bound.kind === 'unbounded') return judged(id, true, used);
  if (found !== null) return judged(id, found <= bound.months, used);
  return bound.months <= horizon ? judged(id, false, used) : skipped(id, 'beyond_projection', used);
}

/** The LTV / CAC of a subscription against the minimum of T8; anything else is not evaluated. */
function ltvToCac(input: EngineInput, unit: UnitEconomics, params: EngineParams): Criterion {
  const id = 'ltv_cac_at_minimum';
  if (unit.status === 'blocked') return skipped(id, 'not_applicable', [unit.contributionMargin]);
  const subscription = unit.subscription;
  if (subscription === null) {
    return skipped(id, 'not_applicable', [input.pricingModel ?? input.price]);
  }
  const ratio = subscription.ltvToCac;
  if (ratio === null) {
    return skipped(
      id,
      subscription.gaps.includes('churn_unset') ? 'input_missing' : 'not_applicable',
      [subscription.churn ?? input.churn],
    );
  }
  return judged(id, compareRates(ratio.value, params.ltvCacMinimum.value) >= 0, [
    ratio,
    params.ltvCacMinimum,
  ]);
}

/**
 * The criteria of D-227 for one project, in order, derived from results the engine already has:
 * T8 (`unit`), T7 (`prices`), the cash flow, the scenarios of T10 and the adapter's input, so no
 * number is computed twice and the verdict cannot disagree with an alert. Months are read within
 * the window `params.feasibilityWindowMonths` or the projection's length, whichever is shorter.
 * Pure and deterministic.
 */
export function feasibilityCriteria(
  input: EngineInput,
  projection: OperatingProjection,
  unit: UnitEconomics,
  prices: Pricing,
  flow: CashFlow,
  scenarios: Scenarios,
  params: EngineParams,
): readonly Criterion[] {
  const horizon = projection.calendar.horizonMonths;
  const window = Math.min(params.feasibilityWindowMonths.value, horizon);
  const baseMonth = unit.status === 'ok' ? unit.breakEvenMonth : null;
  const baseUsed: Provenance[] = [
    baseMonth ?? unit.contributionMargin,
    params.feasibilityWindowMonths,
  ];
  const { capital, setupCosts, capacity } = input;
  const capitalMax = capital.value?.max ?? null;
  const setupMissing = missingProvenance('F5');

  const margin = judged('margin_positive', unit.status === 'ok', [unit.contributionMargin]);
  const breakEven = withinMonths(
    'break_even_within_window',
    baseMonth?.value ?? null,
    window,
    baseUsed,
  );
  const target = againstLimit('break_even_within_target', input.breakEvenTarget, unit, horizon);
  const runway = againstLimit('break_even_within_runway', input.runway, unit, horizon);

  const funding =
    flow.status !== 'ok'
      ? skipped('funding_within_capital', 'input_missing', [setupMissing, capital])
      : capitalMax === null
        ? skipped('funding_within_capital', 'input_missing', [flow.fundingNeed, capital])
        : judged('funding_within_capital', compareMoney(flow.fundingNeed.value, capitalMax) <= 0, [
            flow.fundingNeed,
            capital,
          ]);

  const setup =
    setupCosts === null
      ? skipped('setup_within_capital', 'input_missing', [setupMissing, capital])
      : capitalMax === null
        ? skipped('setup_within_capital', 'input_missing', [setupCosts, capital])
        : judged('setup_within_capital', compareMoney(setupCosts.value, capitalMax) <= 0, [
            setupCosts,
            capital,
          ]);

  const floor = prices.floor;
  const price =
    floor === null
      ? skipped('price_above_floor', 'not_applicable', [input.price, input.sales])
      : judged('price_above_floor', compareMoney(input.price.value, floor.value) >= 0, [
          input.price,
          floor,
        ]);

  const conservativeMonth = scenarios.conservative.breakEvenMonth;
  const conservative = withinMonths('conservative_break_even', conservativeMonth.value, window, [
    conservativeMonth,
    params.feasibilityWindowMonths,
  ]);

  const payback =
    flow.status !== 'ok'
      ? skipped('payback_within_window', 'input_missing', [setupMissing])
      : withinMonths('payback_within_window', flow.payback.value, window, [
          flow.payback,
          params.feasibilityWindowMonths,
        ]);

  const units =
    capacity.value === null
      ? skipped('break_even_units_within_capacity', 'input_missing', [capacity])
      : judged(
          'break_even_units_within_capacity',
          unit.status === 'ok' && unit.breakEvenUnits.value <= capacity.value,
          [unit.status === 'ok' ? unit.breakEvenUnits : unit.contributionMargin, capacity],
        );

  return [
    margin,
    breakEven,
    target,
    runway,
    funding,
    setup,
    price,
    ltvToCac(input, unit, params),
    conservative,
    payback,
    units,
  ];
}

/**
 * Counts the criteria and makes the score: passed over evaluated, an exact rate. A criterion
 * that was not evaluated is left out of both. With none evaluated there is no score, and a note
 * says so (never a division by zero). Pure.
 */
export function scoreCriteria(criteria: readonly Criterion[]): Feasibility {
  const evaluated = criteria.filter((criterion) => criterion.status !== 'not_evaluated');
  const passed = evaluated.filter((criterion) => criterion.status === 'pass').length;
  if (evaluated.length === 0) {
    return {
      criteria,
      evaluated: 0,
      passed: 0,
      score: null,
      notes: [{ code: 'no_criterion_evaluated' }],
    };
  }
  return {
    criteria,
    evaluated: evaluated.length,
    passed,
    score: combineFigures(makeRate(BigInt(passed), BigInt(evaluated.length)), evaluated, [
      { kind: 'rule', id: FEASIBILITY_RULES.score },
    ]),
    notes: [],
  };
}

/**
 * The feasibility score of a project (D-227): the 11 criteria of `feasibilityCriteria`, counted
 * by `scoreCriteria`. Pure and deterministic.
 */
export function feasibility(
  input: EngineInput,
  projection: OperatingProjection,
  unit: UnitEconomics,
  prices: Pricing,
  flow: CashFlow,
  scenarios: Scenarios,
  params: EngineParams,
): Feasibility {
  return scoreCriteria(
    feasibilityCriteria(input, projection, unit, prices, flow, scenarios, params),
  );
}
