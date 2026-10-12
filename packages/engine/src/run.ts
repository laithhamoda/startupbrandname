import type { Answers } from '@sbn/question-bank';
import type { Alert, AlertSeverity } from './alerts';
import { assess } from './assessment';
import type { CashAnalysis } from './cash';
import type { OverallConfidence } from './confidence';
import type { Feasibility } from './feasibility';
import { fxTest } from './fx-test';
import type { Figure } from './figure';
import {
  engineInputFrom,
  type EngineInput,
  type NotCalculableReason,
  type ProjectContext,
  type ProvenanceBySteps,
} from './input';
import { createEngineParams, listEngineParams, type EngineParamOverrides } from './params';
import type { Pricing, PricingOptions } from './pricing';
import type { OperatingProjection } from './projection';
import { scenarioAnalysis, tornadoAnalysis, type Scenarios, type Tornado } from './scenarios';
import type { TaxAlert, TaxContext } from './tax';
import type { UnitEconomics } from './unit-economics';
import { validationPlan, type ValidationPlan } from './validation-plan';
import type { VerdictResult } from './verdict';
import { ENGINE_VERSION } from './version';

/**
 * An alert of the run, whichever engine raised it (D-220): `origin` says whether it is one of T8
 * and T7 (D-210) or of the tax engine (D-211), whose alerts carry a projection year, a regime and
 * a gap. The report branches on `code`.
 */
export type RunAlert =
  (Alert & { readonly origin: 'economics' }) | (TaxAlert & { readonly origin: 'tax' });

/**
 * Everything the engine knows about one project (D-220): the input and its notes, the operating
 * projection, T8 and T7, the cash analysis (tax, cash flow with its funding need and payback, FX
 * test), T10's scenarios and tornado, the feasibility score, the verdict, the overall confidence
 * and the validation plan T18 (D-227 to D-230), the parameters used, and one list of alerts.
 */
export interface EngineRun {
  readonly engineVersion: string;
  /** The adapter's input; its `notes` say how each missing or unknown answer was read. */
  readonly input: EngineInput;
  /** Every engine default or override the run used, as figures, in the order of `listEngineParams`. */
  readonly parameters: readonly Figure<unknown>[];
  readonly projection: OperatingProjection;
  readonly unitEconomics: UnitEconomics;
  readonly pricing: Pricing;
  /**
   * The tax, the cash flow and the FX test. Its alerts are in `alerts`, once (D-216);
   * `cash.tax.alerts` is the tax view's own copy and must not be merged again (D-220).
   */
  readonly cash: Omit<CashAnalysis, 'alerts'>;
  readonly scenarios: Scenarios;
  readonly tornado: Tornado;
  /** The criteria of D-227 and the score that counts them; the score is not a probability of success. */
  readonly feasibility: Feasibility;
  /** Overall confidence in the five pivotal figures (D-229). */
  readonly confidence: OverallConfidence;
  /** The verdict: go, revise or stop, with the blockers that hold (D-227). */
  readonly verdict: VerdictResult;
  /** The three experiments to run first (D-230). */
  readonly validationPlan: ValidationPlan;
  /**
   * The alerts of T8 and T7 and of the tax engine, each once: blocks first, then warnings, then
   * notes, each group by code (D-220).
   */
  readonly alerts: readonly RunAlert[];
}

/** The result of a run: the whole analysis, or the reasons the answers cannot be calculated. */
export type EngineRunResult =
  | { readonly status: 'ok'; readonly run: EngineRun }
  | { readonly status: 'not_calculable'; readonly reasons: readonly NotCalculableReason[] };

const SEVERITY_ORDER: Readonly<Record<AlertSeverity, number>> = { block: 0, warning: 1, note: 2 };

/**
 * One list from the alerts of T8 and T7 and those of the tax engine (D-220): blocks, then warnings,
 * then notes, each group by alert code in plain code-unit order (no locale), and alerts of the same
 * code in the order they were raised (the sort is stable): the economics alerts first, then the
 * tax alerts by year. Each alert appears once: pass `CashAnalysis.alerts` or `tax.alerts`, not both.
 */
export function mergeAlerts(
  economics: readonly Alert[],
  tax: readonly TaxAlert[],
): readonly RunAlert[] {
  const all: RunAlert[] = [
    ...economics.map((alert): RunAlert => ({ ...alert, origin: 'economics' })),
    ...tax.map((alert): RunAlert => ({ ...alert, origin: 'tax' })),
  ];
  return all.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
}

/**
 * The single entry point of the engine, which M5 calls (D-178, D-220). It reads the stored answers
 * (`engineInputFrom`: what the answers are, where they came from, which project) and, when they can
 * be calculated, makes the whole analysis: the operating projection, T8 and T7, the tax, the cash
 * flow, the funding need, the payback and the FX test, T10's three scenarios and its tornado, the
 * feasibility score, the verdict, the overall confidence and the validation plan, and one merged
 * list of alerts. `tax` is what the caller knows about taxes for the country (rules from
 * the country pack, the VAT threshold); without it no regime is calculated and the cash flow is
 * before tax, with a note. `overrides` replace engine defaults, each with its own provenance
 * (`createEngineParams`); `pricingOptions` says whether D5 passed rule R5. Pure and deterministic:
 * the same arguments give a deeply equal result, and nothing reads a clock, a random number or
 * the network. Answers that cannot be calculated give `not_calculable` with the adapter's reasons,
 * never a guess. Throws `invalid_param` for an override out of its range or a malformed tax rule.
 */
export function runEngine(
  answers: Answers,
  provenance: ProvenanceBySteps,
  project: ProjectContext,
  tax: TaxContext = { rules: [] },
  overrides: EngineParamOverrides = {},
  pricingOptions: PricingOptions = {},
): EngineRunResult {
  const params = createEngineParams(overrides);
  const adapted = engineInputFrom(answers, provenance, project);
  if (adapted.status === 'not_calculable') {
    return { status: 'not_calculable', reasons: adapted.reasons };
  }
  const { input } = adapted;
  // The pipeline of the verdict is shared with the search for the changes that would change it
  // (D-228): the same function judges the founder's numbers and every change tried.
  const scenarios = scenarioAnalysis(input, tax, params);
  const judged = assess(input, tax, params, pricingOptions, {}, scenarios.conservative);
  const { projection, economics } = judged;
  const cash = {
    tax: judged.tax,
    cashFlow: judged.cashFlow,
    fxTest: fxTest(input, params, tax),
  };
  const tornado = tornadoAnalysis(input, params);
  return {
    status: 'ok',
    run: {
      engineVersion: ENGINE_VERSION,
      input,
      parameters: listEngineParams(params),
      projection,
      unitEconomics: economics.unitEconomics,
      pricing: economics.pricing,
      cash,
      scenarios,
      tornado,
      feasibility: judged.feasibility,
      confidence: judged.confidence,
      verdict: judged.verdict,
      validationPlan: validationPlan(input, tornado),
      alerts: mergeAlerts(economics.alerts, judged.tax.alerts),
    },
  };
}
