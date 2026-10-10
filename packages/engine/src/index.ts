/**
 * Version of the calculation engine, stored on every tool run (`tool_runs.engine_version`)
 * so cached outputs are recomputed when a formula changes. Formulas arrive in M4.
 */
export const ENGINE_VERSION = '0.1.0';

export { EngineError, type EngineErrorCode } from './errors';
export { divRoundHalfAwayFromZero } from './integer';
export {
  CURRENCY_EXPONENTS,
  ISO_AND_ICU_DIFFER,
  currencyExponent,
  isKnownCurrency,
  type CurrencyCode,
} from './currency';
export {
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
