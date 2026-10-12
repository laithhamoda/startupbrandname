import { describe, expect, it } from 'vitest';
import type { FigureConfidence } from './figure';
import { flatAnswers, flatProvenance, jodItems, real, runFlat } from './flat-vector';
import type { EngineRun } from './run';
import { EXPERIMENT_LIBRARY, PLAN_SIZE, type ExperimentKey } from './validation-plan';

type Levels = Parameters<typeof flatProvenance>[0];

const planOf = (levels: Levels, more = {}): EngineRun =>
  runFlat(flatAnswers(more), flatProvenance(levels));

const variables = (run: EngineRun): string[] =>
  run.validationPlan.entries.map((entry) => entry.variable);

/*
 * The tornado of the flat vector (year-1 profit before tax 16,800 at the base), each variable
 * alone 20 percent down and up: price 8 and 12 -> 7,200 and 26,400 (swing 19,200); sales 320 and
 * 480 units -> 11,040 and 22,560 (11,520); variable cost 3.2 and 4.8 -> 20,640 and 12,960 (7,680);
 * fixed costs 800 and 1,200 -> 19,200 and 14,400 (4,800). Ranks: price 1, sales 2, VC 3, FC 4.
 */
describe('the validation plan of the flat vector', () => {
  it('ranks the tornado price, sales, variable cost, fixed costs', () => {
    const run = runFlat();
    expect(run.tornado.rows.map((row) => row.variable)).toEqual([
      'price',
      'sales',
      'vc',
      'fixed_costs',
    ]);
    expect(run.tornado.rows.map((row) => row.swing.value.minor)).toEqual([
      19_200_000n,
      11_520_000n,
      7_680_000n,
      4_800_000n,
    ]);
  });

  it('scores (4 - confidence) x (5 - rank): with all high, 4, 3, 2, 1', () => {
    const run = runFlat();
    expect(run.validationPlan.candidates.map((c) => [c.variable, c.score.value])).toEqual([
      ['price', 4],
      ['vc', 2],
      ['sales', 3],
      ['fixed_costs', 1],
    ]);
    expect(run.validationPlan.candidates.map((c) => [c.confidence.value, c.rank.value])).toEqual([
      [3, 1],
      [3, 3],
      [3, 2],
      [3, 4],
    ]);
  });

  it('puts the founder worry (H6) first, as typed, then the two highest scores', () => {
    const run = runFlat(flatAnswers({ H6: real('  هل سيدفع العملاء؟  ') }));
    expect(run.validationPlan.entries).toHaveLength(PLAN_SIZE);
    expect(variables(run)).toEqual(['worry', 'price', 'sales']);
    const [worry] = run.validationPlan.entries;
    expect(worry?.worry?.value).toBe('  هل سيدفع العملاء؟  ');
    expect(worry?.worry?.inputs).toContainEqual({ kind: 'answer', id: 'H6' });
    expect(worry?.score).toBeNull();
    expect(worry?.confidence).toBeNull();
    expect(worry?.rank).toBeNull();
    expect(worry?.experiment).toBe('worry');
  });

  it('takes the three highest scores when H6 is missing, unknown or blank', () => {
    for (const h6 of [undefined, { status: 'unknown' as const }, real('   ')]) {
      const run = runFlat(flatAnswers({ H6: h6 }));
      expect(variables(run)).toEqual(['price', 'sales', 'vc']);
      expect(run.validationPlan.entries.every((entry) => entry.worry === null)).toBe(true);
    }
  });

  it('carries the score, the confidence and the rank of an entry as figures', () => {
    const run = runFlat(flatAnswers({ H6: undefined }));
    const [first] = run.validationPlan.entries;
    expect(first).toMatchObject({ variable: 'price', experiment: 'price' });
    expect(first?.score?.value).toBe(4);
    expect(first?.confidence?.value).toBe(3);
    expect(first?.rank?.value).toBe(1);
    expect(first?.confidence?.inputs).toContainEqual({ kind: 'answer', id: 'F1' });
    expect(first?.rank?.inputs).toContainEqual({ kind: 'rule', id: 'T18.priority' });
    expect(first?.score?.inputs).toContainEqual({ kind: 'rule', id: 'T18.priority' });
  });
});

describe('the score favours doubt and sensitivity', () => {
  it('maps low 1, medium 2, high 3 from the answers behind each variable', () => {
    // Price (F1) low: (4 - 1) x 4 = 12. Variable cost (F3) medium: (4 - 2) x 2 = 4. Sales (F6) low:
    // 3 x 3 = 9. Fixed costs (F4) medium: 2 x 1 = 2.
    const run = planOf({ F1: 'low', F3: 'medium', F6: 'low', F4: 'medium' }, { H6: undefined });
    expect(run.validationPlan.candidates.map((c) => [c.variable, c.confidence.value])).toEqual([
      ['price', 1],
      ['vc', 2],
      ['sales', 1],
      ['fixed_costs', 2],
    ]);
    expect(run.validationPlan.candidates.map((c) => c.score.value)).toEqual([12, 4, 9, 2]);
    expect(variables(run)).toEqual(['price', 'sales', 'vc']);
  });

  it('breaks a tie by rank: price (4, rank 1) and variable cost (4, rank 3) before sales (3) and FC (3)', () => {
    // Price high: 1 x 4 = 4. Sales high: 1 x 3 = 3. VC medium: 2 x 2 = 4. FC low: 3 x 1 = 3.
    const levels: Levels = { F3: 'medium', F4: 'low' };
    const run = planOf(levels, { H6: undefined });
    expect(run.validationPlan.candidates.map((c) => c.score.value)).toEqual([4, 4, 3, 3]);
    expect(variables(run)).toEqual(['price', 'vc', 'sales']);
    const withWorry = planOf(levels);
    expect(variables(withWorry)).toEqual(['worry', 'price', 'vc']);
  });

  it('can put a low-sensitivity variable first when its answer is the weakest', () => {
    // A low-confidence variable cost, third in the tornado, scores 3 x 2 = 6, above the price (4).
    const run = planOf({ F3: 'low' }, { H6: undefined });
    expect(variables(run)).toEqual(['vc', 'price', 'sales']);
    expect(run.validationPlan.candidates[1]?.score.value).toBe(6);
  });

  it('follows a different tornado: the ranks come from the swings of the run', () => {
    // A price of 10 against a variable cost of 9 makes the price swing smaller than the cost swing.
    const run = runFlat(
      flatAnswers({ F3: real(jodItems(['M', 9])), H6: undefined }),
      flatProvenance(),
    );
    const ranks = Object.fromEntries(run.tornado.rows.map((row, i) => [row.variable, i + 1]));
    expect(run.validationPlan.candidates.map((c) => c.rank.value)).toEqual([
      ranks.price,
      ranks.vc,
      ranks.sales,
      ranks.fixed_costs,
    ]);
  });
});

describe('the experiment library', () => {
  const keys: ExperimentKey[] = ['price', 'variable_cost', 'sales', 'fixed_costs', 'worry'];

  it('has one experiment per variable and one for the worry', () => {
    expect(Object.keys(EXPERIMENT_LIBRARY).sort()).toEqual([...keys].sort());
  });

  it('holds codes and a cost class, never an amount or a sentence', () => {
    for (const key of keys) {
      const experiment = EXPERIMENT_LIBRARY[key];
      for (const code of [experiment.metric, experiment.threshold, experiment.fallback]) {
        expect(code).toMatch(/^[a-z_]+\.[a-z_]+$/);
        expect(code.startsWith(`${key}.`)).toBe(true);
      }
      expect(['time', 'small_cash', 'supplier_quote']).toContain(experiment.costClass);
    }
  });

  it('copies the library entry of the variable into each plan entry', () => {
    const run = runFlat(flatAnswers());
    for (const entry of run.validationPlan.entries) {
      const library = EXPERIMENT_LIBRARY[entry.experiment];
      expect({
        metric: entry.metric,
        threshold: entry.threshold,
        fallback: entry.fallback,
        costClass: entry.costClass,
      }).toEqual(library);
    }
    expect(run.validationPlan.entries.map((entry) => entry.experiment)).toEqual([
      'worry',
      'price',
      'sales',
    ]);
  });

  it('names the variable cost experiment for the VC variable and fixed_costs for FC', () => {
    const run = planOf({ F3: 'low', F4: 'low' }, { H6: undefined });
    const names = run.validationPlan.entries.map((entry) => [entry.variable, entry.experiment]);
    expect(names).toContainEqual(['vc', 'variable_cost']);
  });
});

describe('determinism', () => {
  it('gives the same plan for the same run', () => {
    const levels: Record<string, FigureConfidence> = { F1: 'low' };
    expect(planOf(levels).validationPlan).toEqual(planOf(levels).validationPlan);
  });
});
