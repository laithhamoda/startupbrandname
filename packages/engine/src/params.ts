import { EngineError } from './errors';
import { gcdBigInt } from './integer';
import { defaultFigure, type Figure } from './figure';
import {
  compareRates,
  makeRate,
  ONE_RATE,
  parseRate,
  ZERO_RATE,
  addRates,
  type Rate,
} from './rate';

/**
 * How a customer pays (F7). The values are the option IDs of question F7 in the question bank;
 * the adapter (pull request 3) maps the stored answer to one of them.
 */
export type PaymentOption = 'cash' | 'credit' | 'instalments' | 'deposit';

/** Every payment option, in the order F7 offers them. */
export const PAYMENT_OPTIONS: readonly PaymentOption[] = [
  'cash',
  'credit',
  'instalments',
  'deposit',
];

/**
 * One part of the cash from a sale: `share` of the sale's amount arrives `delayMonths` after the
 * month of the sale (0 is the same month). The shares of an option add up to exactly 1.
 */
export interface PaymentPart {
  readonly delayMonths: number;
  readonly share: Rate;
}

/** The stable key of each engine default, used as the `default` input of a figure (D-195). */
export const PARAM_KEYS = {
  horizonMonths: 'engine.horizon_months',
  growthUpperBound: 'growth.upper_bound_yearly',
  growthFounderShare: 'growth.founder_share',
  growthYear3Share: 'growth.year3_share_of_year2',
  seasonalPeakFactor: 'seasonality.peak_factor',
  paymentCash: 'payment.cash',
  paymentCredit: 'payment.credit',
  paymentInstalments: 'payment.instalments',
  paymentDeposit: 'payment.deposit',
  inflationRate: 'inflation.yearly',
  conservativeSalesFactor: 'scenario.conservative.sales_factor',
  optimisticSalesFactor: 'scenario.optimistic.sales_factor',
  conservativeVcFactor: 'scenario.conservative.vc_factor',
  optimisticVcFactor: 'scenario.optimistic.vc_factor',
  conservativeLaunchDelayMonths: 'scenario.conservative.launch_delay_months',
  penetrationFloorFactor: 'pricing.penetration_floor_factor',
  ltvCacMinimum: 'unit_economics.ltv_cac_minimum',
} as const;

/**
 * Every default the engine assumes, each a figure with source `assumption` and a stable key
 * (D-181, D-195), so the report can list them and a caller can override any of them. Rates are
 * exact and unitless. None is a legal, tax or market value (CLAUDE.md rule 8).
 */
export interface EngineParams {
  /** Length of the projection in months: a multiple of 12 (D-188). Default 36. Unit: months. */
  readonly horizonMonths: Figure<number>;
  /** Upper bound of the engine's own yearly growth estimate (D-183). Default 25% a year. */
  readonly growthUpperBound: Figure<Rate>;
  /** Share of the founder's own month-6-to-12 growth the estimate keeps (D-183). Default 1/2. */
  readonly growthFounderShare: Figure<Rate>;
  /** Year 3 grows by this share of year 2's yearly rate (D-183). Default 1/2. */
  readonly growthYear3Share: Figure<Rate>;
  /** Seasonal factor of a peak month when D7 is seasonal (D-184). Default 3/2. */
  readonly seasonalPeakFactor: Figure<Rate>;
  /** When the cash of a sale arrives, per F7 option (D-187). */
  readonly paymentTiming: Readonly<Record<PaymentOption, Figure<readonly PaymentPart[]>>>;
  /**
   * Yearly inflation of COGS and fixed costs from year 2 (D-185). `null` means none is applied:
   * the default, until a caller passes a verified external value with its source and date.
   */
  readonly inflationRate: Figure<Rate | null>;
  /** T10 conservative sales multiplier (SPEC §4). Default 0.6. */
  readonly conservativeSalesFactor: Figure<Rate>;
  /** T10 optimistic sales multiplier (SPEC §4). Default 1.3. */
  readonly optimisticSalesFactor: Figure<Rate>;
  /** T10 conservative variable-cost multiplier (SPEC §4). Default 1.1. */
  readonly conservativeVcFactor: Figure<Rate>;
  /** T10 optimistic variable-cost multiplier (SPEC §4). Default 0.95. */
  readonly optimisticVcFactor: Figure<Rate>;
  /** T10 conservative launch delay (D-189). Default 3. Unit: months. */
  readonly conservativeLaunchDelayMonths: Figure<number>;
  /** T7 penetration price is at least the floor times this (SPEC §4, D-206). Default 1.1. */
  readonly penetrationFloorFactor: Figure<Rate>;
  /** T8 alert when LTV / CAC is below this (SPEC §4). Default 3. */
  readonly ltvCacMinimum: Figure<Rate>;
}

/**
 * Replacements for engine defaults. Each is a whole figure, so an override carries its own
 * provenance (a verified inflation rate is `external`, a value the founder set is `user`).
 */
export type EngineParamOverrides = Partial<Omit<EngineParams, 'paymentTiming'>> & {
  readonly paymentTiming?: Partial<EngineParams['paymentTiming']>;
};

function rate(text: string): Rate {
  return parseRate(text);
}

function timing(...parts: readonly [number, Rate][]): readonly PaymentPart[] {
  return parts.map(([delayMonths, share]) => ({ delayMonths, share }));
}

function defaultParams(): EngineParams {
  const third = makeRate(1n, 3n);
  const half = makeRate(1n, 2n);
  return {
    horizonMonths: defaultFigure(PARAM_KEYS.horizonMonths, 36),
    growthUpperBound: defaultFigure(PARAM_KEYS.growthUpperBound, rate('0.25')),
    growthFounderShare: defaultFigure(PARAM_KEYS.growthFounderShare, half),
    growthYear3Share: defaultFigure(PARAM_KEYS.growthYear3Share, half),
    seasonalPeakFactor: defaultFigure(PARAM_KEYS.seasonalPeakFactor, rate('1.5')),
    paymentTiming: {
      cash: defaultFigure(PARAM_KEYS.paymentCash, timing([0, ONE_RATE])),
      credit: defaultFigure(PARAM_KEYS.paymentCredit, timing([1, ONE_RATE])),
      instalments: defaultFigure(
        PARAM_KEYS.paymentInstalments,
        timing([0, third], [1, third], [2, third]),
      ),
      deposit: defaultFigure(PARAM_KEYS.paymentDeposit, timing([0, half], [1, half])),
    },
    inflationRate: defaultFigure<Rate | null>(PARAM_KEYS.inflationRate, null),
    conservativeSalesFactor: defaultFigure(PARAM_KEYS.conservativeSalesFactor, rate('0.6')),
    optimisticSalesFactor: defaultFigure(PARAM_KEYS.optimisticSalesFactor, rate('1.3')),
    conservativeVcFactor: defaultFigure(PARAM_KEYS.conservativeVcFactor, rate('1.1')),
    optimisticVcFactor: defaultFigure(PARAM_KEYS.optimisticVcFactor, rate('0.95')),
    conservativeLaunchDelayMonths: defaultFigure(PARAM_KEYS.conservativeLaunchDelayMonths, 3),
    penetrationFloorFactor: defaultFigure(PARAM_KEYS.penetrationFloorFactor, rate('1.1')),
    ltvCacMinimum: defaultFigure(PARAM_KEYS.ltvCacMinimum, rate('3')),
  };
}

function ensure(ok: boolean, key: string, rule: string): void {
  if (!ok) throw new EngineError('invalid_param', `Engine parameter ${key} ${rule}.`);
}

function requireMonths(key: string, months: number, min: number): void {
  ensure(
    Number.isSafeInteger(months) && months >= min && months <= 120,
    key,
    `must be a whole number of months from ${String(min)} to 120`,
  );
}

/**
 * A rate must come from `makeRate`: bigints in lowest terms with a positive denominator. A
 * hand-built `{ num: 2n, den: -4n }` would order wrongly in `compareRates`.
 */
function requireRate(key: string, value: Rate): void {
  ensure(
    typeof value.num === 'bigint' &&
      typeof value.den === 'bigint' &&
      value.den > 0n &&
      gcdBigInt(value.num, value.den) === 1n,
    key,
    'must be a rate built with makeRate (bigints in lowest terms, positive denominator)',
  );
}

function requireShare(key: string, value: Rate): void {
  ensure(
    compareRates(value, ZERO_RATE) >= 0 && compareRates(value, ONE_RATE) <= 0,
    key,
    'must be between 0 and 1',
  );
}

function requirePositive(key: string, value: Rate): void {
  ensure(compareRates(value, ZERO_RATE) > 0, key, 'must be greater than 0');
}

function requireTiming(key: string, parts: readonly PaymentPart[]): void {
  ensure(parts.length > 0, key, 'needs at least one part');
  for (const part of parts) requireRate(key, part.share);
  ensure(
    parts.every(
      (part) =>
        Number.isSafeInteger(part.delayMonths) &&
        part.delayMonths >= 0 &&
        part.delayMonths <= 36 &&
        compareRates(part.share, ZERO_RATE) >= 0,
    ),
    key,
    'needs whole delays of 0 to 36 months and shares of 0 or more',
  );
  const total = parts.reduce((sum, part) => addRates(sum, part.share), ZERO_RATE);
  ensure(compareRates(total, ONE_RATE) === 0, key, 'must have shares that add up to exactly 1');
}

function validate(params: EngineParams): void {
  for (const [key, figure] of [
    [PARAM_KEYS.growthUpperBound, params.growthUpperBound],
    [PARAM_KEYS.growthFounderShare, params.growthFounderShare],
    [PARAM_KEYS.growthYear3Share, params.growthYear3Share],
    [PARAM_KEYS.seasonalPeakFactor, params.seasonalPeakFactor],
    [PARAM_KEYS.conservativeSalesFactor, params.conservativeSalesFactor],
    [PARAM_KEYS.optimisticSalesFactor, params.optimisticSalesFactor],
    [PARAM_KEYS.conservativeVcFactor, params.conservativeVcFactor],
    [PARAM_KEYS.optimisticVcFactor, params.optimisticVcFactor],
    [PARAM_KEYS.penetrationFloorFactor, params.penetrationFloorFactor],
    [PARAM_KEYS.ltvCacMinimum, params.ltvCacMinimum],
  ] as const) {
    requireRate(key, figure.value);
  }
  if (params.inflationRate.value !== null) {
    requireRate(PARAM_KEYS.inflationRate, params.inflationRate.value);
  }
  requireMonths(PARAM_KEYS.horizonMonths, params.horizonMonths.value, 12);
  ensure(
    params.horizonMonths.value % 12 === 0,
    PARAM_KEYS.horizonMonths,
    'must be a multiple of 12',
  );
  ensure(
    compareRates(params.growthUpperBound.value, ZERO_RATE) >= 0,
    PARAM_KEYS.growthUpperBound,
    'must not be negative',
  );
  requireShare(PARAM_KEYS.growthFounderShare, params.growthFounderShare.value);
  requireShare(PARAM_KEYS.growthYear3Share, params.growthYear3Share.value);
  ensure(
    compareRates(params.seasonalPeakFactor.value, ONE_RATE) >= 0,
    PARAM_KEYS.seasonalPeakFactor,
    'must be at least 1',
  );
  requireTiming(PARAM_KEYS.paymentCash, params.paymentTiming.cash.value);
  requireTiming(PARAM_KEYS.paymentCredit, params.paymentTiming.credit.value);
  requireTiming(PARAM_KEYS.paymentInstalments, params.paymentTiming.instalments.value);
  requireTiming(PARAM_KEYS.paymentDeposit, params.paymentTiming.deposit.value);
  const inflation = params.inflationRate.value;
  ensure(
    inflation === null || compareRates(inflation, makeRate(-1n, 1n)) > 0,
    PARAM_KEYS.inflationRate,
    'must be greater than -1',
  );
  requirePositive(PARAM_KEYS.conservativeSalesFactor, params.conservativeSalesFactor.value);
  requirePositive(PARAM_KEYS.optimisticSalesFactor, params.optimisticSalesFactor.value);
  requirePositive(PARAM_KEYS.conservativeVcFactor, params.conservativeVcFactor.value);
  requirePositive(PARAM_KEYS.optimisticVcFactor, params.optimisticVcFactor.value);
  ensure(
    compareRates(params.penetrationFloorFactor.value, ONE_RATE) >= 0,
    PARAM_KEYS.penetrationFloorFactor,
    'must be at least 1',
  );
  requirePositive(PARAM_KEYS.ltvCacMinimum, params.ltvCacMinimum.value);
  requireMonths(
    PARAM_KEYS.conservativeLaunchDelayMonths,
    params.conservativeLaunchDelayMonths.value,
    0,
  );
}

/**
 * The engine's parameters: the documented defaults with the caller's overrides applied and
 * checked. Throws `invalid_param` naming the key when a value is out of its range (a horizon that
 * is not a multiple of 12, a payment timing whose shares do not add up to 1, a negative growth
 * bound, and so on). Pure: the same overrides give the same parameters.
 */
export function createEngineParams(overrides: EngineParamOverrides = {}): EngineParams {
  const defaults = defaultParams();
  const { paymentTiming, ...rest } = overrides;
  requireKnownKeys(rest, Object.keys(defaults), 'override');
  requireKnownKeys(paymentTiming ?? {}, PAYMENT_OPTIONS, 'paymentTiming override');
  const params: EngineParams = {
    ...defaults,
    ...stripUndefined(rest),
    paymentTiming: { ...defaults.paymentTiming, ...stripUndefined(paymentTiming ?? {}) },
  };
  validate(params);
  return params;
}

/** Untyped input (JSON) can carry a misspelt key; a silent no-op would keep a default unnoticed. */
function requireKnownKeys(given: object, known: readonly string[], what: string): void {
  for (const key of Object.keys(given)) {
    ensure(known.includes(key), key, `is not a known ${what}`);
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

/** Freezes an object and everything inside it, so a shared constant cannot be changed in place. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}

/**
 * The default parameters, deeply frozen so no caller can change the defaults every run shares.
 * Callers that need a change use `createEngineParams`, which returns fresh objects.
 */
export const DEFAULT_ENGINE_PARAMS: EngineParams = deepFreeze(createEngineParams());

/**
 * Every parameter as a figure, in a fixed order, for the report's list of assumptions and for the
 * hash of a run's settings. The key of each is `figure.inputs[0].id` when it is still a default.
 */
export function listEngineParams(params: EngineParams): readonly Figure<unknown>[] {
  return [
    params.horizonMonths,
    params.growthUpperBound,
    params.growthFounderShare,
    params.growthYear3Share,
    params.seasonalPeakFactor,
    params.paymentTiming.cash,
    params.paymentTiming.credit,
    params.paymentTiming.instalments,
    params.paymentTiming.deposit,
    params.inflationRate,
    params.conservativeSalesFactor,
    params.optimisticSalesFactor,
    params.conservativeVcFactor,
    params.optimisticVcFactor,
    params.conservativeLaunchDelayMonths,
    params.penetrationFloorFactor,
    params.ltvCacMinimum,
  ];
}
