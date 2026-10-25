import type { PaymentProvider } from '../types';
import { parsePaddleEvent } from './events';
import { verifyPaddleSignature } from './signature';

export interface PaddleConfig {
  /** The secret of the notification destination in the Paddle dashboard. Server only. */
  readonly webhookSecret: string;
}

/** Paddle as merchant of record (D-309). */
export function createPaddleProvider(config: PaddleConfig): PaymentProvider {
  if (config.webhookSecret.trim() === '') {
    throw new Error('paddle: the webhook secret is empty');
  }
  return {
    id: 'paddle',
    verifyWebhook: (input) =>
      verifyPaddleSignature(input.rawBody, input.signature, config.webhookSecret, input.now),
    parseEvent: parsePaddleEvent,
  };
}
