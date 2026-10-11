import { at } from './array';
import {
  combineFigures,
  type Figure,
  type FigureConfidence,
  type InputRef,
  type Provenance,
} from './figure';
import type { EngineInput } from './input';
import type { Tornado, TornadoVariable } from './scenarios';

/** The stable IDs of the T18 rules, listed in the inputs of the figures they produce (D-181). */
export const T18_RULES = {
  priority: 'T18.priority',
  worry: 'T18.worry',
} as const;

/** The experiments of the fixed library (D-230): one per tornado variable, and one for the founder's own worry. */
export type ExperimentKey = 'price' | 'variable_cost' | 'sales' | 'fixed_costs' | 'worry';

/**
 * What the experiment costs the founder, in kind and never in an amount (rule 9): `time` (their
 * own time), `small_cash` (a small amount of cash) or `supplier_quote` (a quote to ask for).
 */
export type CostClass = 'time' | 'small_cash' | 'supplier_quote';

/**
 * One experiment of the library: codes, not text. The report words the metric, the success
 * threshold (a protocol default the founder may edit) and the fallback when it fails (D-230).
 */
export interface Experiment {
  readonly metric: string;
  readonly threshold: string;
  readonly fallback: string;
  readonly costClass: CostClass;
}

/** The experiment library of T18, keyed by variable (D-230, D-247). */
export const EXPERIMENT_LIBRARY: Readonly<Record<ExperimentKey, Experiment>> = {
  price: {
    metric: 'price.willingness_to_pay',
    threshold: 'price.accepting_share',
    fallback: 'price.test_second_price',
    costClass: 'time',
  },
  variable_cost: {
    metric: 'variable_cost.supplier_quotes',
    threshold: 'variable_cost.quotes_within_estimate',
    fallback: 'variable_cost.second_supplier',
    costClass: 'supplier_quote',
  },
  sales: {
    metric: 'sales.paid_preorders',
    threshold: 'sales.preorders_against_month_one',
    fallback: 'sales.revise_forecast',
    costClass: 'small_cash',
  },
  fixed_costs: {
    metric: 'fixed_costs.written_quotes',
    threshold: 'fixed_costs.total_within_estimate',
    fallback: 'fixed_costs.cut_or_postpone',
    costClass: 'supplier_quote',
  },
  worry: {
    metric: 'worry.smallest_test',
    threshold: 'worry.founder_sets_the_line',
    fallback: 'worry.ask_an_expert',
    costClass: 'time',
  },
};

/** The experiment of each tornado variable. */
const EXPERIMENT_OF: Readonly<Record<TornadoVariable, ExperimentKey>> = {
  price: 'price',
  vc: 'variable_cost',
  sales: 'sales',
  fixed_costs: 'fixed_costs',
};

/** The variables of the plan in the order that breaks ties: P, VC, sales, FC (D-230). */
const PLAN_ORDER: readonly TornadoVariable[] = ['price', 'vc', 'sales', 'fixed_costs'];

/** Confidence as T18 scores it: low 1, medium 2, high 3 (D-230). */
export type ConfidenceScore = 1 | 2 | 3;

const CONFIDENCE_SCORE: Readonly<Record<FigureConfidence, ConfidenceScore>> = {
  low: 1,
  medium: 2,
  high: 3,
};

/** The places in the plan (D-230). */
export const PLAN_SIZE = 3;

/**
 * One assumption to test: a tornado variable, how far the answer behind it can be trusted, how
 * sensitive the profit is to it (rank 1 is the most sensitive), and the priority
 * `(4 - confidence) x (5 - rank)` they give (D-230).
 */
export interface PlanCandidate {
  readonly variable: TornadoVariable;
  readonly confidence: Figure<ConfidenceScore>;
  readonly rank: Figure<number>;
  readonly score: Figure<number>;
}

/**
 * An entry of the plan: the variable (`worry` for the founder's own concern, which has no score),
 * the figures that placed it, and the experiment from the library with its codes and cost class.
 * `worry` holds the founder's text exactly as typed, for the worry entry only.
 */
export interface ValidationEntry extends Experiment {
  readonly variable: TornadoVariable | 'worry';
  readonly experiment: ExperimentKey;
  readonly score: Figure<number> | null;
  readonly confidence: Figure<ConfidenceScore> | null;
  readonly rank: Figure<number> | null;
  readonly worry: Figure<string> | null;
}

/** The validation plan T18 (D-230): the three experiments to run first, and the four candidates they came from. */
export interface ValidationPlan {
  readonly entries: readonly ValidationEntry[];
  /** All four variables with their figures, in the order price, VC, sales, fixed costs. */
  readonly candidates: readonly PlanCandidate[];
}

const rule = (id: string): InputRef => ({ kind: 'rule', id });

/** The answer behind each tornado variable: F1, F3, F6 and F4 (D-230). */
function answerBehind(input: EngineInput, variable: TornadoVariable): Provenance {
  switch (variable) {
    case 'price':
      return input.price;
    case 'vc':
      return input.variableCost;
    case 'sales':
      return input.sales;
    case 'fixed_costs':
      return input.fixedCosts;
  }
}

/**
 * The validation plan (D-230): the four tornado variables are scored by `(4 - confidence) x
 * (5 - rank)`, with the confidence of the answer behind each (low 1, medium 2, high 3) and the
 * rank of its swing in the tornado (1 is the widest). The founder's own worry H6 takes the first
 * place, as the text they typed, when it is answered; the other places go to the highest scores,
 * three in all, ties broken by rank (which already follows the order price, VC, sales, fixed
 * costs when swings are equal). Each entry names its experiment in the fixed library. Pure and
 * deterministic; it says nothing about amounts.
 */
export function validationPlan(input: EngineInput, tornado: Tornado): ValidationPlan {
  const candidates = PLAN_ORDER.map((variable): PlanCandidate => {
    const behind = answerBehind(input, variable);
    const confidence = combineFigures(
      CONFIDENCE_SCORE[behind.confidence],
      [behind],
      [rule(T18_RULES.priority)],
    );
    const position = tornado.rows.findIndex((row) => row.variable === variable);
    const row = at(tornado.rows, position);
    const rank = combineFigures(position + 1, [row.swing], [rule(T18_RULES.priority)]);
    const score = combineFigures(
      (4 - confidence.value) * (5 - rank.value),
      [confidence, rank],
      [rule(T18_RULES.priority)],
    );
    return { variable, confidence, rank, score };
  });

  const ordered = [...candidates].sort(
    (a, b) => b.score.value - a.score.value || a.rank.value - b.rank.value,
  );
  const text = input.worry.value;
  const first: ValidationEntry[] =
    text === null
      ? []
      : [
          {
            variable: 'worry',
            experiment: 'worry',
            ...EXPERIMENT_LIBRARY.worry,
            score: null,
            confidence: null,
            rank: null,
            worry: combineFigures(text, [input.worry], [rule(T18_RULES.worry)]),
          },
        ];
  const places = ordered.slice(0, PLAN_SIZE - first.length).map((candidate): ValidationEntry => ({
    variable: candidate.variable,
    experiment: EXPERIMENT_OF[candidate.variable],
    ...EXPERIMENT_LIBRARY[EXPERIMENT_OF[candidate.variable]],
    score: candidate.score,
    confidence: candidate.confidence,
    rank: candidate.rank,
    worry: null,
  }));
  return { entries: [...first, ...places], candidates };
}
