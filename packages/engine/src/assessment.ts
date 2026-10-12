import { cashFlow, type CashFlow } from './cash-flow';
import { overallConfidence, type OverallConfidence } from './confidence';
import { analyseEconomics, type EconomicsAnalysis } from './economics';
import { feasibility, type Feasibility } from './feasibility';
import type { EngineInput } from './input';
import type { EngineParams } from './params';
import type { PricingOptions } from './pricing';
import {
  projectOperatingLines,
  type OperatingProjection,
  type ProjectionAdjustments,
} from './projection';
import { conservativeScenario, type ScenarioResult } from './scenarios';
import { taxAnalysis, type TaxAnalysis, type TaxContext } from './tax';
import { blockersOf, verdictOf, type Blocker, type VerdictResult } from './verdict';

/**
 * Everything the verdict is made of, for one project and one set of adjustments (D-228): the
 * pipeline `runEngine` and the search for the changes that would change a verdict share, so that
 * a change is judged by exactly the code that judges the founder's own numbers.
 */
export interface Assessment {
  readonly projection: OperatingProjection;
  readonly economics: EconomicsAnalysis;
  readonly tax: TaxAnalysis;
  readonly cashFlow: CashFlow;
  readonly feasibility: Feasibility;
  readonly confidence: OverallConfidence;
  readonly blockers: readonly Blocker[];
  readonly verdict: VerdictResult;
}

/**
 * The projection (with `adjustments`), T8 and T7 with their alerts, the tax, the cash flow, the
 * conservative scenario only, the feasibility, overall confidence, the blockers and the verdict
 * (D-227). The FX test, the other two scenarios, the tornado and the validation plan are not part
 * of the verdict, so they are left to `runEngine`. `conservative` is the conservative scenario
 * when the caller already made it for the same project (`runEngine` does); without it the scenario
 * is made here on top of `adjustments`, so a larger sales volume or lower fixed costs reach it
 * too. Pure and deterministic; throws what its parts throw.
 */
export function assess(
  input: EngineInput,
  context: TaxContext,
  params: EngineParams,
  pricingOptions: PricingOptions = {},
  adjustments: ProjectionAdjustments = {},
  conservative: ScenarioResult = conservativeScenario(input, context, params, adjustments),
): Assessment {
  const projection = projectOperatingLines(input, params, adjustments);
  const economics = analyseEconomics(input, projection, pricingOptions, params);
  const tax = taxAnalysis(input, projection, context);
  const flow = cashFlow(input, projection, tax, params);
  const score = feasibility(
    input,
    projection,
    economics.unitEconomics,
    economics.pricing,
    flow,
    { conservative },
    params,
  );
  const confidence = overallConfidence(input, params);
  const blockers = blockersOf(input, projection, economics.unitEconomics, flow, params);
  return {
    projection,
    economics,
    tax,
    cashFlow: flow,
    feasibility: score,
    confidence,
    blockers,
    verdict: verdictOf(blockers, score, confidence, params),
  };
}
