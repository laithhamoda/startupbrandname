export { ENGINE_VERSION } from './version';
export { EngineError, type EngineErrorCode } from './errors';
export { divCeil, divRoundHalfAwayFromZero, medianBigInt } from './integer';
export {
  CURRENCY_EXPONENTS,
  ISO_AND_ICU_DIFFER,
  currencyExponent,
  isKnownCurrency,
  type CurrencyCode,
} from './currency';
export {
  MAX_POWER_DIGITS,
  ONE_RATE,
  ZERO_RATE,
  addRates,
  compareRates,
  divideRates,
  makeRate,
  multiplyRates,
  negateRate,
  parsePercent,
  parseRate,
  powRate,
  rateFromNumber,
  rateFromPercent,
  rateToDecimalString,
  rateToPercentString,
  subtractRates,
  type Rate,
} from './rate';
export {
  addMoney,
  compareMoney,
  makeMoney,
  maxMoney,
  minMoney,
  moneyFromMajor,
  moneyFromMajorString,
  moneyFromSafeMinor,
  moneyToMajorString,
  moneyToSafeMinor,
  mulMoneyByRate,
  negateMoney,
  subtractMoney,
  sumMoney,
  zeroMoney,
  type Money,
} from './money';
export {
  combineFigures,
  combineProvenance,
  defaultFigure,
  figureFromAnswer,
  makeFigure,
  missingProvenance,
  type Figure,
  type FigureConfidence,
  type FigureSource,
  type InputRef,
  type Provenance,
  type StoredAnswer,
} from './figure';
export {
  DEFAULT_ENGINE_PARAMS,
  CHANGE_PARAM_KEYS,
  PARAM_KEYS,
  PAYMENT_OPTIONS,
  createEngineParams,
  listChangeParams,
  listEngineParams,
  type EngineParamOverrides,
  type EngineParams,
  type PaymentOption,
  type PaymentPart,
} from './params';
export {
  addMonths,
  buildProjectionCalendar,
  referenceMonth,
  sumByPeriod,
  type CalendarMonth,
  type ProjectionCalendar,
  type ProjectionMonth,
  type ProjectionPeriod,
} from './calendar';
export { ROOT_RESOLUTION, ROOT_RESOLUTION_DIGITS, nthRootFloor, rateRoot } from './root';
export { seasonalFactors, type SeasonalFactors, type SeasonalityKind } from './seasonality';
export {
  deseasonalisedPoints,
  estimateYearlyGrowth,
  interpolateLevels,
  unitCurve,
  yearlyGrowthRates,
  type SalesPoints,
  type UnitCurve,
} from './sales-curve';
export {
  FINANCING_SOURCES,
  PRICE_FROM_D4_RULE,
  engineInputFrom,
  type CapitalRange,
  type CompetitorPrice,
  type EngineInput,
  type EngineInputResult,
  type EngineNote,
  type LegalForm,
  type MonthLimit,
  type NotCalculableReason,
  type ProjectContext,
  type ProvenanceBySteps,
  type StaffMember,
  type StoredProvenance,
} from './input';
export {
  T9_RULES,
  firstProfitableMonth,
  projectOperatingLines,
  type OperatingProjection,
  type ProjectionAdjustments,
  type ProjectionLine,
  type ProjectionOptions,
} from './projection';
export {
  ALERT_SEVERITY,
  economicsAlerts,
  type Alert,
  type AlertCode,
  type AlertSeverity,
  type AlertValue,
} from './alerts';
export {
  T8_RULES,
  unitEconomics,
  type BlockedUnitEconomics,
  type OkUnitEconomics,
  type SubscriptionEconomics,
  type SubscriptionGap,
  type UnitEconomics,
} from './unit-economics';
export {
  T7_RULES,
  pricing,
  type PriceBand,
  type Pricing,
  type PricingGap,
  type PricingOptions,
} from './pricing';
export { analyseEconomics, type EconomicsAnalysis } from './economics';
export {
  TAX_ALERT_SEVERITY,
  TAX_RULES,
  taxAnalysis,
  taxDue,
  validateTaxRule,
  type CalculatedTax,
  type TaxAlert,
  type TaxAlertCode,
  type TaxAnalysis,
  type TaxBasis,
  type TaxBracket,
  type TaxCharge,
  type TaxContext,
  type TaxDue,
  type TaxGap,
  type TaxKind,
  type TaxRule,
  type TaxRuleStatus,
  type TaxYear,
  type UncalculatedTax,
} from './tax';
export {
  CASH_FLOW_RULES,
  cashFlow,
  type BlockedCashFlow,
  type CashFlow,
  type CashFlowNote,
  type OkCashFlow,
} from './cash-flow';
export { FX_RULES, fxTest, type FxShockResult, type FxTest } from './fx-test';
export { analyseCash, type CashAnalysis } from './cash';
export {
  T10_RULES,
  scenarioAnalysis,
  tornadoAnalysis,
  type ScenarioFunding,
  type ScenarioKind,
  type ScenarioResult,
  type Scenarios,
  type Tornado,
  type TornadoRow,
  type TornadoVariable,
} from './scenarios';
export {
  CRITERION_IDS,
  FEASIBILITY_RULES,
  feasibility,
  feasibilityCriteria,
  scoreCriteria,
  type Criterion,
  type CriterionId,
  type CriterionStatus,
  type Feasibility,
  type FeasibilityNote,
  type NotEvaluatedReason,
} from './feasibility';
export {
  CONFIDENCE_RULES,
  PIVOTAL_IDS,
  overallConfidence,
  type OverallConfidence,
  type PivotalFigure,
  type PivotalId,
} from './confidence';
export {
  VERDICT_RULES,
  blockersOf,
  verdictOf,
  type Blocker,
  type BlockerCode,
  type HoldBack,
  type Verdict,
  type VerdictResult,
} from './verdict';
export {
  EXPERIMENT_LIBRARY,
  PLAN_SIZE,
  T18_RULES,
  validationPlan,
  type ConfidenceScore,
  type CostClass,
  type Experiment,
  type ExperimentKey,
  type PlanCandidate,
  type ValidationEntry,
  type ValidationPlan,
} from './validation-plan';
export {
  CHANGE_LEVERS,
  CHANGE_RULES,
  suggestChanges,
  type Change,
  type ChangeLever,
  type ChangeOutcome,
  type GoBlocker,
  type LeverShift,
  type RethinkItem,
  type SuggestedChanges,
} from './changes';
export { mergeAlerts, runEngine, type EngineRun, type EngineRunResult, type RunAlert } from './run';
export { canonicalJson, serialiseRun } from './serialise';
export { GOLDEN_PROJECTS, runGolden, type GoldenName, type GoldenProject } from './golden-projects';
