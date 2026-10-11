import { at } from './array';
import { buildProjectionCalendar, sumByPeriod, type ProjectionCalendar } from './calendar';
import type { CurrencyCode } from './currency';
import { EngineError } from './errors';
import {
  combineProvenance,
  makeFigure,
  type Figure,
  type InputRef,
  type Provenance,
} from './figure';
import type { EngineInput, EngineNote } from './input';
import { addMoney, makeMoney, mulMoneyByRate, subtractMoney, sumMoney, type Money } from './money';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from './params';
import {
  addRates,
  compareRates,
  multiplyRates,
  ONE_RATE,
  powRate,
  ZERO_RATE,
  type Rate,
} from './rate';
import {
  deseasonalisedPoints,
  estimateYearlyGrowth,
  unitCurve,
  yearlyGrowthRates,
  type SalesPoints,
} from './sales-curve';
import { seasonalFactors, type SeasonalFactors } from './seasonality';

/** The stable IDs of the T9 rules, listed in the inputs of the figures they produce (D-181). */
export const T9_RULES = {
  units: 'T9.units',
  growthEstimate: 'T9.growth_estimate',
  revenue: 'T9.revenue',
  cogs: 'T9.cogs',
  cogsMultiplier: 'T9.cogs_multiplier',
  grossProfit: 'T9.gross_profit',
  operatingCosts: 'T9.operating_costs',
  operatingProfit: 'T9.operating_profit',
} as const;

/**
 * What a caller can change in a run without changing the answers. `cogsMultiplier` scales COGS
 * (units times the variable cost, with inflation) by an exact rate of 0 or more: the FX test of T9
 * and the variable-cost scenarios of T10 use it. Without it, or at 1, the projection is exactly the
 * plain one.
 */
export interface ProjectionOptions {
  readonly cogsMultiplier?: Rate;
}

/**
 * One line of the projection: a value for each month, the same values summed into the calendar's
 * columns (a month in year 1, a quarter after), and where it comes from (D-181). The columns are
 * sums of the monthly values, so every table adds up (D-179).
 */
export interface ProjectionLine<T> {
  /** One value per projection month, month 1 first. Money is in minor units of the currency. */
  readonly monthly: readonly T[];
  /** One value per column of `calendar.periods`. */
  readonly byPeriod: readonly T[];
  /** The weakest source and confidence of the inputs the line used, and the inputs themselves. */
  readonly provenance: Provenance;
}

/**
 * The operating lines of T9, from the price to the operating profit before tax (D-182): units,
 * revenue, COGS, gross profit, operating costs (fixed, payroll, marketing) and operating profit.
 * Tax, cash flow, funding need and payback are not here (pull request 5).
 */
export interface OperatingProjection {
  readonly currency: CurrencyCode;
  readonly calendar: ProjectionCalendar;
  /** The seasonal factors used, from January, and whether D7 was applied. */
  readonly seasonality: SeasonalFactors;
  /** The yearly growth of each year from year 2; null for a one-year horizon. */
  readonly yearlyGrowth: Figure<readonly Rate[]> | null;
  /** Whole units sold per month, never negative and never above E7. */
  readonly units: ProjectionLine<bigint>;
  /** True for each month whose units were cut to E7's capacity. */
  readonly capped: readonly boolean[];
  /** Units times the price. The price never rises (D-185). */
  readonly revenue: ProjectionLine<Money>;
  /** Units times the variable cost, with inflation from year 2 when the caller gave a rate. */
  readonly cogs: ProjectionLine<Money>;
  /** Revenue minus COGS. */
  readonly grossProfit: ProjectionLine<Money>;
  /** F4, with inflation from year 2. */
  readonly fixedCosts: ProjectionLine<Money>;
  /** The monthly cost of the E8 staff who have started, with inflation from year 2. */
  readonly payroll: ProjectionLine<Money>;
  /** F4.1, with inflation from year 2. */
  readonly marketing: ProjectionLine<Money>;
  /** Fixed costs plus payroll plus marketing. */
  readonly operatingCosts: ProjectionLine<Money>;
  /** Gross profit minus operating costs, before tax; negative for a loss. */
  readonly operatingProfit: ProjectionLine<Money>;
  /** The adapter's notes and the ones this projection adds. */
  readonly notes: readonly EngineNote[];
}

const rule = (id: string): InputRef => ({ kind: 'rule', id });

function assertProjectCurrency(input: EngineInput): void {
  const amounts = [
    input.price.value,
    input.variableCost.value,
    input.fixedCosts.value,
    input.marketing.value,
  ];
  if (amounts.some((amount) => amount.currency !== input.currency)) {
    throw new EngineError(
      'currency_mismatch',
      `Every amount must be in ${input.currency}: the engine never converts.`,
    );
  }
}

/**
 * The growth of each year from year 2 and where it comes from (D-183, D-205): F6.2 for every year
 * when the founder gave it, otherwise the engine's estimate from the de-seasonalised levels, with
 * the year-3 share. A one-year horizon has no growth.
 */
function growthPlan(
  input: EngineInput,
  params: EngineParams,
  levels: SalesPoints,
  years: number,
): { rates: Rate[]; provenance: Provenance | null } {
  if (years === 1) return { rates: [], provenance: null };
  const given = input.yearlyGrowth.value;
  if (given !== null) {
    return { rates: yearlyGrowthRates(years, given, null), provenance: input.yearlyGrowth };
  }
  const estimate = estimateYearlyGrowth(
    levels.month6,
    levels.month12,
    params.growthFounderShare.value,
    params.growthUpperBound.value,
  );
  return {
    rates: yearlyGrowthRates(years, estimate, params.growthYear3Share.value),
    provenance: combineProvenance(
      [
        input.yearlyGrowth,
        input.sales,
        params.growthFounderShare,
        params.growthUpperBound,
        params.growthYear3Share,
      ],
      [rule(T9_RULES.growthEstimate)],
    ),
  };
}

/**
 * The operating lines of the projection (SPEC §4, T9; D-179 to D-185, D-200 to D-205): monthly for
 * year 1, quarterly after. Pure and exact: units are whole numbers (rounded half away from zero,
 * never above E7), money is whole minor units rounded on each month's line, and a quarter is the
 * sum of its months. The units follow the curve through F6's three points with D7's seasons
 * (`unitCurve`). Years 2 and later grow from the month-12 level by F6.2, or by the estimate
 * of D-183 when it is unknown (`estimateYearlyGrowth`). From year 2 the COGS and the three
 * operating costs rise by the yearly inflation of `params.inflationRate` when the caller gave one;
 * the price never rises, and without a rate nothing is inflated and a note says so (D-185).
 *
 * Each line's provenance is the weakest source and lowest confidence of the inputs it used, and
 * lists them: answer IDs, engine parameter keys and rule IDs (D-181). The optional COGS multiplier
 * (see `ProjectionOptions`) is the only change a caller can make to the formulas. Throws
 * `currency_mismatch` if an amount of the input is not in the input's currency, and
 * `invalid_param` for a negative multiplier.
 */
export function projectOperatingLines(
  input: EngineInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
  options: ProjectionOptions = {},
): OperatingProjection {
  assertProjectCurrency(input);
  const cogsMultiplier = options.cogsMultiplier ?? ONE_RATE;
  if (compareRates(cogsMultiplier, ZERO_RATE) < 0) {
    throw new EngineError('invalid_param', 'The COGS multiplier cannot be negative.');
  }
  const multiplied = compareRates(cogsMultiplier, ONE_RATE) !== 0;
  const { currency } = input;
  const calendar = buildProjectionCalendar(input.referenceDate, params.horizonMonths.value);
  const years = calendar.horizonMonths / 12;
  const notes: EngineNote[] = [...input.notes];

  // Units.
  const seasonality = seasonalFactors(input.peakMonths.value, params.seasonalPeakFactor.value);
  const levels = deseasonalisedPoints(input.sales.value, calendar, seasonality.factors);
  const growth = growthPlan(input, params, levels, years);
  const curve = unitCurve({
    calendar,
    levels,
    factors: seasonality.factors,
    yearlyGrowth: growth.rates,
    capacity: input.capacity.value,
  });
  if (seasonality.kind === 'too_many_peaks') {
    notes.push({ code: 'seasonality_ignored', questionId: 'D7' });
  }
  if (curve.capped.some(Boolean)) notes.push({ code: 'capacity_reached', questionId: 'E7' });
  const unitsProvenance = combineProvenance(
    [
      input.sales,
      input.peakMonths,
      input.capacity,
      ...(growth.provenance === null ? [] : [growth.provenance]),
      ...(seasonality.kind === 'applied' ? [params.seasonalPeakFactor] : []),
    ],
    [rule(T9_RULES.units)],
  );

  // Inflation of COGS and operating costs from year 2 (D-185): a factor for each year.
  const inflation = params.inflationRate;
  const inflationRate = inflation.value;
  const inflate = years > 1 && inflationRate !== null;
  if (years > 1 && !inflate) notes.push({ code: 'inflation_not_applied' });
  const yearFactors = Array.from({ length: years }, (_, year) =>
    inflate ? powRate(addRates(ONE_RATE, inflationRate), year) : ONE_RATE,
  );
  // COGS is rounded once, with the inflation and the multiplier together.
  const cogsFactors = yearFactors.map((factor) => multiplyRates(factor, cogsMultiplier));
  const withInflation = (...provenances: Provenance[]): Provenance[] =>
    inflate ? [...provenances, inflation] : provenances;

  // The monthly lines.
  const price = input.price.value.minor;
  const variableCost = input.variableCost.value.minor;
  const revenue: Money[] = [];
  const cogs: Money[] = [];
  const fixed: Money[] = [];
  const payroll: Money[] = [];
  const marketing: Money[] = [];
  const grossProfit: Money[] = [];
  const operatingCosts: Money[] = [];
  const operatingProfit: Money[] = [];
  calendar.months.forEach((month, index) => {
    const units = at(curve.units, index);
    const factor = at(yearFactors, month.year - 1);
    const cogsFactor = at(cogsFactors, month.year - 1);
    const staff = sumMoney(
      currency,
      input.staff.value
        .filter((member) => member.startMonth <= month.index)
        .map((member) => member.monthlyCost),
    );
    const monthRevenue = makeMoney(units * price, currency);
    const monthCogs = mulMoneyByRate(makeMoney(units * variableCost, currency), cogsFactor);
    const monthFixed = mulMoneyByRate(input.fixedCosts.value, factor);
    const monthPayroll = mulMoneyByRate(staff, factor);
    const monthMarketing = mulMoneyByRate(input.marketing.value, factor);
    const monthGross = subtractMoney(monthRevenue, monthCogs);
    const monthCosts = addMoney(addMoney(monthFixed, monthPayroll), monthMarketing);
    revenue.push(monthRevenue);
    cogs.push(monthCogs);
    fixed.push(monthFixed);
    payroll.push(monthPayroll);
    marketing.push(monthMarketing);
    grossProfit.push(monthGross);
    operatingCosts.push(monthCosts);
    operatingProfit.push(subtractMoney(monthGross, monthCosts));
  });

  // Provenance of each line: the inputs it used (D-181).
  const revenueProvenance = combineProvenance(
    [unitsProvenance, input.price],
    [rule(T9_RULES.revenue)],
  );
  const cogsProvenance = combineProvenance(
    withInflation(unitsProvenance, input.variableCost),
    multiplied ? [rule(T9_RULES.cogs), rule(T9_RULES.cogsMultiplier)] : [rule(T9_RULES.cogs)],
  );
  const grossProvenance = combineProvenance(
    [revenueProvenance, cogsProvenance],
    [rule(T9_RULES.grossProfit)],
  );
  const fixedProvenance = combineProvenance(withInflation(input.fixedCosts));
  const payrollProvenance = combineProvenance(withInflation(input.staff));
  const marketingProvenance = combineProvenance(withInflation(input.marketing));
  const costsProvenance = combineProvenance(
    [fixedProvenance, payrollProvenance, marketingProvenance],
    [rule(T9_RULES.operatingCosts)],
  );
  const profitProvenance = combineProvenance(
    [grossProvenance, costsProvenance],
    [rule(T9_RULES.operatingProfit)],
  );

  const line = (monthly: Money[], provenance: Provenance): ProjectionLine<Money> => ({
    monthly,
    byPeriod: sumByPeriod(calendar, monthly, currency),
    provenance,
  });
  return {
    currency,
    calendar,
    seasonality,
    yearlyGrowth:
      growth.provenance === null
        ? null
        : makeFigure<readonly Rate[]>(growth.rates, growth.provenance),
    units: {
      monthly: curve.units,
      byPeriod: calendar.periods.map((period) =>
        curve.units.slice(period.firstMonth - 1, period.lastMonth).reduce((a, b) => a + b, 0n),
      ),
      provenance: unitsProvenance,
    },
    capped: curve.capped,
    revenue: line(revenue, revenueProvenance),
    cogs: line(cogs, cogsProvenance),
    grossProfit: line(grossProfit, grossProvenance),
    fixedCosts: line(fixed, fixedProvenance),
    payroll: line(payroll, payrollProvenance),
    marketing: line(marketing, marketingProvenance),
    operatingCosts: line(operatingCosts, costsProvenance),
    operatingProfit: line(operatingProfit, profitProvenance),
    notes,
  };
}
