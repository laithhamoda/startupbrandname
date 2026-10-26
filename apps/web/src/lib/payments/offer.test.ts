import { describe, expect, it } from 'vitest';
import { isPurchasable, offerFor, priceRowsOf } from './offer';
import { priceResolver } from './webhook';

const PRICES = { strategist: 'pri_std', commander: 'pri_adv', upgrade: 'pri_up' };

describe('offerFor (D-313)', () => {
  it('sells each package at its full price to a free account', () => {
    expect(offerFor('free', 'strategist', PRICES)).toEqual({
      status: 'offer',
      planId: 'strategist',
      priceId: 'pri_std',
      priceUsd: 10,
      upgrade: false,
    });
    expect(offerFor('free', 'commander', PRICES)).toMatchObject({
      priceId: 'pri_adv',
      priceUsd: 30,
    });
  });

  it('moves «استراتيجي» up to «قائد» at the difference', () => {
    expect(offerFor('strategist', 'commander', PRICES)).toEqual({
      status: 'offer',
      planId: 'commander',
      priceId: 'pri_up',
      priceUsd: 20,
      upgrade: true,
    });
  });

  it('sells nothing an account already has or exceeds', () => {
    expect(offerFor('strategist', 'strategist', PRICES)).toEqual({ status: 'owned' });
    expect(offerFor('commander', 'strategist', PRICES)).toEqual({ status: 'owned' });
    expect(offerFor('course', 'strategist', PRICES)).toEqual({ status: 'owned' });
  });

  it('moves a course voucher up to «قائد» at the difference, like «استراتيجي» (D-319)', () => {
    expect(offerFor('course', 'commander', PRICES)).toEqual({
      status: 'offer',
      planId: 'commander',
      priceId: 'pri_up',
      priceUsd: 20,
      upgrade: true,
    });
  });

  it('knows which packages can be bought', () => {
    expect(['strategist', 'commander', 'free', 'course', 'x'].map(isPurchasable)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it('gives the webhook a plan for every price, the upgrade selling «قائد» for a year', () => {
    const resolve = priceResolver(priceRowsOf(PRICES));
    expect(resolve('pri_std')).toEqual({ planId: 'strategist', oneTimeDays: 365 });
    expect(resolve('pri_adv')).toEqual({ planId: 'commander', oneTimeDays: 365 });
    expect(resolve('pri_up')).toEqual({ planId: 'commander', oneTimeDays: 365 });
  });
});
