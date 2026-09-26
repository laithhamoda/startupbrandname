import { describe, expect, it } from 'vitest';
import { closedCountries } from './markets';

describe('closedCountries', () => {
  it('closes nothing while Algeria is open', () => {
    expect(closedCountries({ MARKET_DZ_ENABLED: true })).toEqual([]);
  });

  it('closes Algeria when its switch is off', () => {
    expect(closedCountries({ MARKET_DZ_ENABLED: false })).toEqual(['DZ']);
  });
});
