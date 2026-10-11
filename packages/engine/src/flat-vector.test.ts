import { describe, expect, it } from 'vitest';
import { flatAnswers, flatProvenance, FLAT_CONTEXT, jodItems, real, runFlat } from './flat-vector';

describe('the flat vector', () => {
  it('is the vector of the T10 tests: 400 units at 10, a variable cost of 4, fixed costs of 1,000', () => {
    const run = runFlat();
    expect(run.input.price.value.minor).toBe(10_000n);
    expect(run.input.variableCost.value.minor).toBe(4_000n);
    expect(run.input.fixedCosts.value.minor).toBe(1_000_000n);
    expect(run.input.setupCosts?.value.minor).toBe(3_000_000n);
    expect(run.projection.operatingProfit.monthly[0]?.minor).toBe(1_400_000n);
    expect(FLAT_CONTEXT.currency).toBe('JOD');
  });

  it('replaces any answer and lowers the stored confidence of the five pivotal ones', () => {
    expect(flatAnswers({ F3: real(jodItems(['M', 5])) }).F3).toEqual(real(jodItems(['M', 5])));
    expect(flatProvenance({ F1: 'low' }).F1?.confidence).toBe('low');
    expect(flatProvenance({ F1: 'low' }).F3?.confidence).toBe('high');
    expect(flatProvenance({}, 'medium').F6?.confidence).toBe('medium');
  });

  it('stops with the reasons when the answers cannot be calculated', () => {
    expect(() => runFlat({ F1: real({ amount: 10, currency: 'JOD' }) })).toThrow(/not calculable/);
  });
});
