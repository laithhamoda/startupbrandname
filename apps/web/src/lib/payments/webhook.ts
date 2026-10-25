import 'server-only';
import {
  WebhookError,
  type PaymentProvider,
  type PricePlan,
  type PriceResolver,
  type ProviderEvent,
} from '@sbn/payments';
import { PLANS, type PlanId } from '@/config/plans';

/**
 * The payment webhook without the framework (M7 step 3, D-309): verify, translate, apply once.
 * The route gives it the provider, the price list and the database call, so tests run it with a
 * fake provider and no database.
 */

export interface PriceRow {
  readonly plan_id: string;
  readonly provider_price_id: string;
}

/** What applying an event did, as `apply_payment_event()` returns it. */
export type ApplyOutcome = 'applied' | 'stale' | 'ignored' | 'unmatched' | 'duplicate';

export interface WebhookDeps {
  readonly provider: PaymentProvider;
  /** Every price row of the provider, sold or retired: a renewal of a retired price still counts. */
  readonly loadPrices: () => Promise<readonly PriceRow[]>;
  readonly apply: (event: ProviderEvent) => Promise<ApplyOutcome>;
}

/**
 * Why a request was refused. Paddle retries any answer other than 2xx, so a refusal that a fix on
 * our side would cure (an unknown price, a database error) is 500, and one that no retry can cure
 * is 400 or 401.
 */
export type WebhookRefusal = 'signature' | 'payload' | 'price' | 'database';

export type WebhookResult =
  | { readonly status: 200; readonly outcome: ApplyOutcome; readonly eventType: string }
  | { readonly status: 400 | 401 | 500; readonly reason: WebhookRefusal };

function isPlanId(value: string): value is PlanId {
  return Object.hasOwn(PLANS, value);
}

/** The plan each price sells, with the days a one-time price gives, from the plan table. */
export function priceResolver(rows: readonly PriceRow[]): PriceResolver {
  const byPrice = new Map<string, PricePlan>();
  for (const row of rows) {
    if (!isPlanId(row.plan_id)) continue;
    const billing = PLANS[row.plan_id].billing;
    if (billing.kind === 'once') {
      byPrice.set(row.provider_price_id, { planId: row.plan_id, oneTimeDays: billing.days });
    } else if (billing.kind === 'recurring') {
      byPrice.set(row.provider_price_id, { planId: row.plan_id, oneTimeDays: null });
    }
    // Free and voucher plans are never sold through a provider.
  }
  return (priceId) => byPrice.get(priceId) ?? null;
}

export async function handlePaymentWebhook(
  input: { readonly rawBody: string; readonly signature: string | null; readonly now?: Date },
  deps: WebhookDeps,
): Promise<WebhookResult> {
  // The signature first, so a forged request costs no query.
  if (!deps.provider.verifyWebhook(input)) return { status: 401, reason: 'signature' };

  let prices: readonly PriceRow[];
  try {
    prices = await deps.loadPrices();
  } catch {
    return { status: 500, reason: 'database' };
  }

  let event: ProviderEvent;
  try {
    event = deps.provider.parseEvent(input.rawBody, priceResolver(prices));
  } catch (error) {
    if (!(error instanceof WebhookError)) throw error;
    return error.reason === 'price'
      ? { status: 500, reason: 'price' }
      : { status: 400, reason: 'payload' };
  }

  try {
    const outcome = await deps.apply(event);
    return { status: 200, outcome, eventType: event.eventType };
  } catch {
    return { status: 500, reason: 'database' };
  }
}
