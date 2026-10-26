import { describe, expect, it } from 'vitest';
import { getCheckoutEnv, getPaddlePrices } from './server';

const PRICES = {
  PADDLE_PRICE_STRATEGIST: 'pri_01standard',
  PADDLE_PRICE_COMMANDER: 'pri_01commander',
  PADDLE_PRICE_UPGRADE: 'pri_01upgrade',
};

describe('getCheckoutEnv (D-317)', () => {
  it('is closed until the token and the three prices are set', () => {
    expect(getCheckoutEnv({})).toBeNull();
    expect(getCheckoutEnv({ PADDLE_CLIENT_TOKEN: 'test_abc' })).toBeNull();
    expect(getCheckoutEnv(PRICES)).toBeNull();
  });

  it('reads the sandbox from a test_ token and the live account from a live_ one', () => {
    expect(getCheckoutEnv({ ...PRICES, PADDLE_CLIENT_TOKEN: 'test_abc' })).toEqual({
      clientToken: 'test_abc',
      environment: 'sandbox',
      prices: {
        strategist: 'pri_01standard',
        commander: 'pri_01commander',
        upgrade: 'pri_01upgrade',
      },
    });
    expect(getCheckoutEnv({ ...PRICES, PADDLE_CLIENT_TOKEN: 'live_abc' })?.environment).toBe(
      'production',
    );
  });

  it('refuses a token or a price that is not one', () => {
    expect(getCheckoutEnv({ ...PRICES, PADDLE_CLIENT_TOKEN: 'pdl_secret_key' })).toBeNull();
    expect(getPaddlePrices({ ...PRICES, PADDLE_PRICE_UPGRADE: 'pro_01product' })).toBeNull();
  });
});
