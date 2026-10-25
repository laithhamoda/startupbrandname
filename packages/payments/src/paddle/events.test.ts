import { describe, expect, it } from 'vitest';
import { WebhookError, type PriceResolver } from '../types';
import { parsePaddleEvent } from './events';

const REF = '0f8e3a52-6c1d-4b8a-9e2f-3d4c5b6a7980';

const resolvePrice: PriceResolver = (priceId) =>
  ({
    pri_monthly: { planId: 'monthly', oneTimeDays: null },
    pri_annual: { planId: 'annual', oneTimeDays: 365 },
    pri_weekly: { planId: 'weekly', oneTimeDays: 7 },
  })[priceId] ?? null;

function body(
  eventType: string,
  data: unknown,
  occurredAt = '2026-10-25T10:00:00.123456Z',
): string {
  return JSON.stringify({
    event_id: 'evt_01',
    event_type: eventType,
    occurred_at: occurredAt,
    notification_id: 'ntf_01',
    data,
  });
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_01',
    status: 'active',
    customer_id: 'ctm_01',
    custom_data: { checkout_ref: REF },
    items: [{ price: { id: 'pri_monthly' }, quantity: 1 }],
    started_at: '2026-10-25T09:59:00Z',
    first_billed_at: '2026-10-25T09:59:00Z',
    scheduled_change: null,
    canceled_at: null,
    paused_at: null,
    ...overrides,
  };
}

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'txn_01',
    status: 'completed',
    subscription_id: 'sub_01',
    customer_id: 'ctm_01',
    custom_data: { checkout_ref: REF },
    currency_code: 'USD',
    items: [{ price: { id: 'pri_monthly' }, quantity: 1 }],
    billed_at: '2026-10-25T10:00:00Z',
    details: { totals: { grand_total: '1700', subtotal: '1700' } },
    ...overrides,
  };
}

function reason(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof WebhookError) return error.reason;
    throw error;
  }
  return undefined;
}

describe('parsePaddleEvent: the envelope', () => {
  it('keeps the event id and type, and normalises the time', () => {
    const event = parsePaddleEvent(body('customer.updated', {}), resolvePrice);
    expect(event).toEqual({
      provider: 'paddle',
      eventId: 'evt_01',
      eventType: 'customer.updated',
      occurredAt: '2026-10-25T10:00:00.123Z',
      change: { kind: 'ignore' },
    });
  });

  it('rejects a body that is not JSON, or an event without its fields', () => {
    expect(reason(() => parsePaddleEvent('not json', resolvePrice))).toBe('payload');
    expect(reason(() => parsePaddleEvent('{"event_type":"x"}', resolvePrice))).toBe('payload');
    expect(reason(() => parsePaddleEvent(body('x', {}, 'yesterday'), resolvePrice))).toBe(
      'payload',
    );
  });
});

describe('parsePaddleEvent: subscriptions', () => {
  it('maps a new subscription to active access without an end', () => {
    const { change } = parsePaddleEvent(body('subscription.created', subscription()), resolvePrice);
    expect(change).toEqual({
      kind: 'subscription',
      provider_ref: 'sub_01',
      customer_id: 'ctm_01',
      checkout_ref: REF,
      plan_id: 'monthly',
      status: 'active',
      starts_at: '2026-10-25T09:59:00.000Z',
      ends_at: null,
    });
  });

  it('keeps access until a scheduled cancellation or pause takes effect', () => {
    for (const action of ['cancel', 'pause']) {
      const data = subscription({
        scheduled_change: { action, effective_at: '2026-11-25T09:59:00Z' },
      });
      const { change } = parsePaddleEvent(body('subscription.updated', data), resolvePrice);
      expect(change).toMatchObject({ status: 'active', ends_at: '2026-11-25T09:59:00.000Z' });
    }
  });

  it('ignores a scheduled resume when it sets the end', () => {
    const data = subscription({
      scheduled_change: { action: 'resume', effective_at: '2026-11-25T09:59:00Z' },
    });
    const { change } = parsePaddleEvent(body('subscription.updated', data), resolvePrice);
    expect(change).toMatchObject({ status: 'active', ends_at: null });
  });

  it('keeps a past-due subscription as past due', () => {
    const { change } = parsePaddleEvent(
      body('subscription.past_due', subscription({ status: 'past_due' })),
      resolvePrice,
    );
    expect(change).toMatchObject({ status: 'past_due', ends_at: null });
  });

  it('ends access when the subscription is cancelled or paused', () => {
    const canceled = parsePaddleEvent(
      body(
        'subscription.canceled',
        subscription({ status: 'canceled', canceled_at: '2026-11-25T09:59:00Z' }),
      ),
      resolvePrice,
    );
    expect(canceled.change).toMatchObject({
      status: 'canceled',
      ends_at: '2026-11-25T09:59:00.000Z',
    });

    const paused = parsePaddleEvent(
      body('subscription.paused', subscription({ status: 'paused', paused_at: null })),
      resolvePrice,
    );
    expect(paused.change).toMatchObject({
      status: 'canceled',
      ends_at: '2026-10-25T10:00:00.123Z',
    });
  });

  it('keeps the end after the start, as the table requires', () => {
    const data = subscription({ status: 'canceled', canceled_at: '2026-10-25T09:00:00Z' });
    const { change } = parsePaddleEvent(body('subscription.canceled', data), resolvePrice);
    expect(change).toMatchObject({ ends_at: '2026-10-25T09:59:01.000Z' });
  });

  it('starts at the first billing, or at the event, when Paddle gives no start', () => {
    const billed = parsePaddleEvent(
      body(
        'subscription.created',
        subscription({ started_at: null, first_billed_at: '2026-10-25T09:00:00Z' }),
      ),
      resolvePrice,
    );
    expect(billed.change).toMatchObject({ starts_at: '2026-10-25T09:00:00.000Z' });
    const none = parsePaddleEvent(
      body('subscription.created', subscription({ started_at: null, first_billed_at: null })),
      resolvePrice,
    );
    expect(none.change).toMatchObject({ starts_at: '2026-10-25T10:00:00.123Z' });
  });

  it('drops a checkout reference that is not one of ours', () => {
    for (const custom_data of [null, {}, { checkout_ref: 'user-42' }, { checkout_ref: 42 }]) {
      const { change } = parsePaddleEvent(
        body('subscription.created', subscription({ custom_data })),
        resolvePrice,
      );
      expect(change).toMatchObject({ checkout_ref: null });
    }
  });

  it('reads the reference in any case and stores it in lower case', () => {
    const data = subscription({ custom_data: { checkout_ref: REF.toUpperCase() } });
    const { change } = parsePaddleEvent(body('subscription.created', data), resolvePrice);
    expect(change).toMatchObject({ checkout_ref: REF });
  });

  it('rejects a price no plan sells, so Paddle sends it again once it is configured', () => {
    const data = subscription({ items: [{ price: { id: 'pri_unknown' } }] });
    expect(reason(() => parsePaddleEvent(body('subscription.created', data), resolvePrice))).toBe(
      'price',
    );
  });

  it('rejects a subscription without items or with an unknown status', () => {
    expect(
      reason(() =>
        parsePaddleEvent(body('subscription.created', subscription({ items: [] })), resolvePrice),
      ),
    ).toBe('payload');
    expect(
      reason(() =>
        parsePaddleEvent(
          body('subscription.created', subscription({ status: 'mystery' })),
          resolvePrice,
        ),
      ),
    ).toBe('payload');
  });
});

describe('parsePaddleEvent: transactions', () => {
  it('records a renewal payment against its subscription', () => {
    const { change } = parsePaddleEvent(body('transaction.completed', transaction()), resolvePrice);
    expect(change).toEqual({
      kind: 'payment',
      transaction_id: 'txn_01',
      provider_ref: 'sub_01',
      customer_id: 'ctm_01',
      checkout_ref: REF,
      amount_minor: 1700,
      currency: 'USD',
    });
  });

  it('gives a one-time purchase its own period', () => {
    const data = transaction({
      id: 'txn_02',
      subscription_id: null,
      items: [{ price: { id: 'pri_weekly' } }],
      details: { totals: { grand_total: '500' } },
    });
    const { change } = parsePaddleEvent(body('transaction.completed', data), resolvePrice);
    expect(change).toMatchObject({
      kind: 'payment',
      provider_ref: 'txn_02',
      amount_minor: 500,
      grant: {
        plan_id: 'weekly',
        starts_at: '2026-10-25T10:00:00.000Z',
        ends_at: '2026-11-01T10:00:00.000Z',
      },
    });
  });

  it('starts a one-time period at the event when the transaction has no billing time', () => {
    const data = transaction({
      subscription_id: null,
      billed_at: null,
      items: [{ price: { id: 'pri_annual' } }],
    });
    const { change } = parsePaddleEvent(body('transaction.completed', data), resolvePrice);
    expect(change).toMatchObject({
      grant: { starts_at: '2026-10-25T10:00:00.123Z', ends_at: '2027-10-25T10:00:00.123Z' },
    });
  });

  it('rejects a recurring price paid without a subscription', () => {
    const data = transaction({ subscription_id: null });
    expect(reason(() => parsePaddleEvent(body('transaction.completed', data), resolvePrice))).toBe(
      'price',
    );
  });

  it('ignores a transaction that is not completed', () => {
    const { change } = parsePaddleEvent(
      body('transaction.completed', transaction({ status: 'paid' })),
      resolvePrice,
    );
    expect(change).toEqual({ kind: 'ignore' });
  });

  it('ignores the other transaction events', () => {
    const { change } = parsePaddleEvent(body('transaction.paid', transaction()), resolvePrice);
    expect(change).toEqual({ kind: 'ignore' });
  });

  it('rejects a charge in another currency than USD', () => {
    const data = transaction({ currency_code: 'EUR' });
    expect(reason(() => parsePaddleEvent(body('transaction.completed', data), resolvePrice))).toBe(
      'payload',
    );
  });

  it('rejects a total that is not a whole number of cents', () => {
    const data = transaction({ details: { totals: { grand_total: '17.00' } } });
    expect(reason(() => parsePaddleEvent(body('transaction.completed', data), resolvePrice))).toBe(
      'payload',
    );
  });
});

describe('parsePaddleEvent: adjustments', () => {
  function adjustment(overrides: Record<string, unknown>) {
    return {
      id: 'adj_01',
      action: 'refund',
      transaction_id: 'txn_01',
      status: 'approved',
      type: 'full',
      ...overrides,
    };
  }

  it('maps an approved full refund, an approved partial refund and a chargeback', () => {
    expect(
      parsePaddleEvent(body('adjustment.updated', adjustment({})), resolvePrice).change,
    ).toEqual({
      kind: 'payment_status',
      transaction_id: 'txn_01',
      status: 'refunded',
    });
    expect(
      parsePaddleEvent(body('adjustment.updated', adjustment({ type: 'partial' })), resolvePrice)
        .change,
    ).toMatchObject({ status: 'partially_refunded' });
    expect(
      parsePaddleEvent(
        body('adjustment.created', adjustment({ action: 'chargeback', type: null })),
        resolvePrice,
      ).change,
    ).toMatchObject({ status: 'chargeback' });
  });

  it('ignores a refund waiting for approval, a rejected one and other adjustments', () => {
    for (const overrides of [
      { status: 'pending_approval' },
      { status: 'rejected' },
      { action: 'credit' },
    ]) {
      expect(
        parsePaddleEvent(body('adjustment.created', adjustment(overrides)), resolvePrice).change,
      ).toEqual({
        kind: 'ignore',
      });
    }
  });

  it('rejects an adjustment without its transaction', () => {
    const data = adjustment({ transaction_id: undefined });
    expect(reason(() => parsePaddleEvent(body('adjustment.created', data), resolvePrice))).toBe(
      'payload',
    );
  });
});
