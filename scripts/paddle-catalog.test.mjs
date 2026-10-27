import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accountOfKey,
  matchingPrice,
  OFFERS,
  priceBody,
  productBody,
  run,
} from './paddle-catalog.mjs';

const SANDBOX_KEY = `pdl_sdbx_apikey_${'a'.repeat(26)}_${'b'.repeat(22)}_${'c'.repeat(3)}`;
const LIVE_KEY = SANDBOX_KEY.replace('sdbx', 'live');

/** Keeps the run output out of the test log. */
const quiet = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the catalog', () => {
  it('sells the two packages and the upgrade at the difference (D-313)', () => {
    const cents = Object.fromEntries(OFFERS.map((offer) => [offer.offer, offer.amountCents]));
    expect(cents).toEqual({ strategist: 1000, commander: 3000, upgrade: 2000, mentor_pack: 700 });
    expect(cents.upgrade).toBe(cents.commander - cents.strategist);
    expect(OFFERS.map((offer) => offer.env)).toEqual([
      'PADDLE_PRICE_STRATEGIST',
      'PADDLE_PRICE_COMMANDER',
      'PADDLE_PRICE_UPGRADE',
      'PADDLE_PRICE_MENTOR_PACK',
    ]);
  });

  it('prices once, in USD, tax included, one per checkout', () => {
    const body = priceBody(OFFERS[0], 'pro_01abc');
    expect(body).toMatchObject({
      product_id: 'pro_01abc',
      unit_price: { amount: '1000', currency_code: 'USD' },
      billing_cycle: null,
      trial_period: null,
      tax_mode: 'internal',
      quantity: { minimum: 1, maximum: 1 },
      custom_data: { sbn_offer: 'strategist', sbn_plan: 'strategist' },
    });
    expect(body.description.length).toBeGreaterThanOrEqual(2);
    expect(body.name.length).toBeLessThanOrEqual(150);
  });

  it('describes each product in both languages, with a square HTTPS image', () => {
    for (const offer of OFFERS) {
      const body = productBody(offer);
      expect(body.tax_category).toBe('standard');
      expect(body.image_url).toMatch(/^https:\/\//);
      expect(body.name.length).toBeLessThanOrEqual(200);
      expect(body.description.length).toBeLessThanOrEqual(2048);
      expect(body.description).toMatch(/[a-z]/);
      expect(body.description).toMatch(/[؀-ۿ]/);
    }
  });
});

describe('accountOfKey', () => {
  it('tells the sandbox from the live account by the key prefix', () => {
    expect(accountOfKey(SANDBOX_KEY)).toMatchObject({ name: 'sandbox', vercel: 'Preview' });
    expect(accountOfKey(LIVE_KEY)).toMatchObject({
      name: 'live',
      baseUrl: 'https://api.paddle.com',
    });
  });

  it('refuses anything that is not an API key', () => {
    for (const key of [undefined, '', 'test_abc', 'pdl_sdbx_apikey_short', 'pdl_ntfset_x']) {
      expect(accountOfKey(key)).toBeNull();
    }
  });
});

describe('matchingPrice', () => {
  const offer = OFFERS[0];
  const price = (overrides) => ({
    id: 'pri_1',
    status: 'active',
    billing_cycle: null,
    unit_price: { amount: '1000', currency_code: 'USD' },
    ...overrides,
  });

  it('finds the planned price, and ignores archived ones', () => {
    expect(matchingPrice({ prices: [price()] }, offer)).toMatchObject({ status: 'ok' });
    expect(matchingPrice({ prices: [price({ status: 'archived' })] }, offer)).toEqual({
      status: 'missing',
    });
  });

  it('reports a different active price instead of changing it', () => {
    expect(
      matchingPrice(
        { prices: [price({ unit_price: { amount: '900', currency_code: 'USD' } })] },
        offer,
      ).status,
    ).toBe('different');
    expect(
      matchingPrice(
        { prices: [price({ billing_cycle: { interval: 'month', frequency: 1 } })] },
        offer,
      ).status,
    ).toBe('different');
  });
});

describe('run', () => {
  function fakePaddle(products = []) {
    const calls = [];
    let next = 1;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        const method = init?.method ?? 'GET';
        const path = new URL(url).pathname;
        calls.push({ method, path, body: init?.body ? JSON.parse(init.body) : null, init });
        if (method === 'GET') {
          return Response.json({ data: products, meta: { pagination: { has_more: false } } });
        }
        const id = `${path === '/products' ? 'pro' : 'pri'}_${String(next++).padStart(26, '0')}`;
        return Response.json({ data: { id } }, { status: 201 });
      }),
    );
    return calls;
  }

  it('refuses to start without an API key', async () => {
    await expect(run({ key: 'test_abc', dryRun: true, log: quiet })).rejects.toThrow(/API key/);
  });

  it('creates nothing in a dry run', async () => {
    const calls = fakePaddle();
    await run({ key: SANDBOX_KEY, dryRun: true, log: quiet });
    expect(calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('creates four products and four prices, and prints the variables', async () => {
    const calls = fakePaddle();
    const lines = [];
    const result = await run({ key: SANDBOX_KEY, dryRun: false, log: (line) => lines.push(line) });
    expect(calls.filter((call) => call.method === 'POST').map((call) => call.path)).toEqual([
      '/products',
      '/prices',
      '/products',
      '/prices',
      '/products',
      '/prices',
      '/products',
      '/prices',
    ]);
    expect(calls[0].init.headers.Authorization).toBe(`Bearer ${SANDBOX_KEY}`);
    expect(new URL('https://sandbox-api.paddle.com').host).toBe('sandbox-api.paddle.com');
    expect(Object.keys(result.env)).toEqual([
      'PADDLE_PRICE_STRATEGIST',
      'PADDLE_PRICE_COMMANDER',
      'PADDLE_PRICE_UPGRADE',
      'PADDLE_PRICE_MENTOR_PACK',
    ]);
    expect(lines.join('\n')).not.toContain(SANDBOX_KEY);
    expect(lines.join('\n')).toContain('Preview');
  });

  it('reuses what it made before instead of duplicating it', async () => {
    const products = OFFERS.map((offer, index) => ({
      id: `pro_${index}`,
      name: offer.productName,
      description: offer.productDescription,
      custom_data: { sbn_offer: offer.offer, sbn_plan: offer.plan },
      prices: [
        {
          id: `pri_${index}`,
          status: 'active',
          billing_cycle: null,
          unit_price: { amount: String(offer.amountCents), currency_code: 'USD' },
        },
      ],
    }));
    const calls = fakePaddle(products);
    const result = await run({ key: SANDBOX_KEY, dryRun: false, log: quiet });
    expect(calls.filter((call) => call.method !== 'GET')).toEqual([]);
    expect(result.env).toEqual({
      PADDLE_PRICE_STRATEGIST: 'pri_0',
      PADDLE_PRICE_COMMANDER: 'pri_1',
      PADDLE_PRICE_UPGRADE: 'pri_2',
      PADDLE_PRICE_MENTOR_PACK: 'pri_3',
    });
  });

  it('renames a product made under the old package name, keeping its price (D-318)', async () => {
    const strategist = OFFERS.find((offer) => offer.offer === 'strategist');
    const calls = fakePaddle([
      {
        id: 'pro_old',
        name: 'متردد · Hesitant',
        description: 'old',
        custom_data: { sbn_offer: 'standard', sbn_plan: 'standard' },
        prices: [
          {
            id: 'pri_old',
            status: 'active',
            billing_cycle: null,
            unit_price: { amount: String(strategist.amountCents), currency_code: 'USD' },
          },
        ],
      },
    ]);
    const result = await run({ key: SANDBOX_KEY, dryRun: false, log: quiet });
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch.path).toBe('/products/pro_old');
    expect(patch.body).toMatchObject({
      name: strategist.productName,
      custom_data: { sbn_offer: 'strategist', sbn_plan: 'strategist' },
    });
    expect(result.env.PADDLE_PRICE_STRATEGIST).toBe('pri_old');
  });

  it('only reports the rename in a dry run', async () => {
    const calls = fakePaddle([
      { id: 'pro_old', name: 'x', custom_data: { sbn_offer: 'adventurer' }, prices: [] },
    ]);
    const lines = [];
    await run({ key: SANDBOX_KEY, dryRun: true, log: (line) => lines.push(line) });
    expect(calls.map((call) => call.method)).toEqual(['GET']);
    expect(lines.join('\n')).toContain('would rename product pro_old');
  });

  it('stops on a product whose active price is not the planned one', async () => {
    fakePaddle([
      {
        id: 'pro_x',
        custom_data: { sbn_offer: 'strategist' },
        prices: [
          {
            id: 'pri_x',
            status: 'active',
            billing_cycle: null,
            unit_price: { amount: '900', currency_code: 'USD' },
          },
        ],
      },
    ]);
    const result = await run({ key: SANDBOX_KEY, dryRun: false, log: quiet });
    expect(result.problems).toBe(1);
  });
});
