import { describe, expect, it } from 'vitest';
import { createFakeProvider, signFakeEvent } from '../fake';
import type { PriceResolver } from '../types';
import { createPaddleProvider } from './provider';

const resolvePrice: PriceResolver = () => ({ planId: 'monthly', oneTimeDays: null });
const NOW = new Date('2026-10-25T10:00:00Z');
const BODY = JSON.stringify({
  event_id: 'evt_01',
  event_type: 'customer.created',
  occurred_at: '2026-10-25T10:00:00Z',
  data: {},
});

describe('createPaddleProvider', () => {
  it('refuses to start without a webhook secret', () => {
    expect(() => createPaddleProvider({ webhookSecret: ' ' })).toThrow(/secret/);
  });

  it('verifies a signed event and parses it', () => {
    const provider = createFakeProvider();
    expect(provider.id).toBe('paddle');
    expect(
      provider.verifyWebhook({ rawBody: BODY, signature: signFakeEvent(BODY, NOW), now: NOW }),
    ).toBe(true);
    expect(provider.parseEvent(BODY, resolvePrice)).toMatchObject({
      eventId: 'evt_01',
      change: { kind: 'ignore' },
    });
  });

  it('rejects an unsigned or forged event', () => {
    const provider = createFakeProvider();
    expect(provider.verifyWebhook({ rawBody: BODY, signature: null, now: NOW })).toBe(false);
    expect(
      provider.verifyWebhook({ rawBody: BODY, signature: signFakeEvent('{}', NOW), now: NOW }),
    ).toBe(false);
  });

  it('checks the time against the clock when no time is given', () => {
    const provider = createFakeProvider();
    expect(provider.verifyWebhook({ rawBody: BODY, signature: signFakeEvent(BODY, NOW) })).toBe(
      false,
    );
    expect(provider.verifyWebhook({ rawBody: BODY, signature: signFakeEvent(BODY) })).toBe(true);
  });
});
