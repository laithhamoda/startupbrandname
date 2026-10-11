import type { Answers } from '@sbn/question-bank';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AlertCode } from './alerts';
import type { CriterionId } from './feasibility';
import { flatAnswers, runFlat, real } from './flat-vector';
import { compareRates } from './rate';
import type { EngineRun } from './run';
import type { Verdict } from './verdict';

/*
 * Properties of the feasibility score and the verdict (D-227). The generator is fixed: the same
 * seed draws the same projects on every machine, so a failure is a real counterexample and the
 * test cannot flake. A failure prints the seed and the path; replay it with
 * fc.assert(property, { seed, path }) and keep the case as an example test.
 *
 * A scene is a project of the flat vector (a Jordanian project in dinars, before tax, no season,
 * F6.2 stated as 0 so the growth after year 1 does not depend on the points) whose
 *  - price is 1 to 50 JOD and the variable cost is 0 up to one fil below the price (so the
 *    contribution margin is positive: improving a project that loses on every unit by selling more
 *    makes it lose more, which is true and outside the claim),
 *  - fixed costs are 100 to 5,000 JOD a month, set-up costs 0 to 20,000 JOD,
 *  - sales are 0 to 300, 0 to 600 and 1 to 1,000 units in months 1, 6 and 12,
 *  - capital A5 is a range ending at up to 30,000 JOD, A7 and H5 are any of their options,
 *    E7 is missing or 50 to 2,000 units, F7 is any option and H3 is any non-empty subset.
 * It is not a subscription, so LTV / CAC is never evaluated, and it always has units in year 1,
 * so every other criterion is evaluated in every scene and the count of evaluated criteria does
 * not change between a scene and its improvement.
 *
 * An improvement is a higher price, a lower variable cost, lower fixed costs (each by any amount,
 * down to the limits above) or higher sales, all three points multiplied by 1 to 5. Two things
 * that look like improvements are not, and this test found both (D-248):
 *  - With a late-paying customer (F7 = credit, instalments or deposit) more sales need more
 *    working capital, because the variable cost is paid before the cash arrives: on a thin margin
 *    the funding need, and with it a criterion and perhaps the verdict, get worse as sales rise.
 *    Higher sales are therefore checked with cash on sale.
 *  - The curve between the points of F6 is geometric, and linear only when month 1 is zero (a
 *    ratio to zero does not exist). Raising month 1 from 0 to 4 turns a linear ramp into a
 *    geometric one that is far lower in months 2 to 5, so the break-even can move later.
 *    Multiplying all three points keeps the shape, and only that is claimed.
 */

const jod = (fils: number) => ({ amount: fils / 1000, currency: 'JOD' });
const items = (label: string, fils: number) => ({ items: [{ label, ...jod(fils) }] });

interface Scene {
  readonly price: number;
  readonly variableCost: number;
  readonly fixedCosts: number;
  readonly setup: number;
  readonly sales: readonly [number, number, number];
  readonly capital: readonly [number, number];
  readonly runway: string;
  readonly target: string;
  readonly capacity: number | null;
  readonly payment: string;
  readonly financing: readonly string[];
}

const priceAndCost = fc
  .integer({ min: 1_000, max: 50_000 })
  .chain((price) =>
    fc.record({ price: fc.constant(price), variableCost: fc.integer({ min: 0, max: price - 1 }) }),
  );

const scene: fc.Arbitrary<Scene> = fc
  .record({
    cost: priceAndCost,
    fixedCosts: fc.integer({ min: 100_000, max: 5_000_000 }),
    setup: fc.integer({ min: 0, max: 20_000_000 }),
    sales: fc.tuple(
      fc.integer({ min: 0, max: 300 }),
      fc.integer({ min: 0, max: 600 }),
      fc.integer({ min: 1, max: 1_000 }),
    ),
    capital: fc
      .tuple(fc.integer({ min: 0, max: 30_000_000 }), fc.integer({ min: 0, max: 30_000_000 }))
      .map(([a, b]): readonly [number, number] => (a <= b ? [a, b] : [b, a])),
    runway: fc.constantFrom('lt3', '3to6', '6to12', 'gt12'),
    target: fc.constantFrom('m6', 'm12', 'm18', 'm24', 'm36', 'more'),
    capacity: fc.option(fc.integer({ min: 50, max: 2_000 }), { nil: null }),
    payment: fc.constantFrom('cash', 'credit', 'instalments', 'deposit'),
    financing: fc.subarray(['self', 'family', 'loan', 'investor', 'grant', 'competition'], {
      minLength: 1,
    }),
  })
  .map(({ cost, ...rest }): Scene => ({
    price: cost.price,
    variableCost: cost.variableCost,
    ...rest,
  }));

function answersOf(drawn: Scene): Answers {
  const [month1, month6, month12] = drawn.sales;
  return flatAnswers({
    F1: real(jod(drawn.price)),
    F3: real(items('Materials', drawn.variableCost)),
    F4: real(items('Rent', drawn.fixedCosts)),
    F5: real(items('Set-up', drawn.setup)),
    F6: real({ month1, month6, month12 }),
    'F6.2': real(0),
    A5: real({ min: drawn.capital[0] / 1000, max: drawn.capital[1] / 1000, currency: 'JOD' }),
    A7: real(drawn.runway),
    H5: real(drawn.target),
    E7: drawn.capacity === null ? { status: 'unknown' } : real(drawn.capacity),
    F7: real(drawn.payment),
    H3: real({ values: drawn.financing }),
  });
}

const run = (drawn: Scene): EngineRun => runFlat(answersOf(drawn));

const RANK: Readonly<Record<Verdict, number>> = { stop: 0, revise: 1, go: 2 };

/** A way to improve a scene, and whether it is only meant for cash on sale. */
interface Improvement {
  readonly apply: (drawn: Scene) => Scene;
  readonly cashOnly: boolean;
}

const improvement: fc.Arbitrary<Improvement> = fc.oneof(
  fc.integer({ min: 0, max: 20_000 }).map((raise): Improvement => ({
    apply: (drawn) => ({ ...drawn, price: drawn.price + raise }),
    cashOnly: false,
  })),
  fc.integer({ min: 0, max: 20_000 }).map((cut): Improvement => ({
    apply: (drawn) => ({ ...drawn, variableCost: Math.max(0, drawn.variableCost - cut) }),
    cashOnly: false,
  })),
  fc.integer({ min: 0, max: 5_000_000 }).map((cut): Improvement => ({
    apply: (drawn) => ({ ...drawn, fixedCosts: Math.max(1, drawn.fixedCosts - cut) }),
    cashOnly: false,
  })),
  fc.integer({ min: 1, max: 5 }).map((factor): Improvement => ({
    apply: (drawn) => ({
      ...drawn,
      sales: [drawn.sales[0] * factor, drawn.sales[1] * factor, drawn.sales[2] * factor],
    }),
    cashOnly: true,
  })),
);

const PARAMETERS = { seed: 20_261_012, numRuns: 150 } as const;

describe('improving a project never worsens its score or its verdict', () => {
  it('holds for a higher price, a lower variable cost, lower fixed costs or higher sales', () => {
    fc.assert(
      fc.property(scene, improvement, (drawn, improve) => {
        const start: Scene = improve.cashOnly ? { ...drawn, payment: 'cash' } : drawn;
        const before = run(start);
        const after = run(improve.apply(start));
        expect(after.feasibility.evaluated).toBe(before.feasibility.evaluated);
        expect(after.feasibility.passed).toBeGreaterThanOrEqual(before.feasibility.passed);
        const [b, a] = [before.feasibility.score, after.feasibility.score];
        expect(a === null || b === null ? false : compareRates(a.value, b.value) >= 0).toBe(true);
        expect(RANK[after.verdict.verdict.value]).toBeGreaterThanOrEqual(
          RANK[before.verdict.verdict.value],
        );
        expect(after.verdict.blockers.length).toBeLessThanOrEqual(before.verdict.blockers.length);
      }),
      PARAMETERS,
    );
  });
});

/** The criterion each alert of T8 and T7 corresponds to: when the alert is raised it must fail. */
const CRITERION_OF_ALERT: Partial<Record<AlertCode, CriterionId>> = {
  cm_not_positive: 'margin_positive',
  break_even_units_above_capacity: 'break_even_units_within_capacity',
  break_even_month_above_target: 'break_even_within_target',
  break_even_month_above_runway: 'break_even_within_runway',
  setup_costs_above_capital: 'setup_within_capital',
  price_below_floor: 'price_above_floor',
};

describe('the verdict cannot disagree with an alert', () => {
  it('fails the criterion of every alert that is raised, and stops on a blocker', () => {
    // Any price, including one at or under the variable cost, so the margin alert is drawn too.
    const wide = scene.chain((drawn) =>
      fc.integer({ min: 0, max: 50_000 }).map((price): Scene => ({ ...drawn, price })),
    );
    fc.assert(
      fc.property(wide, (drawn) => {
        const result = run(drawn);
        const status = new Map(result.feasibility.criteria.map((c) => [c.id, c.status]));
        for (const alert of result.alerts) {
          if (alert.origin !== 'economics') continue;
          const id = CRITERION_OF_ALERT[alert.code];
          if (id !== undefined) expect(status.get(id), alert.code).toBe('fail');
        }
        expect(result.verdict.verdict.value === 'stop').toBe(result.verdict.blockers.length > 0);
        if (result.verdict.verdict.value === 'go') expect(result.verdict.holdBacks).toEqual([]);
      }),
      PARAMETERS,
    );
  });

  it('fails the margin criterion exactly when the margin alert is raised', () => {
    fc.assert(
      fc.property(scene, fc.integer({ min: 0, max: 60_000 }), (drawn, cost) => {
        const result = run({ ...drawn, variableCost: cost });
        const margin = result.feasibility.criteria.find((c) => c.id === 'margin_positive');
        const alert = result.alerts.some((a) => a.code === 'cm_not_positive');
        expect(margin?.status === 'fail').toBe(alert);
      }),
      PARAMETERS,
    );
  });
});

describe('two things that look like improvements are not (D-248)', () => {
  const scaled = (drawn: Scene, factor: number): Scene => ({
    ...drawn,
    sales: [drawn.sales[0] * factor, drawn.sales[1] * factor, drawn.sales[2] * factor],
  });

  // Found by the property above with seed 11: a thin margin (47.426 against 45.427) and customers
  // who pay a month late. Selling three times as much needs 38,068 JOD of cash instead of 19,934,
  // which is more than the capital, so the verdict goes from go to revise.
  it('more sales can need more funding when the customer pays late', () => {
    const thin: Scene = {
      price: 47_426,
      variableCost: 45_427,
      fixedCosts: 100_003,
      setup: 10_265_105,
      sales: [15, 212, 131],
      capital: [6_933_672, 29_999_981],
      runway: '3to6',
      target: 'm6',
      capacity: 1_351,
      payment: 'credit',
      financing: ['loan', 'grant'],
    };
    const need = (drawn: Scene): bigint | null => {
      const flow = run(drawn).cash.cashFlow;
      return flow.status === 'ok' ? flow.fundingNeed.value.minor : null;
    };
    expect(need(thin)).toBe(19_933_928n);
    expect(need(scaled(thin, 3))).toBe(38_067_540n);
    expect(run(thin).verdict.verdict.value).toBe('go');
    expect(run(scaled(thin, 3)).verdict.verdict.value).toBe('revise');
    expect(need({ ...scaled(thin, 3), payment: 'cash' })).toBeLessThan(19_933_928n);
  });

  // Found with seed 3333: the curve between the points of F6 is linear when month 1 is zero and
  // geometric otherwise, so one more unit in month 1 makes months 2 to 5 far lower.
  it('raising month 1 from zero turns a linear ramp into a geometric one', () => {
    const ramp: Scene = {
      price: 49_991,
      variableCost: 6_411,
      fixedCosts: 2_759_297,
      setup: 6_957_272,
      sales: [0, 558, 995],
      capital: [21_794_000, 29_999_984],
      runway: 'lt3',
      target: 'more',
      capacity: null,
      payment: 'cash',
      financing: ['self', 'loan'],
    };
    const first = (drawn: Scene) => run(drawn).projection.units.monthly.slice(0, 5).map(Number);
    const breakEven = (drawn: Scene): number | null => {
      const result = run(drawn);
      return result.unitEconomics.status === 'ok'
        ? result.unitEconomics.breakEvenMonth.value
        : null;
    };
    expect(first(ramp)).toEqual([0, 112, 223, 335, 446]);
    expect(breakEven(ramp)).toBe(2);
    expect(first({ ...ramp, sales: [1, 558, 995] })).toEqual([1, 4, 13, 44, 158]);
    expect(breakEven({ ...ramp, sales: [1, 558, 995] })).toBe(5);
    // Multiplying all three points keeps the shape, so the break-even does not move later.
    expect(breakEven(scaled(ramp, 2))).toBeLessThanOrEqual(2);
  });
});
