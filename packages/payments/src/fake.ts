import { createHmac } from 'node:crypto';
import { createPaddleProvider } from './paddle/provider';
import type { PaymentProvider } from './types';

/** The secret the fake provider and `signFakeEvent` share. Tests only. */
export const FAKE_WEBHOOK_SECRET = 'pdl_ntfset_fake_secret_for_tests';

/**
 * A Paddle provider with a known secret, for tests of the webhook route and the entitlements:
 * `signFakeEvent` produces the header Paddle would send for a body.
 */
export function createFakeProvider(): PaymentProvider {
  return createPaddleProvider({ webhookSecret: FAKE_WEBHOOK_SECRET });
}

export function signFakeEvent(rawBody: string, now: Date = new Date()): string {
  const ts = Math.floor(now.getTime() / 1000).toString();
  const h1 = createHmac('sha256', FAKE_WEBHOOK_SECRET).update(`${ts}:${rawBody}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}
