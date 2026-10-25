/**
 * What the webhook hands to `apply_payment_event()` (migration 20261025120000_m7_payments.sql,
 * D-309). The shapes match the SQL one to one: every field name here is a key the function reads.
 */

export type ProviderId = 'paddle';

/** Our status of a period of access; the provider's own statuses are mapped onto these. */
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'ended';

export type PaymentStatusChange = 'refunded' | 'partially_refunded' | 'chargeback';

/** The period a one-time purchase gives. */
// A type alias, not an interface, so a change stays assignable to the database client's Json type.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Grant = {
  readonly plan_id: string;
  readonly starts_at: string;
  readonly ends_at: string;
};

export type Change =
  | { readonly kind: 'ignore' }
  | {
      readonly kind: 'subscription';
      readonly provider_ref: string;
      readonly customer_id: string | null;
      readonly checkout_ref: string | null;
      readonly plan_id: string;
      readonly status: SubscriptionStatus;
      readonly starts_at: string;
      /** Null while a recurring plan renews. */
      readonly ends_at: string | null;
    }
  | {
      readonly kind: 'payment';
      readonly transaction_id: string;
      /** The subscription's provider ref, or the transaction id for a one-time purchase. */
      readonly provider_ref: string;
      readonly customer_id: string | null;
      readonly checkout_ref: string | null;
      /** US cents, tax included. */
      readonly amount_minor: number;
      readonly currency: 'USD';
      readonly grant?: Grant;
    }
  | {
      readonly kind: 'payment_status';
      readonly transaction_id: string;
      readonly status: PaymentStatusChange;
    };

/** A verified provider event, ready for `apply_payment_event()`. */
export interface ProviderEvent {
  readonly provider: ProviderId;
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly change: Change;
}

/** The plan a provider price sells, from `billing_products` and the plan table. */
export interface PricePlan {
  readonly planId: string;
  /** Days of access a one-time price gives; null for a recurring price. */
  readonly oneTimeDays: number | null;
}

/** Finds the plan a price sells; null when the price is not ours or not configured. */
export type PriceResolver = (providerPriceId: string) => PricePlan | null;

export interface WebhookInput {
  /** The request body exactly as received: the signature covers these bytes. */
  readonly rawBody: string;
  /** The provider's signature header. */
  readonly signature: string | null;
  readonly now?: Date;
}

/**
 * A payment provider behind one interface (CLAUDE.md §3), so the provider can be replaced without
 * touching the webhook or the entitlements.
 */
export interface PaymentProvider {
  readonly id: ProviderId;
  /** Whether the body is signed by the provider and recent. Checked before anything else is read. */
  verifyWebhook(input: WebhookInput): boolean;
  /**
   * Turns a verified body into the change to apply. Throws `WebhookError` with `reason: 'payload'`
   * for a body no retry can fix, and `reason: 'price'` for one the provider should send again once
   * the price is configured (the webhook answers 400 or 500 accordingly).
   */
  parseEvent(rawBody: string, resolvePrice: PriceResolver): ProviderEvent;
}

export type WebhookErrorReason = 'signature' | 'payload' | 'price';

export class WebhookError extends Error {
  readonly reason: WebhookErrorReason;

  constructor(reason: WebhookErrorReason, message: string) {
    super(message);
    this.name = 'WebhookError';
    this.reason = reason;
  }
}
