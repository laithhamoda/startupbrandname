import { economicsAlerts, type Alert } from './alerts';
import type { EngineInput } from './input';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from './params';
import { pricing, type Pricing, type PricingOptions } from './pricing';
import type { OperatingProjection } from './projection';
import { unitEconomics, type UnitEconomics } from './unit-economics';

/** T8, T7 and their alerts for one project (D-190). */
export interface EconomicsAnalysis {
  readonly unitEconomics: UnitEconomics;
  readonly pricing: Pricing;
  /** In the order of D-190; empty when nothing is wrong. */
  readonly alerts: readonly Alert[];
}

/**
 * Composes T8 (unit economics and break-even), T7 (pricing) and the alerts from an input the
 * adapter accepted and the projection made from it (SPEC §4; D-182, D-189, D-190). `options` says
 * what the caller knows that the answers alone do not: whether D5 passed rule R5 (the premium
 * price). Pure and deterministic. Throws `currency_mismatch` if the projection was made in another
 * currency than the input.
 */
export function analyseEconomics(
  input: EngineInput,
  projection: OperatingProjection,
  options: PricingOptions = {},
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): EconomicsAnalysis {
  const unit = unitEconomics(input, projection);
  const prices = pricing(input, projection, options, params);
  return {
    unitEconomics: unit,
    pricing: prices,
    alerts: economicsAlerts(input, projection, unit, prices, params),
  };
}
