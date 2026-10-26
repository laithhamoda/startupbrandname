import { describe, expect, it } from 'vitest';
import { isPurchasable, offerFor, priceRowsOf } from './offer';
import { priceResolver } from './webhook';

const PRICES = { standard: 'pri_std', adventurer: 'pri_adv', upgrade: 'pri_up' };

describe('offerFor (D-313)', () => {
  it('sells each package at its full price to a free account', () => {
    expect(offerFor('free', 'standard', PRICES)).toEqual({
      status: 'offer',
      planId: 'standard',
      priceId: 'pri_std',
      priceUsd: 10,
      upgrade: false,
    });
    expect(offerFor('free', 'adventurer', PRICES)).toMatchObject({
      priceId: 'pri_adv',
      priceUsd: 30,
    });
  });

  it('moves «متردد» up to «المغامر» at the difference', () => {
    expect(offerFor('standard', 'adventurer', PRICES)).toEqual({
      status: 'offer',
      planId: 'adventurer',
      priceId: 'pri_up',
      priceUsd: 20,
      upgrade: true,
    });
  });

  it('sells nothing an account already has or exceeds', () => {
    expect(offerFor('standard', 'standard', PRICES)).toEqual({ status: 'owned' });
    expect(offerFor('adventurer', 'standard', PRICES)).toEqual({ status: 'owned' });
    expect(offerFor('course', 'adventurer', PRICES)).toEqual({ status: 'owned' });
  });

  it('knows which packages can be bought', () => {
    expect(['standard', 'adventurer', 'free', 'course', 'x'].map(isPurchasable)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it('gives the webhook a plan for every price, the upgrade selling «المغامر» for a year', () => {
    const resolve = priceResolver(priceRowsOf(PRICES));
    expect(resolve('pri_std')).toEqual({ planId: 'standard', oneTimeDays: 365 });
    expect(resolve('pri_adv')).toEqual({ planId: 'adventurer', oneTimeDays: 365 });
    expect(resolve('pri_up')).toEqual({ planId: 'adventurer', oneTimeDays: 365 });
  });
});
