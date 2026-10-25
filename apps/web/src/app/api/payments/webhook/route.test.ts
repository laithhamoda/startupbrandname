import { signFakeEvent, FAKE_WEBHOOK_SECRET } from '@sbn/payments';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const BODY = JSON.stringify({
  event_id: 'evt_01',
  event_type: 'customer.created',
  occurred_at: '2026-10-25T10:00:00Z',
  data: {},
});

function request(signature: string | null): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (signature) headers.set('paddle-signature', signature);
  return new Request('https://startupbrandname.com/api/payments/webhook', {
    method: 'POST',
    headers,
    body: BODY,
  });
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test123');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test123');
  vi.stubEnv('PADDLE_WEBHOOK_SECRET', FAKE_WEBHOOK_SECRET);
  fetchMock = vi.fn<typeof fetch>((input) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes('/rest/v1/billing_products')) return Promise.resolve(Response.json([]));
    if (url.includes('/rest/v1/rpc/apply_payment_event'))
      return Promise.resolve(Response.json('ignored'));
    return Promise.resolve(new Response(null, { status: 404 }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/payments/webhook', () => {
  it('answers 503 and touches nothing while payments are not configured', async () => {
    vi.stubEnv('PADDLE_WEBHOOK_SECRET', '');
    const response = await POST(request(signFakeEvent(BODY)));
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses an unsigned request without a query', async () => {
    const response = await POST(request(null));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies a signed event through the database with the secret key', async () => {
    const response = await POST(request(signFakeEvent(BODY)));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const rpc = fetchMock.mock.calls.find(([input]) =>
      (input instanceof Request ? input.url : input.toString()).includes(
        '/rpc/apply_payment_event',
      ),
    );
    expect(rpc).toBeDefined();
    const init = rpc?.[1];
    expect(new Headers(init?.headers).get('apikey')).toBe('sb_secret_test123');
    const sent = JSON.parse(typeof init?.body === 'string' ? init.body : 'null') as unknown;
    expect(sent).toMatchObject({
      p_provider: 'paddle',
      p_event_id: 'evt_01',
      p_change: { kind: 'ignore' },
    });
  });

  it('answers 500 when the database refuses, so Paddle sends the event again', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(Response.json({ code: '42501', message: 'denied' }, { status: 403 })),
    );
    const response = await POST(request(signFakeEvent(BODY)));
    expect(response.status).toBe(500);
  });

  it('answers 500 when the database returns something that is not an outcome', async () => {
    fetchMock.mockImplementation((input) => {
      const url = input instanceof Request ? input.url : input.toString();
      return Promise.resolve(Response.json(url.includes('billing_products') ? [] : 'granted'));
    });
    const response = await POST(request(signFakeEvent(BODY)));
    expect(response.status).toBe(500);
  });
});
