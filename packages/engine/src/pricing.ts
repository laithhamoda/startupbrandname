import { EngineError } from './errors';
import { combineFigures, type Figure } from './figure';
import type { EngineInput } from './input';
import { divRoundHalfAwayFromZero, medianBigInt } from './integer';
import { makeMoney, sumMoney, type Money } from './money';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from './params';
import type { OperatingProjection } from './projection';

/** The stable IDs of the T7 rules, listed in the inputs of the figures they produce (D-181). */
export const T7_RULES = {
  floor: 'T7.floor',
  band: 'T7.band',
  penetration: 'T7.penetration',
  market: 'T7.market',
  premium: 'T7.premium',
  /** Rule R5 of the question bank: D5 names a measurable difference. The caller runs it. */
  differenceCheck: 'R5',
} as const;

/** Why a price position is missing: no unit is sold in year 1, or no competitor price is known. */
export type PricingGap = 'no_units' | 'no_competitor_prices';

/** The lowest, middle and highest known competitor price (D4), in the project currency. */
export interface PriceBand {
  readonly min: Money;
  readonly median: Money;
  readonly max: Money;
}

/** What the caller knows that the answers alone do not say. */
export interface PricingOptions {
  /** True when the founder's D5 answer passed rule R5 (a measurable difference). Default false. */
  readonly premiumAllowed?: boolean;
}

/**
 * T7: the price positions the report shows next to F1 (SPEC §4; D-189, D-209). A position that
 * cannot be computed is `null` and `gaps` says why; nothing is filled in with a guess.
 */
export interface Pricing {
  /** VC + average monthly fixed cost / average monthly units of months 1 to 12; null with no units. */
  readonly floor: Figure<Money> | null;
  /** The minimum, median and maximum of the known D4 prices. */
  readonly band: Figure<PriceBand> | null;
  /** max(floor x the penetration factor, the cheapest D4 price). */
  readonly penetration: Figure<Money> | null;
  /** The median of the known D4 prices. */
  readonly market: Figure<Money> | null;
  /** Whether the caller said D5 passed R5. */
  readonly premiumAllowed: boolean;
  /** The top of the band: the most a competitor is known to charge. Only when `premiumAllowed`. */
  readonly premium: Figure<Money> | null;
  readonly gaps: readonly PricingGap[];
}

/**
 * T7: the floor, the competitor band, the penetration and market prices, and the premium when the
 * caller allows it. Pure and exact. The floor is
 * `VC + (sum of the fixed costs of months 1 to 12) / (sum of the units of months 1 to 12)`, which
 * equals VC plus the ratio of the two averages; the fixed cost is the full one of D-182 (F4,
 * payroll and marketing), and the quotient is rounded once, half away from zero. The penetration
 * price is `max(floor x penetrationFloorFactor, min(D4))`, taken from the exact floor and rounded once
 * the same way. Competitors whose
 * price is unknown are skipped; the adapter has already refused prices in another currency (D-200),
 * and this function throws `currency_mismatch` if one is handed in anyway, or if the projection
 * was made in another currency than the input.
 */
export function pricing(
  input: EngineInput,
  projection: OperatingProjection,
  options: PricingOptions = {},
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): Pricing {
  const { currency } = input;
  if (projection.currency !== currency) {
    throw new EngineError('currency_mismatch', 'The projection and the input differ in currency.');
  }
  const premiumAllowed = options.premiumAllowed === true;
  const gaps: PricingGap[] = [];

  // The floor.
  const yearOneCosts = sumMoney(currency, projection.operatingCosts.monthly.slice(0, 12));
  const yearOneUnits = projection.units.monthly.slice(0, 12).reduce((a, b) => a + b, 0n);
  let floor: Figure<Money> | null = null;
  // The exact floor is exactFloor / yearOneUnits minor units; the penetration price starts from it,
  // not from the rounded floor, so that it is rounded once.
  let exactFloor = 0n;
  if (yearOneUnits === 0n) {
    gaps.push('no_units');
  } else {
    exactFloor = input.variableCost.value.minor * yearOneUnits + yearOneCosts.minor;
    floor = combineFigures(
      makeMoney(divRoundHalfAwayFromZero(exactFloor, yearOneUnits), currency),
      [input.variableCost, projection.operatingCosts.provenance, projection.units.provenance],
      [{ kind: 'rule', id: T7_RULES.floor }],
    );
  }

  // The band, market and penetration prices, from the known D4 prices.
  const competitors = input.competitorPrices;
  const known: bigint[] = [];
  for (const competitor of competitors?.value ?? []) {
    if (competitor.price === null) continue;
    if (competitor.price.currency !== currency) {
      throw new EngineError(
        'currency_mismatch',
        'A competitor price is not in the project currency.',
      );
    }
    known.push(competitor.price.minor);
  }
  if (competitors === null || known.length === 0) {
    gaps.push('no_competitor_prices');
    return {
      floor,
      band: null,
      penetration: null,
      market: null,
      premiumAllowed,
      premium: null,
      gaps,
    };
  }
  const lowest = known.reduce((a, b) => (b < a ? b : a));
  const highest = known.reduce((a, b) => (b > a ? b : a));
  const median = medianBigInt(known);
  const band = combineFigures<PriceBand>(
    {
      min: makeMoney(lowest, currency),
      median: makeMoney(median, currency),
      max: makeMoney(highest, currency),
    },
    [competitors],
    [{ kind: 'rule', id: T7_RULES.band }],
  );
  const market = combineFigures(
    makeMoney(median, currency),
    [competitors],
    [{ kind: 'rule', id: T7_RULES.market }],
  );
  let penetration: Figure<Money> | null = null;
  if (floor !== null) {
    const factor = params.penetrationFloorFactor.value;
    const lifted = divRoundHalfAwayFromZero(exactFloor * factor.num, yearOneUnits * factor.den);
    penetration = combineFigures(
      makeMoney(lifted > lowest ? lifted : lowest, currency),
      [floor, competitors, params.penetrationFloorFactor],
      [{ kind: 'rule', id: T7_RULES.penetration }],
    );
  }
  const premium = premiumAllowed
    ? combineFigures(
        band.value.max,
        [band],
        [
          { kind: 'rule', id: T7_RULES.premium },
          { kind: 'rule', id: T7_RULES.differenceCheck },
        ],
      )
    : null;
  return { floor, band, penetration, market, premiumAllowed, premium, gaps };
}
