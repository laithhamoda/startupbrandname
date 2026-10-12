import { describe, expect, it } from 'vitest';
import {
  combineFigures,
  combineProvenance,
  defaultFigure,
  figureFromAnswer,
  makeFigure,
  missingProvenance,
  type FigureConfidence,
  type FigureSource,
  type InputRef,
  type Provenance,
} from './figure';

const ref = (id: string, kind: InputRef['kind'] = 'answer'): InputRef => ({ kind, id });

function prov(
  source: FigureSource,
  confidence: FigureConfidence,
  validated: boolean,
  ...inputs: InputRef[]
): Provenance {
  return { source, confidence, validated, inputs };
}

describe('combineProvenance', () => {
  it('lets the weakest source win: assumption over external over user', () => {
    const user = prov('user', 'high', true, ref('F1'));
    const external = prov('external', 'high', true, ref('JO-VAT', 'country_pack_item'));
    const assumption = prov('assumption', 'high', true, ref('x', 'default'));
    expect(combineProvenance([user, user]).source).toBe('user');
    expect(combineProvenance([user, external]).source).toBe('external');
    expect(combineProvenance([external, user]).source).toBe('external');
    expect(combineProvenance([external, assumption]).source).toBe('assumption');
    expect(combineProvenance([assumption, external, user]).source).toBe('assumption');
    expect(combineProvenance([user, assumption]).source).toBe('assumption');
  });

  it('lets the lowest confidence win', () => {
    const level = (c: FigureConfidence) => prov('user', c, true);
    expect(combineProvenance([level('high'), level('high')]).confidence).toBe('high');
    expect(combineProvenance([level('high'), level('medium')]).confidence).toBe('medium');
    expect(combineProvenance([level('medium'), level('high')]).confidence).toBe('medium');
    expect(combineProvenance([level('medium'), level('low'), level('high')]).confidence).toBe(
      'low',
    );
    expect(combineProvenance([level('low'), level('high')]).confidence).toBe('low');
  });

  it('is validated only when every input is', () => {
    const yes = prov('user', 'high', true);
    const no = prov('user', 'high', false);
    expect(combineProvenance([yes, yes]).validated).toBe(true);
    expect(combineProvenance([yes, no]).validated).toBe(false);
    expect(combineProvenance([no, yes]).validated).toBe(false);
    expect(combineProvenance([no]).validated).toBe(false);
  });

  it('lists the union of the inputs in first-seen order, without repeats', () => {
    const a = prov('user', 'high', true, ref('F1'), ref('F3'));
    const b = prov('user', 'high', true, ref('F3'), ref('growth', 'default'), ref('F1'));
    expect(combineProvenance([a, b], [ref('R5', 'rule'), ref('F1')]).inputs).toEqual([
      ref('F1'),
      ref('F3'),
      ref('growth', 'default'),
      ref('R5', 'rule'),
    ]);
  });

  it('keeps the same id apart across kinds', () => {
    const a = prov('user', 'high', true, ref('X', 'answer'));
    const b = prov('user', 'high', true, ref('X', 'rule'));
    expect(combineProvenance([a, b]).inputs).toHaveLength(2);
  });

  it('refuses a result with no inputs', () => {
    expect(() => combineProvenance([])).toThrow(
      expect.objectContaining({ code: 'empty_input' }) as Error,
    );
  });
});

describe('combineFigures and makeFigure', () => {
  it('attaches the combined provenance to a computed value', () => {
    const price = makeFigure(1500n, prov('user', 'medium', false, ref('F1')));
    const growth = defaultFigure('growth.upper_bound_yearly', 0.25);
    const result = combineFigures(42, [price, growth]);
    expect(result).toEqual({
      value: 42,
      source: 'assumption',
      confidence: 'medium',
      validated: false,
      inputs: [ref('F1'), ref('growth.upper_bound_yearly', 'default')],
    });
  });

  it('does not leak the value of an input figure into the result', () => {
    const input = makeFigure('secret', prov('user', 'high', true, ref('F1')));
    expect(JSON.stringify(combineFigures(1, [input]))).not.toContain('secret');
    expect(makeFigure(2, input)).toEqual({
      value: 2,
      source: 'user',
      confidence: 'high',
      validated: true,
      inputs: [ref('F1')],
    });
  });
});

describe('figureFromAnswer', () => {
  it('keeps the stored provenance of a real answer', () => {
    expect(
      figureFromAnswer({
        id: 'F1',
        status: 'answered',
        value: 12.5,
        source: 'user',
        confidence: 'high',
        validated: true,
      }),
    ).toEqual({
      value: 12.5,
      source: 'user',
      confidence: 'high',
      validated: true,
      inputs: [ref('F1')],
    });
  });

  it('maps «لا أعرف» to an unvalidated low-confidence assumption with no value (D-104)', () => {
    expect(
      figureFromAnswer({
        id: 'F6.1',
        status: 'unknown',
        source: 'user',
        confidence: 'high',
        validated: true,
      }),
    ).toEqual({
      value: null,
      source: 'assumption',
      confidence: 'low',
      validated: false,
      inputs: [ref('F6.1')],
    });
  });

  it('makes a picked range an assumption whatever it was stored as (D-157)', () => {
    const range = figureFromAnswer({
      id: 'C8',
      status: 'answered',
      value: 31,
      source: 'user',
      confidence: 'medium',
      validated: false,
      pickedRange: true,
    });
    expect(range.source).toBe('assumption');
    expect(range.confidence).toBe('medium');
    const typed = figureFromAnswer({
      id: 'C8',
      status: 'answered',
      value: 31,
      source: 'user',
      confidence: 'medium',
      validated: false,
      pickedRange: false,
    });
    expect(typed.source).toBe('user');
  });
});

describe('defaultFigure', () => {
  it('is a medium-confidence unvalidated assumption naming its key', () => {
    expect(defaultFigure('seasonality.peak_factor', 1.5)).toEqual({
      value: 1.5,
      source: 'assumption',
      confidence: 'medium',
      validated: false,
      inputs: [{ kind: 'default', id: 'seasonality.peak_factor' }],
    });
  });
});

describe('missingProvenance', () => {
  it('is an unvalidated low-confidence assumption naming the missing question', () => {
    expect(missingProvenance('F5')).toEqual({
      source: 'assumption',
      confidence: 'low',
      validated: false,
      inputs: [{ kind: 'answer', id: 'F5' }],
    });
  });

  it('is the weakest input of any combination', () => {
    const user = prov('user', 'high', true, ref('F1'));
    expect(combineProvenance([user, missingProvenance('F5')])).toEqual({
      source: 'assumption',
      confidence: 'low',
      validated: false,
      inputs: [ref('F1'), ref('F5')],
    });
  });
});
