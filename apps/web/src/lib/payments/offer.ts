import { PLAN_ORDER, PLANS, upgradePrice, type PlanId } from '@/config/plans';
import type { PriceRow } from './webhook';

/** The packages a founder can buy (D-313); the course plan comes by voucher only. */
export const PURCHASABLE = ['standard', 'adventurer'] as const;
export type Purchasable = (typeof PURCHASABLE)[number];

export function isPurchasable(value: string): value is Purchasable {
  return (PURCHASABLE as readonly string[]).includes(value);
}

/** The provider's price of each offer, per environment (D-317). */
export interface OfferPrices {
  readonly standard: string;
  readonly adventurer: string;
  /** «متردد» to «المغامر», at the difference (D-313). */
  readonly upgrade: string;
}

export type Offer =
  | {
      readonly status: 'offer';
      readonly planId: Purchasable;
      readonly priceId: string;
      readonly priceUsd: number;
      readonly upgrade: boolean;
    }
  /** The account already has this package or a better one. */
  | { readonly status: 'owned' };

/**
 * What an account with `current` pays for `target`: the full price, or the difference when it
 * moves up from «متردد» to «المغامر» (D-313). Nothing to pay for a package it already has or
 * exceeds.
 */
export function offerFor(current: PlanId, target: Purchasable, prices: OfferPrices): Offer {
  if (PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(target)) return { status: 'owned' };
  const upgrade = current === 'standard' && target === 'adventurer';
  return {
    status: 'offer',
    planId: target,
    priceId: upgrade ? prices.upgrade : prices[target],
    priceUsd: upgrade ? upgradePrice(current, target) : PLANS[target].priceUsd,
    upgrade,
  };
}

/** The price rows the webhook resolves a paid price with: the upgrade sells «المغامر». */
export function priceRowsOf(prices: OfferPrices): PriceRow[] {
  return [
    { plan_id: 'standard', provider_price_id: prices.standard },
    { plan_id: 'adventurer', provider_price_id: prices.adventurer },
    { plan_id: 'adventurer', provider_price_id: prices.upgrade },
  ];
}
