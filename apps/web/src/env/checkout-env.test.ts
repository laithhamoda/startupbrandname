import { describe, expect, it } from 'vitest';
import {
  getCheckoutEnv,
  getMentorPackCheckout,
  getMentorPackPrice,
  getPaddlePrices,
} from './server';

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

describe('the mentor pack checkout (D-322)', () => {
  const PACK = {
    ...PRICES,
    PADDLE_CLIENT_TOKEN: 'test_abc',
    PADDLE_PRICE_MENTOR_PACK: 'pri_01pack',
  };

  it('reads the pack price whenever it is set, for the webhook', () => {
    expect(getMentorPackPrice(PACK)).toBe('pri_01pack');
    expect(getMentorPackPrice({ PADDLE_PRICE_MENTOR_PACK: 'pro_01product' })).toBeNull();
    expect(getMentorPackPrice({})).toBeNull();
  });

  it('is on sale only while MENTOR_PACK_ENABLED is true and the checkout and price are set', () => {
    expect(getMentorPackCheckout(PACK)).toBeNull();
    expect(getMentorPackCheckout({ ...PACK, MENTOR_PACK_ENABLED: 'yes' })).toBeNull();
    expect(getMentorPackCheckout({ ...PACK, MENTOR_PACK_ENABLED: 'true' })).toEqual({
      clientToken: 'test_abc',
      environment: 'sandbox',
      priceId: 'pri_01pack',
    });
    expect(
      getMentorPackCheckout({ ...PACK, MENTOR_PACK_ENABLED: 'true', PADDLE_PRICE_MENTOR_PACK: '' }),
    ).toBeNull();
    expect(
      getMentorPackCheckout({
        PADDLE_PRICE_MENTOR_PACK: 'pri_01pack',
        MENTOR_PACK_ENABLED: 'true',
      }),
    ).toBeNull();
  });
});
