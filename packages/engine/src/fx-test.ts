import { cashFlow } from './cash-flow';
import { combineFigures, makeFigure, type Figure, type InputRef } from './figure';
import type { EngineInput } from './input';
import { sumMoney, type Money } from './money';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from './params';
import { firstProfitableMonth, projectOperatingLines } from './projection';
import { addRates, multiplyRates, ONE_RATE, type Rate } from './rate';
import { taxAnalysis, type TaxContext } from './tax';

/** The stable ID of the FX test, listed in the inputs of the figures it produces (D-181). */
export const FX_RULES = { test: 'T9.fx_test' } as const;

/** What one FX shock does to the project (SPEC T9, D-214). */
export interface FxShockResult {
  /** The change in the cost of the imported share: -1/5 for -20%. */
  readonly shock: Rate;
  /** What COGS was multiplied by: 1 + share x shock (D-214). */
  readonly cogsMultiplier: Rate;
  /** The first month with an operating profit of zero or more; null when none within the horizon. */
  readonly breakEvenMonth: Figure<number | null>;
  /** The funding need of the cash flow with the shocked costs; null when the cash flow needs F5. */
  readonly fundingNeed: Figure<Money> | null;
  /** The operating profit before tax of projection year 1. */
  readonly firstYearOperatingProfit: Figure<Money>;
}

/** The FX test of T9: the project again with the imported share of COGS dearer or cheaper. */
export interface FxTest {
  /** D6: the share of the costs that depends on imports or a foreign currency. */
  readonly share: Figure<Rate>;
  /** One result per shock, in the order of `params.fxShocks`. */
  readonly shocks: readonly FxShockResult[];
}

const rule = (id: string): InputRef => ({ kind: 'rule', id });

/**
 * The FX test of T9 (SPEC §4, D-214): when D6 says part of the costs is imported or in a foreign
 * currency, the projection, the tax and the cash flow are made again with COGS changed on that
 * share only. Each shock in `params.fxShocks` (-20%, -10%, +10% and +20% by default) multiplies
 * COGS by `1 - share + share x (1 + shock)`, which is `1 + share x shock`, rounded once on each
 * monthly line together with the inflation (D-179). For each shock it reports the break-even
 * month, the funding need and the operating profit of year 1. Returns null when D6 gives no share
 * (it is "no", 0 percent, missing or «لا أعرف»): there is no FX risk to test. `context` is the tax
 * rules of the run, so the tax follows the shocked profit. Pure and deterministic.
 */
export function fxTest(
  input: EngineInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
  context: TaxContext = { rules: [] },
): FxTest | null {
  const shareValue = input.foreignShare.value;
  if (shareValue === null) return null;
  const share = makeFigure(shareValue, input.foreignShare);
  const shocks = params.fxShocks.value.map((shock): FxShockResult => {
    const cogsMultiplier = addRates(ONE_RATE, multiplyRates(shareValue, shock));
    const projection = projectOperatingLines(input, params, { cogsMultiplier });
    const flow = cashFlow(input, projection, taxAnalysis(input, projection, context), params);
    const used = [input.foreignShare, params.fxShocks] as const;
    return {
      shock,
      cogsMultiplier,
      breakEvenMonth: combineFigures(
        firstProfitableMonth(projection),
        [projection.operatingProfit.provenance, ...used],
        [rule(FX_RULES.test)],
      ),
      fundingNeed:
        flow.status === 'ok'
          ? combineFigures(
              flow.fundingNeed.value,
              [flow.fundingNeed, ...used],
              [rule(FX_RULES.test)],
            )
          : null,
      firstYearOperatingProfit: combineFigures(
        sumMoney(input.currency, projection.operatingProfit.monthly.slice(0, 12)),
        [projection.operatingProfit.provenance, ...used],
        [rule(FX_RULES.test)],
      ),
    };
  });
  return { share, shocks };
}
