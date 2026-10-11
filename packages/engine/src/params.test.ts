import { describe, expect, it } from 'vitest';
import { defaultFigure } from './figure';
import {
  DEFAULT_ENGINE_PARAMS,
  PARAM_KEYS,
  PAYMENT_OPTIONS,
  createEngineParams,
  listEngineParams,
  type EngineParamOverrides,
  type PaymentPart,
} from './params';
import { addRates, makeRate, parseRate, ZERO_RATE, ONE_RATE } from './rate';

const invalid = expect.objectContaining({ code: 'invalid_param' }) as Error;

describe('documented defaults', () => {
  const p = DEFAULT_ENGINE_PARAMS;

  it('has the values the decisions name', () => {
    expect(p.horizonMonths.value).toBe(36); // D-188
    expect(p.growthUpperBound.value).toEqual(parseRate('0.25')); // D-183
    expect(p.growthFounderShare.value).toEqual(makeRate(1n, 2n)); // D-183
    expect(p.growthYear3Share.value).toEqual(makeRate(1n, 2n)); // D-183
    expect(p.seasonalPeakFactor.value).toEqual(parseRate('1.5')); // D-184
    expect(p.conservativeSalesFactor.value).toEqual(parseRate('0.6')); // D-189
    expect(p.optimisticSalesFactor.value).toEqual(parseRate('1.3'));
    expect(p.conservativeVcFactor.value).toEqual(parseRate('1.1'));
    expect(p.optimisticVcFactor.value).toEqual(parseRate('0.95'));
    expect(p.conservativeLaunchDelayMonths.value).toBe(3);
    expect(p.inflationRate.value).toBeNull(); // D-185
    expect(p.penetrationFloorFactor.value).toEqual(parseRate('1.1')); // SPEC T7, D-206
    expect(p.ltvCacMinimum.value).toEqual(parseRate('3')); // SPEC T8
    expect(p.fxShocks.value).toEqual([
      parseRate('-0.2'),
      parseRate('-0.1'),
      parseRate('0.1'),
      parseRate('0.2'),
    ]); // SPEC T9, D-214
  });

  it('times the cash of each F7 option (D-187)', () => {
    const t = p.paymentTiming;
    expect(t.cash.value).toEqual([{ delayMonths: 0, share: ONE_RATE }]);
    expect(t.credit.value).toEqual([{ delayMonths: 1, share: ONE_RATE }]);
    expect(t.instalments.value.map((part) => part.delayMonths)).toEqual([0, 1, 2]);
    expect(
      t.instalments.value.every((part) => part.share.den === 3n && part.share.num === 1n),
    ).toBe(true);
    expect(t.deposit.value).toEqual([
      { delayMonths: 0, share: makeRate(1n, 2n) },
      { delayMonths: 1, share: makeRate(1n, 2n) },
    ]);
    expect(PAYMENT_OPTIONS).toEqual(['cash', 'credit', 'instalments', 'deposit']);
  });

  it('makes every default an unvalidated assumption with its own stable key', () => {
    const figures = listEngineParams(p);
    const keys = figures.map((figure) => figure.inputs[0]?.id);
    expect(keys).toEqual(Object.values(PARAM_KEYS));
    expect(new Set(keys).size).toBe(keys.length);
    for (const figure of figures) {
      expect(figure.source).toBe('assumption');
      expect(figure.validated).toBe(false);
      expect(figure.inputs).toHaveLength(1);
      expect(figure.inputs[0]?.kind).toBe('default');
    }
  });

  it('gives every payment option shares that add up to exactly one', () => {
    for (const option of PAYMENT_OPTIONS) {
      const total = p.paymentTiming[option].value.reduce(
        (sum, part) => addRates(sum, part.share),
        ZERO_RATE,
      );
      expect(total).toEqual(ONE_RATE);
    }
  });

  it('cannot be changed in place, at any depth', () => {
    expect(Object.isFrozen(DEFAULT_ENGINE_PARAMS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_ENGINE_PARAMS.horizonMonths)).toBe(true);
    expect(Object.isFrozen(DEFAULT_ENGINE_PARAMS.horizonMonths.inputs)).toBe(true);
    expect(Object.isFrozen(DEFAULT_ENGINE_PARAMS.growthUpperBound.value)).toBe(true);
    expect(Object.isFrozen(DEFAULT_ENGINE_PARAMS.paymentTiming.deposit.value)).toBe(true);
    expect(Object.isFrozen(DEFAULT_ENGINE_PARAMS.paymentTiming.deposit.value[0])).toBe(true);
    expect(Object.isFrozen(ZERO_RATE)).toBe(true);
    expect(Object.isFrozen(ONE_RATE)).toBe(true);
    const mutate = DEFAULT_ENGINE_PARAMS.paymentTiming.cash.value as PaymentPart[];
    expect(() => mutate.push({ delayMonths: 1, share: ONE_RATE })).toThrow(TypeError);
    expect(() => {
      (DEFAULT_ENGINE_PARAMS.horizonMonths as { value: number }).value = 12;
    }).toThrow(TypeError);
    expect(DEFAULT_ENGINE_PARAMS.horizonMonths.value).toBe(36);
  });

  it('gives each call its own, changeable objects', () => {
    expect(Object.isFrozen(createEngineParams())).toBe(false);
  });

  it('gives each call its own objects', () => {
    expect(createEngineParams()).toEqual(DEFAULT_ENGINE_PARAMS);
    expect(createEngineParams()).not.toBe(DEFAULT_ENGINE_PARAMS);
  });
});

describe('overrides', () => {
  it('replaces a figure with the caller provenance', () => {
    const inflation = {
      value: parseRate('0.03'),
      source: 'external',
      confidence: 'high',
      validated: true,
      inputs: [{ kind: 'country_pack_item', id: 'jo-inflation-2026' }],
    } as const;
    const params = createEngineParams({ inflationRate: inflation });
    expect(params.inflationRate).toBe(inflation);
    expect(params.growthUpperBound).toEqual(DEFAULT_ENGINE_PARAMS.growthUpperBound);
  });

  it('replaces one payment timing and keeps the others', () => {
    const cash = defaultFigure(PARAM_KEYS.paymentCash, [{ delayMonths: 0, share: ONE_RATE }]);
    const credit = defaultFigure(PARAM_KEYS.paymentCredit, [{ delayMonths: 2, share: ONE_RATE }]);
    const params = createEngineParams({ paymentTiming: { credit } });
    expect(params.paymentTiming.credit).toBe(credit);
    expect(params.paymentTiming.cash).toEqual(cash);
  });

  it('ignores an override that is undefined', () => {
    const params = createEngineParams({ horizonMonths: undefined, paymentTiming: undefined });
    expect(params).toEqual(DEFAULT_ENGINE_PARAMS);
    const timing = createEngineParams({ paymentTiming: { cash: undefined } });
    expect(timing).toEqual(DEFAULT_ENGINE_PARAMS);
  });

  it('accepts other FX shocks, down to -100% of the imported cost', () => {
    const shocks = defaultFigure('f', [parseRate('-1'), ZERO_RATE, parseRate('0.5')]);
    expect(createEngineParams({ fxShocks: shocks }).fxShocks).toBe(shocks);
  });

  it('accepts a longer horizon and mild deflation', () => {
    expect(createEngineParams({ horizonMonths: defaultFigure('h', 60) }).horizonMonths.value).toBe(
      60,
    );
    expect(() =>
      createEngineParams({ inflationRate: defaultFigure('i', parseRate('-0.02')) }),
    ).not.toThrow();
  });

  const timing = (...parts: [number, string][]) =>
    defaultFigure(
      't',
      parts.map(([delayMonths, share]) => ({ delayMonths, share: parseRate(share) })),
    );

  it.each<[string, EngineParamOverrides]>([
    ['a horizon that is not a multiple of 12', { horizonMonths: defaultFigure('h', 30) }],
    ['a horizon below a year', { horizonMonths: defaultFigure('h', 0) }],
    ['a horizon beyond 120 months', { horizonMonths: defaultFigure('h', 132) }],
    ['a fractional horizon', { horizonMonths: defaultFigure('h', 12.5) }],
    ['a negative growth bound', { growthUpperBound: defaultFigure('g', parseRate('-0.1')) }],
    ['a founder share above 1', { growthFounderShare: defaultFigure('g', parseRate('1.1')) }],
    ['a negative founder share', { growthFounderShare: defaultFigure('g', parseRate('-0.1')) }],
    ['a year 3 share above 1', { growthYear3Share: defaultFigure('g', parseRate('2')) }],
    ['a year 3 share below 0', { growthYear3Share: defaultFigure('g', parseRate('-1')) }],
    ['a peak factor below 1', { seasonalPeakFactor: defaultFigure('s', parseRate('0.9')) }],
    ['inflation of -100% or less', { inflationRate: defaultFigure('i', parseRate('-1')) }],
    ['a zero sales multiplier', { conservativeSalesFactor: defaultFigure('s', ZERO_RATE) }],
    ['a negative sales multiplier', { optimisticSalesFactor: defaultFigure('s', parseRate('-1')) }],
    ['a zero cost multiplier', { conservativeVcFactor: defaultFigure('s', ZERO_RATE) }],
    ['a negative cost multiplier', { optimisticVcFactor: defaultFigure('s', parseRate('-1')) }],
    [
      'a penetration factor below 1',
      { penetrationFloorFactor: defaultFigure('p', parseRate('0.9')) },
    ],
    ['a zero LTV / CAC minimum', { ltvCacMinimum: defaultFigure('l', ZERO_RATE) }],
    ['a negative LTV / CAC minimum', { ltvCacMinimum: defaultFigure('l', parseRate('-3')) }],
    ['no FX shock at all', { fxShocks: defaultFigure('f', []) }],
    ['an FX shock below -100%', { fxShocks: defaultFigure('f', [parseRate('-1.1')]) }],
    [
      'more than ten FX shocks',
      {
        fxShocks: defaultFigure(
          'f',
          Array.from({ length: 11 }, () => parseRate('0.1')),
        ),
      },
    ],
    [
      'an FX shock that was not built with makeRate',
      { fxShocks: defaultFigure('f', [{ num: 2n, den: 4n }]) },
    ],
    ['a negative launch delay', { conservativeLaunchDelayMonths: defaultFigure('d', -1) }],
    ['a fractional launch delay', { conservativeLaunchDelayMonths: defaultFigure('d', 1.5) }],
    ['a launch delay beyond 120', { conservativeLaunchDelayMonths: defaultFigure('d', 121) }],
    ['a payment timing with no parts', { paymentTiming: { cash: timing() } }],
    ['shares that add up to less than 1', { paymentTiming: { credit: timing([0, '0.5']) } }],
    [
      'shares that add up to more than 1',
      { paymentTiming: { deposit: timing([0, '0.6'], [1, '0.6']) } },
    ],
    ['a negative delay', { paymentTiming: { instalments: timing([-1, '1']) } }],
    ['a fractional delay', { paymentTiming: { cash: timing([0.5, '1']) } }],
    ['a delay beyond 36 months', { paymentTiming: { cash: timing([37, '1']) } }],
    ['a negative share', { paymentTiming: { cash: timing([0, '2'], [1, '-1']) } }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => createEngineParams(overrides)).toThrow(invalid);
  });

  it('rejects a rate that was not built with makeRate', () => {
    const notLowest = { num: 2n, den: 4n };
    const negativeDen = { num: -1n, den: -2n };
    const zeroDen = { num: 1n, den: 0n };
    const unsafe = { num: 1, den: 2 } as unknown as typeof ONE_RATE;
    for (const bad of [notLowest, negativeDen, zeroDen, unsafe]) {
      expect(() => createEngineParams({ growthUpperBound: defaultFigure('g', bad) })).toThrow(
        invalid,
      );
      expect(() => createEngineParams({ inflationRate: defaultFigure('i', bad) })).toThrow(invalid);
      expect(() =>
        createEngineParams({
          paymentTiming: { cash: defaultFigure('c', [{ delayMonths: 0, share: bad }]) },
        }),
      ).toThrow(invalid);
    }
    expect(() =>
      createEngineParams({ optimisticVcFactor: defaultFigure('v', negativeDen) }),
    ).toThrow(/optimistic\.vc_factor/);
  });

  it('rejects a key it does not know, so a misspelt override is not silently ignored', () => {
    const untyped = (value: object) => value as EngineParamOverrides;
    expect(() => createEngineParams(untyped({ horizonMonth: defaultFigure('h', 24) }))).toThrow(
      /horizonMonth/,
    );
    expect(() =>
      createEngineParams(untyped({ paymentTiming: { cheque: timing([0, '1']) } })),
    ).toThrow(invalid);
    expect(() => createEngineParams(untyped({ growthUpperBound: undefined }))).not.toThrow();
  });

  it('names the key of the parameter in the message', () => {
    expect(() => createEngineParams({ horizonMonths: defaultFigure('h', 30) })).toThrow(
      /engine\.horizon_months/,
    );
  });
});
