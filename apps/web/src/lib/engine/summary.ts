import {
  type EngineRun,
  moneyToMajorString,
  type Money,
  rateToDecimalString,
  type Rate,
  sumMoney,
} from '@sbn/engine';
import type { Json } from '@/lib/supabase/database.types';

/**
 * The first twelve months of a line of the projection, as a decimal string in major units. The
 * run is not stored whole (about 100 KB, D-238): this compact summary is, and the run itself is
 * recomputed from the inputs when it is needed.
 */
function yearOne(run: EngineRun, monthly: readonly Money[]): string {
  return moneyToMajorString(sumMoney(run.input.currency, monthly.slice(0, 12)));
}

const money = (value: Money | null): string | null =>
  value === null ? null : moneyToMajorString(value);
const rate = (value: Rate | null): string | null =>
  value === null ? null : rateToDecimalString(value, 4);

/**
 * The compact summary of a run that `record_engine_run` stores (D-238, D-251): the engine version,
 * the verdict with its blockers and hold-backs, the score and the overall confidence, the
 * headline numbers as decimal strings in major units (a month is a number, "not within the
 * horizon" is null), and the alert codes. Every number is the engine's; none is written here
 * (CLAUDE.md rule 1). A headline the project cannot support, such as a break-even with no positive
 * margin, is null.
 */
export function summaryOf(run: EngineRun): Json {
  const { unitEconomics, cash } = run;
  const economics = unitEconomics.status === 'ok' ? unitEconomics : null;
  const cashFlow = cash.cashFlow.status === 'ok' ? cash.cashFlow : null;
  return {
    engineVersion: run.engineVersion,
    status: 'ok',
    verdict: {
      value: run.verdict.verdict.value,
      blockers: run.verdict.blockers.map((blocker) => blocker.code),
      holdBacks: [...run.verdict.holdBacks],
    },
    score: {
      passed: run.feasibility.passed,
      evaluated: run.feasibility.evaluated,
      rate: rate(run.feasibility.score?.value ?? null),
    },
    confidence: run.confidence.level.value,
    headline: {
      currency: run.input.currency,
      revenueYear1: yearOne(run, run.projection.revenue.monthly),
      profitYear1: yearOne(run, run.projection.operatingProfit.monthly),
      fixedCostsMonthly: money(run.input.fixedCosts.value),
      variableCostPerUnit: money(run.input.variableCost.value),
      setupCosts: money(run.input.setupCosts?.value ?? null),
      contributionMargin: money(unitEconomics.contributionMargin.value),
      contributionMarginRate: rate(unitEconomics.contributionMarginRate?.value ?? null),
      breakEvenUnits: economics ? economics.breakEvenUnits.value.toString() : null,
      breakEvenRevenue: money(economics?.breakEvenRevenue.value ?? null),
      breakEvenMonth: economics?.breakEvenMonth.value ?? null,
      fundingNeed: money(cashFlow?.fundingNeed.value ?? null),
      payback: cashFlow?.payback.value ?? null,
    },
    alerts: [...new Set(run.alerts.map((alert) => alert.code))],
  };
}
