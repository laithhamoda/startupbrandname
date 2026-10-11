import { cashFlow, type CashFlow } from './cash-flow';
import { fxTest, type FxTest } from './fx-test';
import type { EngineInput } from './input';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from './params';
import type { OperatingProjection } from './projection';
import { taxAnalysis, type TaxAlert, type TaxAnalysis, type TaxContext } from './tax';

/** The tax, the cash flow with its funding need and payback, and the FX test of one project (T9). */
export interface CashAnalysis {
  readonly tax: TaxAnalysis;
  readonly cashFlow: CashFlow;
  /** Null when D6 gives no foreign-currency share. */
  readonly fxTest: FxTest | null;
  /** The alerts of the tax engine: the regime not calculated, the ceiling, the VAT threshold. */
  readonly alerts: readonly TaxAlert[];
}

/**
 * Composes the tax engine, the cash flow and the FX test from an input the adapter accepted and
 * the projection made from it (SPEC §4 T9; D-186 to D-188, D-211 to D-215). `context` holds the
 * tax rules and the VAT threshold the caller knows; without it no regime is calculated and the
 * cash flow is before tax, with a note. Pure and deterministic. Throws `currency_mismatch` if the
 * projection was made in another currency than the input.
 */
export function analyseCash(
  input: EngineInput,
  projection: OperatingProjection,
  context: TaxContext = { rules: [] },
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): CashAnalysis {
  const tax = taxAnalysis(input, projection, context);
  return {
    tax,
    cashFlow: cashFlow(input, projection, tax, params),
    fxTest: fxTest(input, params, context),
    alerts: tax.alerts,
  };
}
