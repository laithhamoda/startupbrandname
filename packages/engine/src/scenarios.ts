import { at } from './array';
import { cashFlow, type BlockedCashFlow } from './cash-flow';
import { combineFigures, type Figure, type InputRef, type Provenance } from './figure';
import type { EngineInput } from './input';
import { compareMoney, makeMoney, sumMoney, type Money } from './money';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from './params';
import {
  firstProfitableMonth,
  projectOperatingLines,
  type OperatingProjection,
  type ProjectionAdjustments,
} from './projection';
import { addRates, multiplyRates, ONE_RATE, subtractRates, type Rate } from './rate';
import { taxAnalysis, type TaxContext } from './tax';

/** The stable IDs of the T10 rules, listed in the inputs of the figures they produce (D-181). */
export const T10_RULES = {
  scenario: 'T10.scenario',
  tornado: 'T10.tornado',
} as const;

/** The three scenarios of T10 (SPEC §4): the founder's own numbers sit between the other two. */
export type ScenarioKind = 'conservative' | 'base' | 'optimistic';

/**
 * The funding need of one scenario: the number, or why there is none. The cash flow needs F5; when
 * it is missing or «لا أعرف» the scenario says so, like the cash flow itself (D-213, D-218).
 */
export type ScenarioFunding =
  | { readonly status: 'ok'; readonly need: Figure<Money> }
  | { readonly status: 'not_calculable'; readonly reason: BlockedCashFlow['reason'] };

/** One scenario: what it changed, and what the project looks like under it (D-218). */
export interface ScenarioResult {
  readonly kind: ScenarioKind;
  /** What the units a month were multiplied by (1 for the base). */
  readonly salesMultiplier: Rate;
  /** What the variable cost was multiplied by (1 for the base). */
  readonly vcMultiplier: Rate;
  /** How many months the sales were pushed later (0 except for the conservative scenario). */
  readonly launchDelayMonths: number;
  /** The first month with an operating profit of zero or more; null when none within the horizon. */
  readonly breakEvenMonth: Figure<number | null>;
  readonly funding: ScenarioFunding;
  /** The operating profit before tax of projection year 1. */
  readonly firstYearOperatingProfit: Figure<Money>;
}

/** T10's three scenarios, each a rerun of the projection, the tax and the cash flow (not the FX test). */
export interface Scenarios {
  readonly conservative: ScenarioResult;
  readonly base: ScenarioResult;
  readonly optimistic: ScenarioResult;
}

/** The variables of the tornado, in the order that breaks ties: P, VC, sales, FC (SPEC §4, D-218). */
export type TornadoVariable = 'price' | 'vc' | 'sales' | 'fixed_costs';

/** One bar of the tornado: the year-1 operating profit at each end of the swing, and their distance. */
export interface TornadoRow {
  readonly variable: TornadoVariable;
  /** The year-1 operating profit before tax with the variable lowered by the swing. */
  readonly atLow: Figure<Money>;
  /** The year-1 operating profit before tax with the variable raised by the swing. */
  readonly atHigh: Figure<Money>;
  /** The absolute difference between the two. */
  readonly swing: Figure<Money>;
}

/** The sensitivity of the year-1 operating profit to each variable, widest swing first. */
export interface Tornado {
  /** The share each variable moves up and down (`params.tornadoSwing`, 20% by default). */
  readonly change: Figure<Rate>;
  /** Ranked by swing, widest first; equal swings keep the order price, VC, sales, fixed costs. */
  readonly rows: readonly TornadoRow[];
  /**
   * The variable with the widest swing: it becomes the first T18 experiment (SPEC §4). Null when
   * no variable moves the profit at all.
   */
  readonly top: Figure<TornadoVariable> | null;
}

const rule = (id: string): InputRef => ({ kind: 'rule', id });

/** The operating profit before tax of projection year 1 (months 1 to 12). */
function firstYearProfit(input: EngineInput, projection: OperatingProjection): Money {
  return sumMoney(input.currency, projection.operatingProfit.monthly.slice(0, 12));
}

function scenario(
  kind: ScenarioKind,
  input: EngineInput,
  context: TaxContext,
  params: EngineParams,
  changes: {
    readonly sales: Rate;
    readonly vc: Rate;
    readonly delay: number;
    readonly used: readonly Provenance[];
  },
  base: ProjectionAdjustments = {},
): ScenarioResult {
  // `base` is what a caller already changed in the project (the search of D-228 tries a larger
  // sales volume or lower fixed costs); the scenario's own factors come on top of it. Without
  // `base` the projection is called exactly as the scenario defines it.
  const projection = projectOperatingLines(input, params, {
    ...base,
    salesMultiplier:
      base.salesMultiplier === undefined
        ? changes.sales
        : multiplyRates(changes.sales, base.salesMultiplier),
    cogsMultiplier:
      base.cogsMultiplier === undefined
        ? changes.vc
        : multiplyRates(changes.vc, base.cogsMultiplier),
    launchDelayMonths: changes.delay + (base.launchDelayMonths ?? 0),
  });
  const flow = cashFlow(input, projection, taxAnalysis(input, projection, context), params);
  const used = changes.used;
  const rules = [rule(T10_RULES.scenario)];
  return {
    kind,
    salesMultiplier: changes.sales,
    vcMultiplier: changes.vc,
    launchDelayMonths: changes.delay,
    breakEvenMonth: combineFigures(
      firstProfitableMonth(projection),
      [projection.operatingProfit.provenance, ...used],
      rules,
    ),
    funding:
      flow.status === 'ok'
        ? {
            status: 'ok',
            need: combineFigures(flow.fundingNeed.value, [flow.fundingNeed, ...used], rules),
          }
        : { status: 'not_calculable', reason: flow.reason },
    firstYearOperatingProfit: combineFigures(
      firstYearProfit(input, projection),
      [projection.operatingProfit.provenance, ...used],
      rules,
    ),
  };
}

/**
 * The conservative scenario alone (D-218), which the feasibility score reads: `scenarioAnalysis`
 * calls it, and so does the search of D-228, which needs only this scenario for each change it
 * tries. `base` holds adjustments the caller already made to the project (a sales multiplier, a
 * fixed-cost multiplier); the scenario's own factors come on top of them, rounded once, and an
 * empty `base` is exactly the scenario of `scenarioAnalysis`. Pure and deterministic.
 */
export function conservativeScenario(
  input: EngineInput,
  context: TaxContext = { rules: [] },
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
  base: ProjectionAdjustments = {},
): ScenarioResult {
  return scenario(
    'conservative',
    input,
    context,
    params,
    {
      sales: params.conservativeSalesFactor.value,
      vc: params.conservativeVcFactor.value,
      delay: params.conservativeLaunchDelayMonths.value,
      used: [
        params.conservativeSalesFactor,
        params.conservativeVcFactor,
        params.conservativeLaunchDelayMonths,
      ],
    },
    base,
  );
}

/**
 * T10's scenarios (SPEC §4; D-189, D-217, D-218). The conservative scenario multiplies the units by
 * `params.conservativeSalesFactor` and the variable cost by `params.conservativeVcFactor` and
 * delays the launch by `params.conservativeLaunchDelayMonths`, all together; the base scenario is
 * the founder's own numbers; the optimistic one uses the two optimistic factors and no delay.
 * Each reruns the projection, the tax of `context` and the cash flow (the FX test is not rerun) and
 * reports the break-even month (the one function T8 and the FX test use, D-207), the funding need
 * (not calculable with the F5 reason when the cash flow is not) and the operating profit before
 * tax of year 1. The multipliers and the delay are engine parameters, so every figure lists them as
 * assumptions. Pure and deterministic. Throws what the projection, the tax engine and the cash flow
 * throw.
 */
export function scenarioAnalysis(
  input: EngineInput,
  context: TaxContext = { rules: [] },
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): Scenarios {
  return {
    conservative: conservativeScenario(input, context, params),
    base: scenario('base', input, context, params, {
      sales: ONE_RATE,
      vc: ONE_RATE,
      delay: 0,
      used: [],
    }),
    optimistic: scenario('optimistic', input, context, params, {
      sales: params.optimisticSalesFactor.value,
      vc: params.optimisticVcFactor.value,
      delay: 0,
      used: [params.optimisticSalesFactor, params.optimisticVcFactor],
    }),
  };
}

/** The adjustments that move one tornado variable by `factor` (1 + the swing, or 1 - the swing). */
const TORNADO_VARIABLES: readonly {
  readonly variable: TornadoVariable;
  readonly adjust: (factor: Rate) => ProjectionAdjustments;
}[] = [
  { variable: 'price', adjust: (factor) => ({ priceMultiplier: factor }) },
  { variable: 'vc', adjust: (factor) => ({ cogsMultiplier: factor }) },
  { variable: 'sales', adjust: (factor) => ({ salesMultiplier: factor }) },
  { variable: 'fixed_costs', adjust: (factor) => ({ fixedCostMultiplier: factor }) },
];

/**
 * T10's tornado (SPEC §4; D-217, D-218): the price, the variable cost, the sales and the fixed
 * cost are each lowered and raised by `params.tornadoSwing` (20% by default) alone, and the
 * operating profit before tax of year 1 is read at each end. The swing of a variable is the
 * absolute difference between its two ends; the rows are ranked by it, widest first, equal swings
 * in the order price, VC, sales, fixed costs. The fixed cost is D-182's full fixed cost (F4, the
 * payroll of the staff who have started and F4.1). The top variable is the widest one, or null
 * when no variable moves the profit. Pure and deterministic.
 */
export function tornadoAnalysis(
  input: EngineInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): Tornado {
  const swing = params.tornadoSwing;
  const down = subtractRates(ONE_RATE, swing.value);
  const up = addRates(ONE_RATE, swing.value);
  const rules = [rule(T10_RULES.tornado)];
  const profitAt = (adjustments: ProjectionAdjustments): Figure<Money> => {
    const projection = projectOperatingLines(input, params, adjustments);
    return combineFigures(
      firstYearProfit(input, projection),
      [projection.operatingProfit.provenance, swing],
      rules,
    );
  };
  const rows = TORNADO_VARIABLES.map(({ variable, adjust }): TornadoRow => {
    const atLow = profitAt(adjust(down));
    const atHigh = profitAt(adjust(up));
    const gap = makeMoney(
      compareMoney(atHigh.value, atLow.value) >= 0
        ? atHigh.value.minor - atLow.value.minor
        : atLow.value.minor - atHigh.value.minor,
      input.currency,
    );
    return { variable, atLow, atHigh, swing: combineFigures(gap, [atLow, atHigh], rules) };
  });
  // Array.prototype.sort is stable, so equal swings keep the order above.
  const ranked = [...rows].sort((a, b) => compareMoney(b.swing.value, a.swing.value));
  const first = at(ranked, 0);
  return {
    change: swing,
    rows: ranked,
    top:
      first.swing.value.minor === 0n ? null : combineFigures(first.variable, [first.swing], rules),
  };
}
