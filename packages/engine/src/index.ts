/**
 * Version of the calculation engine, stored on every tool run (`tool_runs.engine_version`)
 * so cached outputs are recomputed when a formula changes. Formulas arrive in M4.
 */
export const ENGINE_VERSION = '0.1.0';

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
  type Figure,
  type FigureConfidence,
  type FigureSource,
  type InputRef,
  type Provenance,
  type StoredAnswer,
} from './figure';
export {
  DEFAULT_ENGINE_PARAMS,
  PARAM_KEYS,
  PAYMENT_OPTIONS,
  createEngineParams,
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
  projectOperatingLines,
  type OperatingProjection,
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
