import type { Answers } from '@sbn/question-bank';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyseEconomics } from './economics';
import { engineInputFrom, type EngineInput } from './input';
import { projectOperatingLines } from './projection';

// Each run explores new random cases. A failure prints its seed and path: replay it with
// fc.assert(property, { seed, path }), then keep the case as an example test in economics.test.ts.

/** Amounts are drawn as whole fils (JOD has three decimals) and read back as JOD. */
const jod = (fils: number) => ({ amount: fils / 1000, currency: 'JOD' });

interface Scene {
  readonly price: number;
  readonly variableCost: number;
  readonly fixedCost: number;
  readonly month1: number;
  readonly month6: number;
  readonly month12: number;
}

const scene: fc.Arbitrary<Scene> = fc.record({
  price: fc.integer({ min: 0, max: 5_000_000 }),
  variableCost: fc.integer({ min: 0, max: 5_000_000 }),
  fixedCost: fc.integer({ min: 0, max: 500_000_000 }),
  month1: fc.integer({ min: 0, max: 500 }),
  month6: fc.integer({ min: 0, max: 800 }),
  month12: fc.integer({ min: 0, max: 1500 }),
});

const competitorPrices = fc.array(
  fc.option(fc.integer({ min: 1, max: 5_000_000 }), { nil: null }),
  {
    maxLength: 8,
  },
);

function build(drawn: Scene, d4: readonly (number | null)[] = []): EngineInput {
  const answers: Answers = {
    F1: { status: 'answered', value: jod(drawn.price) },
    F3: {
      status: 'answered',
      value: { items: [{ label: 'Materials', ...jod(drawn.variableCost) }] },
    },
    F4: { status: 'answered', value: { items: [{ label: 'Rent', ...jod(drawn.fixedCost) }] } },
    F6: {
      status: 'answered',
      value: { month1: drawn.month1, month6: drawn.month6, month12: drawn.month12 },
    },
    D4: {
      status: 'answered',
      value: {
        items: d4.map((price, index) => ({
          name: `C${String(index)}`,
          price: price === null ? null : jod(price),
        })),
      },
    },
  };
  const result = engineInputFrom(
    answers,
    {},
    {
      country: 'JO',
      currency: 'JOD',
      mode: 'full',
      referenceDate: '2026-10-05',
    },
  );
  if (result.status !== 'ok') throw new Error(JSON.stringify(result.reasons));
  return result.input;
}

describe('T8 break-even units cover the fixed cost and no fewer do', () => {
  it('has BE_units x CM at least FC, and one unit fewer below it', () => {
    fc.assert(
      fc.property(
        scene.filter((drawn) => drawn.price > drawn.variableCost),
        (drawn) => {
          const input = build(drawn);
          const { unitEconomics } = analyseEconomics(input, projectOperatingLines(input));
          expect(unitEconomics.status).toBe('ok');
          if (unitEconomics.status !== 'ok') return;
          const cm = unitEconomics.contributionMargin.value.minor;
          const fixed = unitEconomics.fixedCost.value.minor;
          const units = unitEconomics.breakEvenUnits.value;
          expect(units * cm).toBeGreaterThanOrEqual(fixed);
          if (units > 0n) expect((units - 1n) * cm).toBeLessThan(fixed);
          // BE_rev is FC x P / CM, off by at most half a minor unit.
          const revenue = unitEconomics.breakEvenRevenue.value.minor;
          const price = input.price.value.minor;
          const error = (revenue * cm - fixed * price) * 2n;
          expect((error < 0n ? -error : error) <= cm).toBe(true);
        },
      ),
    );
  });

  it('blocks exactly when the contribution margin is zero or negative', () => {
    fc.assert(
      fc.property(scene, (drawn) => {
        const input = build(drawn);
        const { unitEconomics, alerts } = analyseEconomics(input, projectOperatingLines(input));
        const blocked = drawn.price <= drawn.variableCost;
        expect(unitEconomics.status).toBe(blocked ? 'blocked' : 'ok');
        expect(alerts.some((alert) => alert.code === 'cm_not_positive')).toBe(blocked);
      }),
    );
  });
});

describe('T7 floor and band', () => {
  it('never puts the floor below the variable cost', () => {
    fc.assert(
      fc.property(scene, (drawn) => {
        const input = build(drawn);
        const { pricing } = analyseEconomics(input, projectOperatingLines(input));
        if (pricing.floor !== null) {
          expect(pricing.floor.value.minor).toBeGreaterThanOrEqual(input.variableCost.value.minor);
        }
      }),
    );
  });

  it('raises the price alert exactly when F1 is below the floor', () => {
    fc.assert(
      fc.property(scene, (drawn) => {
        const input = build(drawn);
        const { pricing, alerts } = analyseEconomics(input, projectOperatingLines(input));
        const below = pricing.floor !== null && input.price.value.minor < pricing.floor.value.minor;
        expect(alerts.some((alert) => alert.code === 'price_below_floor')).toBe(below);
      }),
    );
  });

  it('keeps the band in order, the market inside it, and the penetration at least the cheapest price', () => {
    fc.assert(
      fc.property(scene, competitorPrices, (drawn, d4) => {
        const input = build(drawn, d4);
        const { pricing } = analyseEconomics(input, projectOperatingLines(input), {
          premiumAllowed: true,
        });
        const known = d4.filter((price): price is number => price !== null);
        if (known.length === 0) {
          expect(pricing.band).toBeNull();
          expect(pricing.market).toBeNull();
          expect(pricing.penetration).toBeNull();
          expect(pricing.premium).toBeNull();
          return;
        }
        const band = pricing.band?.value;
        expect(band).toBeDefined();
        if (!band || !pricing.market) return;
        expect(band.min.minor).toBeLessThanOrEqual(band.median.minor);
        expect(band.median.minor).toBeLessThanOrEqual(band.max.minor);
        expect(band.min.minor).toBe(BigInt(Math.min(...known)));
        expect(band.max.minor).toBe(BigInt(Math.max(...known)));
        expect(pricing.market.value).toEqual(band.median);
        expect(pricing.premium?.value).toEqual(band.max);
        if (pricing.penetration !== null) {
          expect(pricing.penetration.value.minor).toBeGreaterThanOrEqual(band.min.minor);
          if (pricing.floor !== null) {
            expect(pricing.penetration.value.minor).toBeGreaterThanOrEqual(
              pricing.floor.value.minor,
            );
          }
        }
      }),
    );
  });
});

describe('the analysis is a pure function of its input', () => {
  it('gives equal results for equal inputs, and does not change the input', () => {
    fc.assert(
      fc.property(scene, competitorPrices, (drawn, d4) => {
        const input = build(drawn, d4);
        const projection = projectOperatingLines(input);
        const before = JSON.stringify(projection, (_key, value: unknown) =>
          typeof value === 'bigint' ? value.toString() : value,
        );
        const first = analyseEconomics(input, projection);
        const second = analyseEconomics(build(drawn, d4), projectOperatingLines(build(drawn, d4)));
        expect(second).toEqual(first);
        const after = JSON.stringify(projection, (_key, value: unknown) =>
          typeof value === 'bigint' ? value.toString() : value,
        );
        expect(after).toBe(before);
      }),
    );
  });
});
