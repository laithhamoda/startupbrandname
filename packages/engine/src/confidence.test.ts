import { describe, expect, it } from 'vitest';
import { overallConfidence, PIVOTAL_IDS, type PivotalId } from './confidence';
import { defaultFigure, type FigureConfidence } from './figure';
import { flatAnswers, flatProvenance, jodItems, real, runFlat } from './flat-vector';
import { createEngineParams } from './params';
import { makeRate } from './rate';

type Levels = Partial<Record<PivotalId, FigureConfidence>>;

const confidenceOf = (levels: Levels, more = {}) =>
  runFlat(flatAnswers(more), flatProvenance(levels)).confidence;

describe('overall confidence (D-229)', () => {
  it('names the five pivotal figures in order: price, variable cost, fixed costs, set-up, sales', () => {
    expect(PIVOTAL_IDS).toEqual(['F1', 'F3', 'F4', 'F5', 'F6']);
    expect(confidenceOf({}).pivotal.map((figure) => figure.id)).toEqual(PIVOTAL_IDS);
  });

  it.each<[string, Levels, number, FigureConfidence]>([
    ['five of five', {}, 5, 'high'],
    ['four of five (80 percent)', { F1: 'low' }, 4, 'high'],
    ['three of five (60 percent)', { F1: 'low', F3: 'low' }, 3, 'medium'],
    ['two of five (40 percent)', { F1: 'low', F3: 'low', F4: 'low' }, 2, 'low'],
    ['none of five', { F1: 'low', F3: 'low', F4: 'low', F5: 'low', F6: 'low' }, 0, 'low'],
  ])('%s is %s', (_label, levels, sound, level) => {
    const result = confidenceOf(levels);
    expect(result.sound).toBe(sound);
    expect(result.level.value).toBe(level);
  });

  it('counts medium and high as sound and only low as not', () => {
    const medium = confidenceOf({ F1: 'medium', F3: 'medium', F4: 'medium' });
    expect(medium.pivotal.map((figure) => figure.sound)).toEqual([true, true, true, true, true]);
    expect(medium.level.value).toBe('high');
    expect(confidenceOf({ F6: 'low' }).pivotal.map((figure) => figure.sound)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('takes the level of each figure from the answer behind it', () => {
    const result = confidenceOf({ F1: 'low', F3: 'medium' });
    expect(result.pivotal.map((figure) => figure.level.value)).toEqual([
      'low',
      'medium',
      'high',
      'high',
      'high',
    ]);
    expect(result.pivotal[0]?.level.inputs).toEqual([{ kind: 'answer', id: 'F1' }]);
    expect(result.pivotal[3]?.level.inputs).toEqual([{ kind: 'answer', id: 'F5' }]);
  });

  it('counts a missing figure as not sound: F5 unknown leaves four, still high', () => {
    const result = confidenceOf({}, { F5: { status: 'unknown' } });
    const f5 = result.pivotal[3];
    expect(f5).toMatchObject({ id: 'F5', sound: false });
    expect(f5?.level.value).toBe('missing');
    expect(f5?.level).toMatchObject({ source: 'assumption', confidence: 'low', validated: false });
    expect(f5?.level.inputs).toEqual([{ kind: 'answer', id: 'F5' }]);
    expect(result.sound).toBe(4);
    expect(result.level.value).toBe('high');
    expect(confidenceOf({ F1: 'low' }, { F5: { status: 'unknown' } }).level.value).toBe('medium');
  });

  it('counts a price taken from the competitors as low (F1 unknown, D4 known)', () => {
    const result = confidenceOf(
      {},
      {
        F1: { status: 'unknown' },
        D4: real({ items: [{ name: 'A', price: { amount: 11, currency: 'JOD' } }] }),
      },
    );
    expect(result.pivotal[0]).toMatchObject({ id: 'F1', sound: false });
    expect(result.pivotal[0]?.level.value).toBe('low');
  });

  it('counts an answer given by a picked range by its stored confidence, as an assumption', () => {
    const picked = (confidence: FigureConfidence) =>
      runFlat(flatAnswers(), {
        ...flatProvenance(),
        F3: { source: 'user', confidence, validated: false, pickedRange: true },
      }).confidence.pivotal[1];
    expect(picked('medium')).toMatchObject({ id: 'F3', sound: true });
    expect(picked('medium')?.level).toMatchObject({ value: 'medium', source: 'assumption' });
    expect(picked('low')).toMatchObject({ id: 'F3', sound: false });
  });

  it('compares the share with the lines by exact integers, and reads them from the parameters', () => {
    const input = runFlat(flatAnswers(), flatProvenance({ F1: 'low', F3: 'low' })).input;
    // Three of five is 3/5. A medium line of 3/5 reaches it exactly; one of 61/100 does not.
    const exact = overallConfidence(
      input,
      createEngineParams({ confidenceMediumLine: defaultFigure('m', makeRate(3n, 5n)) }),
    );
    expect(exact.level.value).toBe('medium');
    const just = overallConfidence(
      input,
      createEngineParams({ confidenceMediumLine: defaultFigure('m', makeRate(61n, 100n)) }),
    );
    expect(just.level.value).toBe('low');
    const high = overallConfidence(
      input,
      createEngineParams({
        confidenceHighLine: defaultFigure('h', makeRate(3n, 5n)),
        confidenceMediumLine: defaultFigure('m', makeRate(1n, 5n)),
      }),
    );
    expect(high.level.value).toBe('high');
  });

  it('lists the five answers and the two lines among the inputs of the level', () => {
    const level = confidenceOf({}).level;
    expect(level.inputs).toEqual(
      expect.arrayContaining([
        { kind: 'answer', id: 'F1' },
        { kind: 'answer', id: 'F6' },
        { kind: 'default', id: 'confidence.high_line' },
        { kind: 'default', id: 'confidence.medium_line' },
        { kind: 'rule', id: 'confidence.overall' },
      ]),
    );
  });

  it('is the same for the same answers', () => {
    expect(confidenceOf({ F1: 'low' }, { F4: real(jodItems(['R', 900])) })).toEqual(
      confidenceOf({ F1: 'low' }, { F4: real(jodItems(['R', 900])) }),
    );
  });
});
