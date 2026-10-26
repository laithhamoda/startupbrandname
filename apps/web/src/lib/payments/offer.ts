import { PLAN_ORDER, PLANS, upgradePrice, type PlanId } from '@/config/plans';
import type { PriceRow } from './webhook';

/** The packages a founder can buy (D-313); the course plan comes by voucher only. */
export const PURCHASABLE = ['strategist', 'commander'] as const;
export type Purchasable = (typeof PURCHASABLE)[number];

export function isPurchasable(value: string): value is Purchasable {
  return (PURCHASABLE as readonly string[]).includes(value);
}

/** The cheapest package above `current` that can be bought, or null at the top (D-320). */
export function nextPurchasable(current: PlanId): Purchasable | null {
  return PURCHASABLE.find((id) => PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(current)) ?? null;
}

/** The provider's price of each offer, per environment (D-317). */
export interface OfferPrices {
  readonly strategist: string;
  readonly commander: string;
  /** «استراتيجي» to «قائد», at the difference (D-313). */
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
 * moves up from «استراتيجي» to «قائد» (D-313). Nothing to pay for a package it already has or
 * exceeds.
 */
export function offerFor(current: PlanId, target: Purchasable, prices: OfferPrices): Offer {
  if (PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(target)) return { status: 'owned' };
  // A Strategist-level account (the package or a course voucher, D-319) moves up at the difference.
  const upgrade =
    target === 'commander' &&
    PLANS[current].entitlements.questions === PLANS.strategist.entitlements.questions;
  return {
    status: 'offer',
    planId: target,
    priceId: upgrade ? prices.upgrade : prices[target],
    priceUsd: upgrade ? upgradePrice('strategist', target) : PLANS[target].priceUsd,
    upgrade,
  };
}

/** The price rows the webhook resolves a paid price with: the upgrade sells «قائد». */
export function priceRowsOf(prices: OfferPrices): PriceRow[] {
  return [
    { plan_id: 'strategist', provider_price_id: prices.strategist },
    { plan_id: 'commander', provider_price_id: prices.commander },
    { plan_id: 'commander', provider_price_id: prices.upgrade },
  ];
}
