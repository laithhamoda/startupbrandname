import { z } from 'zod';
import {
  WebhookError,
  type Change,
  type PriceResolver,
  type ProviderEvent,
  type SubscriptionStatus,
} from '../types';

/**
 * Paddle Billing webhook payloads, read only as far as access needs (D-309). Unknown fields are
 * dropped; a field we use that is missing or malformed rejects the event, so Paddle sends it again
 * once the cause is fixed.
 */

const DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'not a timestamp');
const id = z.string().min(1).max(100);
const customData = z.record(z.string(), z.unknown()).nullish();
const items = z.array(z.object({ price: z.object({ id }) })).min(1);

const envelope = z.object({
  event_id: id,
  event_type: z.string().min(1).max(100),
  occurred_at: timestamp,
  data: z.unknown(),
});

const subscriptionData = z.object({
  id,
  status: z.enum(['active', 'trialing', 'past_due', 'paused', 'canceled']),
  customer_id: id.nullish(),
  custom_data: customData,
  items,
  started_at: timestamp.nullish(),
  first_billed_at: timestamp.nullish(),
  scheduled_change: z
    .object({ action: z.enum(['cancel', 'pause', 'resume']), effective_at: timestamp })
    .nullish(),
  canceled_at: timestamp.nullish(),
  paused_at: timestamp.nullish(),
});

const transactionData = z.object({
  id,
  status: z.string(),
  subscription_id: id.nullish(),
  customer_id: id.nullish(),
  custom_data: customData,
  currency_code: z.string(),
  items,
  billed_at: timestamp.nullish(),
  details: z.object({ totals: z.object({ grand_total: z.string().regex(/^\d{1,15}$/) }) }),
});

const adjustmentData = z.object({
  action: z.string(),
  transaction_id: id,
  status: z.string(),
  type: z.enum(['full', 'partial']).nullish(),
});

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.created',
  'subscription.activated',
  'subscription.updated',
  'subscription.past_due',
  'subscription.paused',
  'subscription.resumed',
  'subscription.canceled',
]);

function iso(value: string): string {
  return new Date(value).toISOString();
}

/** An end that is not after the start becomes one second after it, as the table requires. */
function endAfter(startsAt: string, endsAt: string): string {
  const start = Date.parse(startsAt);
  return Date.parse(endsAt) > start ? iso(endsAt) : new Date(start + 1000).toISOString();
}

function checkoutRef(data: Record<string, unknown> | null | undefined): string | null {
  const ref = data?.checkout_ref;
  return typeof ref === 'string' && UUID.test(ref) ? ref.toLowerCase() : null;
}

function parse<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new WebhookError(
      'payload',
      `paddle: malformed ${what}: ${result.error.issues[0]?.message ?? ''}`,
    );
  }
  return result.data;
}

/** The price of the first item: a checkout of ours sells one plan at a time. */
function firstPrice(list: readonly { price: { id: string } }[]): string {
  const first = list[0];
  if (!first) throw new WebhookError('payload', 'paddle: no items');
  return first.price.id;
}

function planFor(priceId: string, resolvePrice: PriceResolver) {
  const plan = resolvePrice(priceId);
  if (!plan) throw new WebhookError('price', `paddle: no plan sells price ${priceId}`);
  return plan;
}

function subscriptionChange(
  data: unknown,
  occurredAt: string,
  resolvePrice: PriceResolver,
): Change {
  const sub = parse(subscriptionData, data, 'subscription');
  const plan = planFor(firstPrice(sub.items), resolvePrice);
  const startsAt = iso(sub.started_at ?? sub.first_billed_at ?? occurredAt);

  let status: SubscriptionStatus;
  let endsAt: string | null = null;
  if (sub.status === 'canceled' || sub.status === 'paused') {
    status = 'canceled';
    endsAt = endAfter(
      startsAt,
      (sub.status === 'canceled' ? sub.canceled_at : sub.paused_at) ?? occurredAt,
    );
  } else {
    status = sub.status === 'past_due' ? 'past_due' : 'active';
    // A cancellation or pause at the end of the period keeps access until then.
    if (sub.scheduled_change && sub.scheduled_change.action !== 'resume') {
      endsAt = endAfter(startsAt, sub.scheduled_change.effective_at);
    }
  }

  return {
    kind: 'subscription',
    provider_ref: sub.id,
    customer_id: sub.customer_id ?? null,
    checkout_ref: checkoutRef(sub.custom_data),
    plan_id: plan.planId,
    status,
    starts_at: startsAt,
    ends_at: endsAt,
  };
}

function transactionChange(data: unknown, occurredAt: string, resolvePrice: PriceResolver): Change {
  const txn = parse(transactionData, data, 'transaction');
  if (txn.status !== 'completed') return { kind: 'ignore' };
  // Every charge is USD (CLAUDE.md §3): another currency means the catalog is misconfigured.
  if (txn.currency_code !== 'USD') {
    throw new WebhookError(
      'payload',
      `paddle: transaction ${txn.id} is in ${txn.currency_code}, not USD`,
    );
  }
  const plan = planFor(firstPrice(txn.items), resolvePrice);
  const base = {
    kind: 'payment' as const,
    transaction_id: txn.id,
    customer_id: txn.customer_id ?? null,
    checkout_ref: checkoutRef(txn.custom_data),
    amount_minor: Number(txn.details.totals.grand_total),
    currency: 'USD' as const,
  };
  if (txn.subscription_id) return { ...base, provider_ref: txn.subscription_id };

  // A mentor pack adds messages to the checkout's project, not a period of access.
  if (plan.mentorMessages !== undefined) {
    return { ...base, provider_ref: txn.id, credit: { messages: plan.mentorMessages } };
  }

  if (plan.oneTimeDays === null) {
    throw new WebhookError(
      'price',
      `paddle: recurring plan ${plan.planId} paid without a subscription`,
    );
  }
  const startsAt = iso(txn.billed_at ?? occurredAt);
  return {
    ...base,
    provider_ref: txn.id,
    grant: {
      plan_id: plan.planId,
      starts_at: startsAt,
      ends_at: new Date(Date.parse(startsAt) + plan.oneTimeDays * DAY_MS).toISOString(),
    },
  };
}

function adjustmentChange(data: unknown): Change {
  const adj = parse(adjustmentData, data, 'adjustment');
  if (adj.action === 'chargeback') {
    return { kind: 'payment_status', transaction_id: adj.transaction_id, status: 'chargeback' };
  }
  if (adj.action === 'refund' && adj.status === 'approved') {
    return {
      kind: 'payment_status',
      transaction_id: adj.transaction_id,
      status: adj.type === 'partial' ? 'partially_refunded' : 'refunded',
    };
  }
  return { kind: 'ignore' };
}

/** Turns a verified Paddle webhook body into the event `apply_payment_event()` applies. */
export function parsePaddleEvent(rawBody: string, resolvePrice: PriceResolver): ProviderEvent {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new WebhookError('payload', 'paddle: the body is not JSON');
  }
  const event = parse(envelope, json, 'event');
  const occurredAt = iso(event.occurred_at);

  let change: Change;
  if (SUBSCRIPTION_EVENTS.has(event.event_type)) {
    change = subscriptionChange(event.data, occurredAt, resolvePrice);
  } else if (event.event_type === 'transaction.completed') {
    change = transactionChange(event.data, occurredAt, resolvePrice);
  } else if (
    event.event_type === 'adjustment.created' ||
    event.event_type === 'adjustment.updated'
  ) {
    change = adjustmentChange(event.data);
  } else {
    change = { kind: 'ignore' };
  }

  return {
    provider: 'paddle',
    eventId: event.event_id,
    eventType: event.event_type,
    occurredAt,
    change,
  };
}
