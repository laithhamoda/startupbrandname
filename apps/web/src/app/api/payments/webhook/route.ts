import { createPaddleProvider, type ProviderEvent } from '@sbn/payments';
import { getPaymentsEnv } from '@/env/server';
import { log } from '@/lib/log';
import { handlePaymentWebhook, type ApplyOutcome, type PriceRow } from '@/lib/payments/webhook';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// Paddle's notifications (M7 step 3, D-309). Node runtime for node:crypto; the Frankfurt region
// the whole project is pinned to (vercel.json).
export const runtime = 'nodejs';

const NO_STORE = { 'cache-control': 'no-store' } as const;
const OUTCOMES = new Set<string>(['applied', 'stale', 'ignored', 'unmatched', 'duplicate']);

function isOutcome(value: unknown): value is ApplyOutcome {
  return typeof value === 'string' && OUTCOMES.has(value);
}

/**
 * POST /api/payments/webhook. The body is read as text, because the signature covers its exact
 * bytes. Only a verified event changes access, and each event is applied once
 * (`apply_payment_event`). The answer carries no detail: Paddle only reads the status. A log line
 * carries the event type and the outcome, never an id, an email or an amount.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getPaymentsEnv();
  if (!env) {
    void log.error('payments.webhook_not_configured', { status: 503 });
    return new Response(null, { status: 503, headers: NO_STORE });
  }

  const db = createSupabaseAdminClient(env.supabaseSecretKey);
  const provider = createPaddleProvider({ webhookSecret: env.paddleWebhookSecret });

  const loadPrices = async (): Promise<readonly PriceRow[]> => {
    const { data, error } = await db
      .from('billing_products')
      .select('plan_id, provider_price_id')
      .eq('provider', provider.id);
    if (error) throw error;
    return data;
  };

  const apply = async (event: ProviderEvent): Promise<ApplyOutcome> => {
    const { data, error } = await db.rpc('apply_payment_event', {
      p_provider: event.provider,
      p_event_id: event.eventId,
      p_event_type: event.eventType,
      p_occurred_at: event.occurredAt,
      p_change: event.change,
    });
    if (error) throw error;
    if (!isOutcome(data)) throw new Error('apply_payment_event returned an unknown outcome');
    return data;
  };

  const result = await handlePaymentWebhook(
    { rawBody: await request.text(), signature: request.headers.get('paddle-signature') },
    { provider, loadPrices, apply },
  );

  if (result.status === 200) {
    // An unmatched payment means money arrived for no account: the admin must look at it.
    const level = result.outcome === 'unmatched' ? 'warn' : 'info';
    void log[level]('payments.webhook_applied', {
      stage: result.eventType,
      reason: result.outcome,
    });
  } else {
    const level = result.reason === 'signature' || result.reason === 'payload' ? 'warn' : 'error';
    void log[level]('payments.webhook_refused', { reason: result.reason, status: result.status });
  }
  return new Response(null, { status: result.status, headers: NO_STORE });
}
