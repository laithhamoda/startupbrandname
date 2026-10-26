import { createFakeProvider, signFakeEvent, type ProviderEvent } from '@sbn/payments';
import { describe, expect, it, vi } from 'vitest';
import { handlePaymentWebhook, priceResolver, type ApplyOutcome, type PriceRow } from './webhook';

const NOW = new Date('2026-10-25T10:00:00Z');
const REF = '0f8e3a52-6c1d-4b8a-9e2f-3d4c5b6a7980';

const PRICES: readonly PriceRow[] = [
  { plan_id: 'strategist', provider_price_id: 'pri_standard' },
  { plan_id: 'commander', provider_price_id: 'pri_commander' },
  { plan_id: 'course', provider_price_id: 'pri_course' },
  { plan_id: 'retired_plan', provider_price_id: 'pri_retired' },
];

function transactionBody(priceId: string, subscriptionId: string | null = null): string {
  return JSON.stringify({
    event_id: 'evt_01',
    event_type: 'transaction.completed',
    occurred_at: '2026-10-25T10:00:00Z',
    data: {
      id: 'txn_01',
      status: 'completed',
      subscription_id: subscriptionId,
      customer_id: 'ctm_01',
      custom_data: { checkout_ref: REF },
      currency_code: 'USD',
      items: [{ price: { id: priceId } }],
      billed_at: '2026-10-25T10:00:00Z',
      details: { totals: { grand_total: '500' } },
    },
  });
}

function deps(
  overrides: {
    loadPrices?: () => Promise<readonly PriceRow[]>;
    apply?: (event: ProviderEvent) => Promise<ApplyOutcome>;
  } = {},
) {
  const loadPrices = vi.fn(overrides.loadPrices ?? (() => Promise.resolve(PRICES)));
  const apply = vi.fn(overrides.apply ?? (() => Promise.resolve<ApplyOutcome>('applied')));
  return { provider: createFakeProvider(), loadPrices, apply };
}

function signed(rawBody: string) {
  return { rawBody, signature: signFakeEvent(rawBody, NOW), now: NOW };
}

describe('priceResolver', () => {
  const resolve = priceResolver(PRICES);

  it('gives each one-time price the days of its package', () => {
    expect(resolve('pri_standard')).toEqual({ planId: 'strategist', oneTimeDays: 365 });
    expect(resolve('pri_commander')).toEqual({ planId: 'commander', oneTimeDays: 365 });
  });

  it('knows no price for a voucher plan, a plan the table does not have, or an unknown price', () => {
    expect(resolve('pri_course')).toBeNull();
    expect(resolve('pri_retired')).toBeNull();
    expect(resolve('pri_other')).toBeNull();
  });
});

describe('handlePaymentWebhook', () => {
  it('applies a verified event and answers 200', async () => {
    const d = deps();
    const result = await handlePaymentWebhook(signed(transactionBody('pri_standard')), d);
    expect(result).toEqual({ status: 200, outcome: 'applied', eventType: 'transaction.completed' });
    expect(d.apply).toHaveBeenCalledOnce();
    expect(d.apply.mock.calls[0]?.[0]).toMatchObject({
      eventId: 'evt_01',
      change: {
        kind: 'payment',
        grant: { plan_id: 'strategist', ends_at: '2027-10-25T10:00:00.000Z' },
      },
    });
  });

  it('answers 200 for a duplicate, so Paddle stops sending it', async () => {
    const d = deps({ apply: () => Promise.resolve('duplicate') });
    expect(await handlePaymentWebhook(signed(transactionBody('pri_standard')), d)).toMatchObject({
      status: 200,
      outcome: 'duplicate',
    });
  });

  it('refuses a forged request with 401 before reading anything', async () => {
    const d = deps();
    const body = transactionBody('pri_standard');
    const result = await handlePaymentWebhook(
      { rawBody: body, signature: 'ts=1;h1=00', now: NOW },
      d,
    );
    expect(result).toEqual({ status: 401, reason: 'signature' });
    expect(d.loadPrices).not.toHaveBeenCalled();
    expect(d.apply).not.toHaveBeenCalled();
  });

  it('refuses a malformed event with 400', async () => {
    const d = deps();
    expect(await handlePaymentWebhook(signed('{"event_id":"evt_01"}'), d)).toEqual({
      status: 400,
      reason: 'payload',
    });
    expect(d.apply).not.toHaveBeenCalled();
  });

  it('answers 500 for an unknown price, so Paddle sends it again once it is configured', async () => {
    const d = deps();
    expect(await handlePaymentWebhook(signed(transactionBody('pri_unknown')), d)).toEqual({
      status: 500,
      reason: 'price',
    });
  });

  it('answers 500 when the database cannot be read or written', async () => {
    const unreadable = deps({ loadPrices: () => Promise.reject(new Error('down')) });
    expect(await handlePaymentWebhook(signed(transactionBody('pri_standard')), unreadable)).toEqual(
      {
        status: 500,
        reason: 'database',
      },
    );
    const unwritable = deps({ apply: () => Promise.reject(new Error('down')) });
    expect(await handlePaymentWebhook(signed(transactionBody('pri_standard')), unwritable)).toEqual(
      {
        status: 500,
        reason: 'database',
      },
    );
  });

  it('lets an unexpected error through', async () => {
    const d = deps();
    const provider = createFakeProvider();
    const broken = {
      ...provider,
      parseEvent: () => {
        throw new TypeError('bug');
      },
    };
    await expect(
      handlePaymentWebhook(signed(transactionBody('pri_standard')), { ...d, provider: broken }),
    ).rejects.toThrow(TypeError);
  });
});
