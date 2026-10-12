import { assess, type Assessment } from './assessment';
import {
  combineProvenance,
  makeFigure,
  type Figure,
  type InputRef,
  type Provenance,
} from './figure';
import type { EngineInput } from './input';
import { makeMoney, moneyToSafeMinor, mulMoneyByRate, type Money } from './money';
import {
  createEngineParams,
  listChangeParams,
  type EngineParamOverrides,
  type EngineParams,
} from './params';
import type { PricingOptions } from './pricing';
import type { ProjectionAdjustments } from './projection';
import {
  addRates,
  compareRates,
  makeRate,
  negateRate,
  ONE_RATE,
  subtractRates,
  ZERO_RATE,
  type Rate,
} from './rate';
import type { EngineRun } from './run';
import type { TornadoVariable } from './scenarios';
import type { TaxContext } from './tax';
import type { Verdict } from './verdict';

/*
 * The changes that would change a verdict (D-228, D-260, D-261): a deterministic search for
 * changes to the founder's own numbers that remove the blockers of a `stop` and, where it can,
 * lift the score of a `stop` or a `revise` to the go line. It judges every change by `assess`, the
 * very pipeline `runEngine` judges the founder's numbers with, so a change can never be judged
 * by a second set of rules. Nothing here is a number the founder did not give: a suggestion is the
 * founder's figure moved by the engine, with the provenance of an assumption.
 */

/** The numbers the founder can change, in the order that breaks ties between equal efforts (D-261). */
export const CHANGE_LEVERS = [
  'price',
  'variable_cost',
  'fixed_costs',
  'sales',
  'setup_costs',
] as const;

/** One of the five levers: F1, F3, D-182's full fixed cost, F6 and F5. */
export type ChangeLever = (typeof CHANGE_LEVERS)[number];

/** The stable IDs of the rules behind the figures of a change, listed in their inputs (D-181). */
export const CHANGE_RULES = {
  shift: 'changes.shift',
  outcome: 'changes.outcome',
} as const;

/**
 * One lever moved. Money levers (the price, the variable cost, the set-up costs) carry the
 * founder's amount and the suggested one, to the minor unit; the fixed cost and the sales carry a
 * factor on the founder's own figures, where `from` is always 1: D-182's full fixed cost is the sum
 * of three answers and the sales are three points of a curve, so no single amount stands for
 * either. `relativeChange` is `(to - from) / from`, exact: negative for a cost that falls.
 */
export type LeverShift =
  | {
      readonly lever: 'price' | 'variable_cost' | 'setup_costs';
      readonly unit: 'money';
      readonly from: Figure<Money>;
      readonly to: Figure<Money>;
      readonly relativeChange: Figure<Rate>;
    }
  | {
      readonly lever: 'fixed_costs' | 'sales';
      readonly unit: 'factor';
      readonly from: Figure<Rate>;
      readonly to: Figure<Rate>;
      readonly relativeChange: Figure<Rate>;
    };

/** What the engine's own pipeline says about the project once the change is made. */
export interface ChangeOutcome {
  readonly verdict: Figure<Verdict>;
  /** The share of evaluated criteria that pass; null when nothing is evaluated. */
  readonly score: Figure<Rate> | null;
  readonly passed: number;
  readonly evaluated: number;
}

/** A change of one or two levers, with what it does to the score and the verdict. */
export interface Change {
  /** One or two levers, in the order of `CHANGE_LEVERS`. */
  readonly shifts: readonly LeverShift[];
  /** The sum of the absolute relative changes of the levers: what ranks the changes. */
  readonly effort: Figure<Rate>;
  /**
   * True when a suggested price is above the largest known D4 competitor price. A premium price
   * is not a claim that the market will pay it: it needs a measurable difference in the offer
   * (rule R5 of the question bank), and the report says so instead of giving a number. Always
   * false without a known competitor price (D-260).
   */
  readonly premium: boolean;
  /** True when the change lifts the project to `go`; false when it only removes the blockers. */
  readonly reachesThreshold: boolean;
  readonly outcome: ChangeOutcome;
}

/**
 * A variable of the tornado that no change above moves, listed when fewer than three changes exist
 * for a `stop` (D-228): the founder should rethink it, and the engine gives no target value.
 * `rank` is its place in the tornado (1 is the widest) and `swing` the distance between the two ends
 * of its year-1 operating profit.
 */
export interface RethinkItem {
  readonly lever: ChangeLever;
  readonly rank: number;
  readonly swing: Figure<Money>;
}

/** Why no change to the numbers can lift the project to `go`: overall confidence is low (D-229). */
export type GoBlocker = 'confidence_low';

/** The result of the search (D-228). */
export interface SuggestedChanges {
  /** `none_needed` for a project that is already `go`; `suggested` for a `revise` or a `stop`. */
  readonly status: 'none_needed' | 'suggested';
  /** The verdict of the run the search started from. */
  readonly verdict: Figure<Verdict>;
  /**
   * Up to three changes, smallest effort first; for a `stop`, exactly three whenever three exist
   * inside the bounds and the budget.
   */
  readonly changes: readonly Change[];
  /** For a `stop` with fewer than three changes, the largest tornado drivers not already used. */
  readonly rethink: readonly RethinkItem[];
  /**
   * The largest known D4 price, which a suggested price may not pass without being a premium;
   * null when no competitor price is known (then no price is marked premium).
   */
  readonly marketCeiling: Figure<Money> | null;
  /** Set when `go` cannot be reached by any change (overall confidence is low). */
  readonly goBlockedBy: GoBlocker | null;
  /** How many times the pipeline was run for a change; the run being started from is not counted. */
  readonly evaluations: number;
  /** False when the budget ran out: the changes are what was found before, not necessarily the smallest. */
  readonly complete: boolean;
  /** The parameters of the search (the evaluation budget), as assumptions. */
  readonly parameters: readonly Figure<unknown>[];
}

// ---------------------------------------------------------------------------------------------
// The levers and their ladders

/** Thrown inside the search when the budget of evaluations is spent; never leaves this module. */
class BudgetSpent extends Error {}

/** What a change may do to each lever; a lever left out stays as the founder gave it. */
interface Setting {
  readonly price?: Money;
  readonly variableCost?: Money;
  readonly setupCosts?: Money;
  readonly fixedFactor?: Rate;
  readonly salesFactor?: Rate;
}

/** A lever set to a value: what the pipeline is run with, and the shift the report shows. */
interface Move {
  readonly setting: Setting;
  readonly shift: () => LeverShift;
}

/**
 * One number the founder can change. `single(rung)` moves it by `rung` steps on its own ladder
 * (a minor unit for the money levers, a tenth of a percent for the fixed cost, 5% for the sales),
 * up to `size` steps, the bound of D-260. `unit` is the relative change of one step.
 */
interface Lever {
  readonly name: ChangeLever;
  readonly size: number;
  readonly unit: Rate;
  readonly single: (rung: number) => Move;
}

/** A lever that can be half of a pair: `pair(percent)` moves it by a whole percent (D-261). */
interface Pairable {
  readonly lever: Lever;
  readonly pair: (percent: number) => Move;
}

/**
 * A row of settings to try for one set of levers: rung 0 is the founder's own numbers and each
 * rung up moves every lever of the set one step further in the direction that helps, up to rung
 * `size`. `scan` marks a row that is not monotone and is walked rung by rung (D-261).
 */
interface Ladder {
  readonly levers: readonly Lever[];
  readonly size: number;
  /** The relative change of one rung (for a pair, the sum of its two levers'). */
  readonly unit: Rate;
  /** Rungs added to a cap, because rounding to the minor unit can make a pair slightly cheaper. */
  readonly slack: number;
  readonly scan: boolean;
  readonly moves: (rung: number) => readonly Move[];
  /** For a pair, each lever moved alone by the same rung; empty for a single lever. */
  readonly alone: readonly ((rung: number) => Move)[];
}

/** A figure the search made: an assumption, never validated, that names where its base came from. */
function assumed<T>(
  value: T,
  used: readonly Provenance[],
  rules: readonly InputRef[] = [{ kind: 'rule', id: CHANGE_RULES.shift }],
): Figure<T> {
  return makeFigure(value, {
    ...combineProvenance(used, rules),
    source: 'assumption',
    validated: false,
  });
}

function moneyShift(
  lever: 'price' | 'variable_cost' | 'setup_costs',
  from: Figure<Money>,
  to: Money,
): LeverShift {
  return {
    lever,
    unit: 'money',
    from,
    to: assumed(to, [from]),
    relativeChange: assumed(makeRate(to.minor - from.value.minor, from.value.minor), [from]),
  };
}

function factorShift(lever: 'fixed_costs' | 'sales', base: Provenance, factor: Rate): LeverShift {
  const from = makeFigure(ONE_RATE, base);
  return {
    lever,
    unit: 'factor',
    from,
    to: assumed(factor, [from]),
    relativeChange: assumed(subtractRates(factor, ONE_RATE), [from]),
  };
}

/**
 * A money lever. A step is one minor unit, so the price (which rises) can double and a cost (which
 * falls) can halve: `direction` is +1 or -1 and `size` the number of steps to the bound. In a pair
 * the amount moves by a whole percent, rounded once to the minor unit half away from zero (D-179).
 */
function moneyLever(
  name: 'price' | 'variable_cost' | 'setup_costs',
  from: Figure<Money>,
  direction: 1n | -1n,
  set: (value: Money) => Setting,
): Pairable {
  const minor = moneyToSafeMinor(from.value);
  const move = (value: Money): Move => ({
    setting: set(value),
    shift: () => moneyShift(name, from, value),
  });
  return {
    lever: {
      name,
      // The price may rise by all of itself, a cost may fall by half of itself, rounded down.
      size: direction === 1n ? minor : Math.floor(minor / 2),
      // A lever with no amount has no steps and is never searched, so the divisor only needs to exist.
      unit: makeRate(1n, BigInt(Math.max(minor, 1))),
      single: (rung) =>
        move(makeMoney(from.value.minor + direction * BigInt(rung), from.value.currency)),
    },
    pair: (percent) =>
      move(mulMoneyByRate(from.value, makeRate(100n + direction * BigInt(percent), 100n))),
  };
}

/** The fixed cost of D-182, F4 plus the payroll of the staff who started plus F4.1, as a factor. */
function fixedCostLever(run: EngineRun): Pairable {
  const { input } = run;
  const base = combineProvenance([input.fixedCosts, input.marketing, input.staff]);
  const move = (factor: Rate): Move => ({
    setting: { fixedFactor: factor },
    shift: () => factorShift('fixed_costs', base, factor),
  });
  return {
    lever: {
      name: 'fixed_costs',
      // A lever with nothing to lower (no fixed cost at all) has no steps.
      size: run.projection.operatingCosts.monthly.some((cost) => cost.minor !== 0n) ? 500 : 0,
      unit: makeRate(1n, 1000n),
      single: (rung) => move(makeRate(BigInt(1000 - rung), 1000n)),
    },
    pair: (percent) => move(makeRate(BigInt(100 - percent), 100n)),
  };
}

/** The sales: three points of a curve multiplied together, up to double in steps of 5%. */
function salesLever(run: EngineRun): Lever {
  const { input } = run;
  return {
    name: 'sales',
    size: run.projection.units.monthly.some((units) => units > 0n) ? SALES_STEPS : 0,
    unit: makeRate(1n, 20n),
    single: (rung) => {
      const factor = makeRate(BigInt(100 + 5 * rung), 100n);
      return {
        setting: { salesFactor: factor },
        shift: () => factorShift('sales', input.sales, factor),
      };
    },
  };
}

/**
 * The sets of levers, in the order they are searched in (D-261): the five single levers first, and
 * the pairs only when fewer than three single levers worked, to make up the three. The result does
 * not depend on the order inside a group (a search that cannot beat the third best change found so
 * far is skipped, and that is exact); it only decides how soon the cut is known. Pairs with the
 * sales are not searched: the sales are not monotone, and a pair is searched on a grid of whole
 * percents that assumes both levers only help as they move further.
 */
const SEARCH_ORDER: readonly (readonly [ChangeLever] | readonly [ChangeLever, ChangeLever])[] = [
  ['price'],
  ['variable_cost'],
  ['fixed_costs'],
  ['sales'],
  ['setup_costs'],
  ['price', 'variable_cost'],
  ['price', 'fixed_costs'],
  ['price', 'setup_costs'],
  ['variable_cost', 'fixed_costs'],
  ['variable_cost', 'setup_costs'],
  ['fixed_costs', 'setup_costs'],
];

/** How many whole percents a pair may move: the lowest bound among the levers is a half (D-260). */
const PAIR_STEPS = 50;
/** The sales are tried at +5%, +10% and so on to +100%. */
const SALES_STEPS = 20;

/**
 * The ladders to search, in `SEARCH_ORDER`: the sets whose levers all exist for this project (a
 * project without set-up costs has no such lever, a zero variable cost cannot fall), and, when the
 * margin is not positive, only those that can mend it.
 */
function laddersOf(run: EngineRun): readonly Ladder[] {
  const { input } = run;
  const pairable = [
    moneyLever('price', input.price, 1n, (price) => ({ price })),
    moneyLever('variable_cost', input.variableCost, -1n, (variableCost) => ({ variableCost })),
    fixedCostLever(run),
    ...(input.setupCosts === null
      ? []
      : [moneyLever('setup_costs', input.setupCosts, -1n, (setupCosts) => ({ setupCosts }))]),
  ].filter((item) => item.lever.size > 0);
  const pairs = new Map(pairable.map((item) => [item.lever.name, item]));
  const sales = salesLever(run);
  const singles = new Map<ChangeLever, Lever>([
    ...pairable.map((item): [ChangeLever, Lever] => [item.lever.name, item.lever]),
    ...(sales.size > 0 ? [['sales', sales] as [ChangeLever, Lever]] : []),
  ]);
  // A margin that is not positive can be mended only by the price and the variable cost
  // (CM = P - VC): the other levers cannot remove that blocker, alone or together (D-260).
  const marginBlocked = run.verdict.blockers.some(
    (blocker) => blocker.code === 'margin_not_positive',
  );

  const ladders: Ladder[] = [];
  for (const names of SEARCH_ORDER) {
    if (marginBlocked && !names.some((name) => name === 'price' || name === 'variable_cost')) {
      continue;
    }
    const [firstName, secondName] = names;
    if (secondName === undefined) {
      const lever = singles.get(firstName);
      if (lever === undefined) continue;
      ladders.push({
        levers: [lever],
        size: lever.size,
        unit: lever.unit,
        slack: 0,
        // With late payment more sales can need more funding (D-248): a larger volume can pass a
        // criterion that a smaller one fails and fail one that a smaller one passes, so there is
        // no boundary to bisect for. The sales are tried one rung at a time, from +5%.
        scan: lever.name === 'sales',
        moves: (rung) => [lever.single(rung)],
        alone: [],
      });
      continue;
    }
    const first = pairs.get(firstName);
    const second = pairs.get(secondName);
    if (first === undefined || second === undefined) continue;
    ladders.push({
      levers: [first.lever, second.lever],
      size: PAIR_STEPS,
      unit: makeRate(2n, 100n),
      slack: 1,
      scan: false,
      moves: (percent) => [first.pair(percent), second.pair(percent)],
      alone: [first.pair, second.pair],
    });
  }
  return ladders;
}

// ---------------------------------------------------------------------------------------------
// The search

/** What the search keeps of one evaluation. */
interface Judged {
  readonly verdict: Assessment['verdict'];
  readonly feasibility: Assessment['feasibility'];
}

/** The context every step of the search shares. */
interface Search {
  readonly run: EngineRun;
  readonly tax: TaxContext;
  readonly params: EngineParams;
  readonly pricingOptions: PricingOptions;
  readonly spend: () => void;
  readonly startedStopped: boolean;
  readonly goReachable: boolean;
  readonly ceiling: Money | null;
}

/** The result of a search over one ladder: the rung to report and what it was judged to be. */
interface Found {
  readonly rung: number;
  readonly judged: Judged;
}

/** A change found by a search, before the ranking. */
interface Candidate {
  /** The indexes of its levers in , joined: '01' is the price with the variable cost. */
  readonly order: string;
  readonly effort: Rate;
  readonly change: Change;
}

/** The input with the money levers of the settings applied; the founder's input is never touched. */
function adjustedInput(input: EngineInput, setting: Setting): EngineInput {
  return {
    ...input,
    price: setting.price === undefined ? input.price : { ...input.price, value: setting.price },
    variableCost:
      setting.variableCost === undefined
        ? input.variableCost
        : { ...input.variableCost, value: setting.variableCost },
    setupCosts:
      setting.setupCosts === undefined || input.setupCosts === null
        ? input.setupCosts
        : { ...input.setupCosts, value: setting.setupCosts },
  };
}

function judge(search: Search, moves: readonly Move[]): Judged {
  search.spend();
  const setting = moves.reduce<Setting>((all, move) => ({ ...all, ...move.setting }), {});
  const adjustments: ProjectionAdjustments = {
    ...(setting.fixedFactor === undefined ? {} : { fixedCostMultiplier: setting.fixedFactor }),
    ...(setting.salesFactor === undefined ? {} : { salesMultiplier: setting.salesFactor }),
  };
  const assessed = assess(
    adjustedInput(search.run.input, setting),
    search.tax,
    search.params,
    search.pricingOptions,
    adjustments,
  );
  return { verdict: assessed.verdict, feasibility: assessed.feasibility };
}

const isGo = (judged: Judged): boolean => judged.verdict.verdict.value === 'go';

/** The first target: no blocker for a `stop`; the go line for a `revise`. */
const reachesFirstTarget = (search: Search, judged: Judged): boolean =>
  search.startedStopped ? judged.verdict.verdict.value !== 'stop' : isGo(judged);

/**
 * The highest rung whose relative change is not above `cut` (the effort of the third best change
 * so far), or the bound of the lever when there is no cut yet. A change beyond it cannot be one of
 * the three smallest, so it is not searched.
 */
function capOf(ladder: Ladder, cut: Rate | null): number {
  if (cut === null) return ladder.size;
  const rungs = (cut.num * ladder.unit.den) / (cut.den * ladder.unit.num) + BigInt(ladder.slack);
  return rungs >= BigInt(ladder.size) ? ladder.size : Number(rungs);
}

/**
 * Looks for the smallest rung of a monotone ladder that reaches the first target, and then, for a
 * `stop`, for the smallest that reaches `go`, which is the one reported when it is inside the
 * bounds (D-260). Every rung is judged once. A money lever and a pair can only help as they move
 * further, so the boundary is found by bisection: the lower end is a rung known to fail (the
 * founder's own numbers) and the upper end one that was judged to pass, so the answer always
 * passes, whatever the cash flow does in between. Returns null when the target is out of reach
 * inside the cut.
 */
function bisect(search: Search, ladder: Ladder, cut: Rate | null): Found | null {
  const memo = new Map<number, Judged>();
  const judgedAt = (rung: number): Judged => {
    const known = memo.get(rung);
    if (known !== undefined) return known;
    const fresh = judge(search, ladder.moves(rung));
    memo.set(rung, fresh);
    return fresh;
  };
  /** The smallest rung above `low` up to `high` for which `passes` holds, given that `high` passes. */
  const smallest = (low: number, high: number, passes: (judged: Judged) => boolean): number => {
    let failing = low;
    let passing = high;
    while (passing - failing > 1) {
      const middle = failing + Math.floor((passing - failing) / 2);
      if (passes(judgedAt(middle))) passing = middle;
      else failing = middle;
    }
    return passing;
  };

  const top = capOf(ladder, cut);
  if (top < 1 || !reachesFirstTarget(search, judgedAt(top))) return null;
  const first = smallest(0, top, (judged) => reachesFirstTarget(search, judged));
  if (isGo(judgedAt(first)) || !search.goReachable) return { rung: first, judged: judgedAt(first) };
  if (top > first && isGo(judgedAt(top))) {
    const rung = smallest(first, top, isGo);
    return { rung, judged: judgedAt(rung) };
  }
  // Go may lie past the cut: then the change that reaches it is too large to be one of the three
  // smallest, and the one that only removes the blockers is not what the search would report.
  if (top < ladder.size && isGo(judgedAt(ladder.size))) return null;
  return { rung: first, judged: judgedAt(first) };
}

/** The same as `bisect` for a ladder that is walked rung by rung, from the smallest change up. */
function walk(search: Search, ladder: Ladder, cut: Rate | null): Found | null {
  const top = capOf(ladder, cut);
  if (top < 1) return null;
  let first: Found | null = null;
  for (let rung = 1; rung <= ladder.size; rung += 1) {
    const judged = judge(search, ladder.moves(rung));
    if (first === null && reachesFirstTarget(search, judged)) first = { rung, judged };
    if (isGo(judged)) return { rung, judged };
    if (first !== null && !search.goReachable) return first;
    if (first === null && rung >= top) return null;
  }
  return first;
}

/**
 * Whether a pair that was found has a lever it does not need: one of the two, moved alone by the
 * same percent, already does what the pair does (reaches `go` if the pair reaches it, otherwise
 * leaves no blocker). Such a pair is only the single lever with a useless second one, so it is not
 * a change worth suggesting (D-261). The check is skipped for a single lever.
 */
function hasUselessLever(search: Search, ladder: Ladder, found: Found): boolean {
  const target = isGo(found.judged) ? isGo : (judged: Judged) => reachesFirstTarget(search, judged);
  return ladder.alone.some((part) => target(judge(search, [part(found.rung)])));
}

// ---------------------------------------------------------------------------------------------
// Ranking

const absRate = (rate: Rate): Rate => (rate.num < 0n ? negateRate(rate) : rate);

const LEVER_INDEX: Readonly<Record<ChangeLever, number>> = {
  price: 0,
  variable_cost: 1,
  fixed_costs: 2,
  sales: 3,
  setup_costs: 4,
};

/** The tornado's name for each lever it shares with the search; set-up costs are not in the tornado. */
const TORNADO_LEVER: Readonly<Record<TornadoVariable, ChangeLever>> = {
  price: 'price',
  vc: 'variable_cost',
  sales: 'sales',
  fixed_costs: 'fixed_costs',
};

function candidateOf(search: Search, ladder: Ladder, found: Found): Candidate {
  const moves = ladder.moves(found.rung);
  const shifts = moves.map((move) => move.shift());
  const effort = shifts.reduce(
    (sum, shift) => addRates(sum, absRate(shift.relativeChange.value)),
    ZERO_RATE,
  );
  const { feasibility, verdict } = found.judged;
  const rules: readonly InputRef[] = [{ kind: 'rule', id: CHANGE_RULES.outcome }];
  const ceiling = search.ceiling;
  return {
    order: ladder.levers.map((lever) => String(LEVER_INDEX[lever.name])).join(''),
    effort,
    change: {
      shifts,
      effort: assumed(
        effort,
        shifts.map((shift) => shift.relativeChange),
      ),
      premium: shifts.some(
        (shift) =>
          shift.lever === 'price' && ceiling !== null && shift.to.value.minor > ceiling.minor,
      ),
      reachesThreshold: isGo(found.judged),
      outcome: {
        verdict: assumed(verdict.verdict.value, [verdict.verdict], rules),
        score:
          feasibility.score === null
            ? null
            : assumed(feasibility.score.value, [feasibility.score], rules),
        passed: feasibility.passed,
        evaluated: feasibility.evaluated,
      },
    },
  };
}

/**
 * Smaller effort first; equal efforts by the order of the levers, a lever before its pairs. Two
 * candidates never share a lever set, so the order strings are never equal.
 */
function compareCandidates(a: Candidate, b: Candidate): number {
  const byEffort = compareRates(a.effort, b.effort);
  if (byEffort !== 0) return byEffort;
  return a.order < b.order ? -1 : 1;
}

/** The effort of the third best candidate, or null while there are fewer than three. */
function cutOf(found: readonly Candidate[]): Rate | null {
  const third = [...found].sort(compareCandidates)[2];
  return third === undefined ? null : third.effort;
}

// ---------------------------------------------------------------------------------------------
// The entry point

/**
 * The changes to the founder's own numbers that would change the verdict of `run` (D-228, D-260,
 * D-261). `run` must be the result of `runEngine` for the same `tax`, `overrides` and
 * `pricingOptions` given here: the search judges each change by the same pipeline, and the verdict
 * it starts from is the run's.
 *
 * A `go` needs no change. For a `stop`, the target is first the smallest change that leaves no
 * blocker, and then the smallest that reaches `go`; the latter is reported when it exists inside
 * the bounds (the price up to double, the costs and the set-up costs down to half, the sales up to
 * double), and `reachesThreshold` says so. For a `revise` the target is the go line. Single levers
 * come first, then pairs that move by the same relative step; the changes are ranked by effort,
 * the sum of the absolute relative changes, and the three smallest with different lever sets are
 * returned. A `stop` with fewer than three is filled with the largest drivers of the tornado that
 * no change uses, as `rethink`, with no target values. The search runs the engine at most
 * `changes.search_budget` times (160 by default) and says when it ran out.
 *
 * Pure and deterministic: no clock, no randomness; the same arguments give a deeply equal result,
 * and `run` and its input are never changed. Throws what the engine throws, and `invalid_param`
 * for an override out of its range.
 */
export function suggestChanges(
  run: EngineRun,
  tax: TaxContext = { rules: [] },
  overrides: EngineParamOverrides = {},
  pricingOptions: PricingOptions = {},
): SuggestedChanges {
  const params = createEngineParams(overrides);
  const verdict = run.verdict.verdict;
  const parameters = listChangeParams(params);
  const band = run.pricing.band;
  const marketCeiling = band === null ? null : makeFigure(band.value.max, band);
  const nothing = { changes: [], rethink: [], marketCeiling, parameters } as const;

  if (verdict.value === 'go') {
    return {
      status: 'none_needed',
      verdict,
      ...nothing,
      goBlockedBy: null,
      evaluations: 0,
      complete: true,
    };
  }
  const startedStopped = verdict.value === 'stop';
  const goReachable = run.confidence.level.value !== 'low';
  if (!startedStopped && !goReachable) {
    // A revise held back by low confidence: no number the founder can change lifts it.
    return {
      status: 'suggested',
      verdict,
      ...nothing,
      goBlockedBy: 'confidence_low',
      evaluations: 0,
      complete: true,
    };
  }

  let used = 0;
  const budget = params.changeSearchBudget.value;
  const search: Search = {
    run,
    tax,
    params,
    pricingOptions,
    spend: () => {
      if (used >= budget) throw new BudgetSpent();
      used += 1;
    },
    startedStopped,
    goReachable,
    ceiling: marketCeiling === null ? null : marketCeiling.value,
  };

  const found: Candidate[] = [];
  let complete = true;
  try {
    let singles = 0;
    for (const ladder of laddersOf(run)) {
      const isPair = ladder.levers.length === 2;
      // Pairs make up the three when the single levers did not give them (D-261).
      if (isPair && singles >= 3) break;
      const result = (ladder.scan ? walk : bisect)(search, ladder, cutOf(found));
      if (result === null || hasUselessLever(search, ladder, result)) continue;
      found.push(candidateOf(search, ladder, result));
      if (!isPair) singles += 1;
    }
  } catch (error) {
    if (!(error instanceof BudgetSpent)) throw error;
    complete = false;
  }

  const changes = found
    .sort(compareCandidates)
    .slice(0, 3)
    .map((candidate) => candidate.change);

  const usedLevers = new Set(
    changes.flatMap((change) => change.shifts.map((shift) => shift.lever)),
  );
  const rethink: RethinkItem[] = [];
  if (startedStopped) {
    run.tornado.rows.forEach((row, index) => {
      const lever = TORNADO_LEVER[row.variable];
      if (changes.length + rethink.length >= 3) return;
      if (usedLevers.has(lever) || row.swing.value.minor === 0n) return;
      rethink.push({ lever, rank: index + 1, swing: row.swing });
    });
  }

  return {
    status: 'suggested',
    verdict,
    changes,
    rethink,
    marketCeiling,
    goBlockedBy: null,
    evaluations: used,
    complete,
    parameters,
  };
}
