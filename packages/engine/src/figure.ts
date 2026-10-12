import { EngineError } from './errors';

/** Where a value comes from (CLAUDE.md rule 2): the founder, an engine assumption, or a source. */
export type FigureSource = 'user' | 'assumption' | 'external';

/** How far a value can be trusted (CLAUDE.md rule 2). */
export type FigureConfidence = 'high' | 'medium' | 'low';

/**
 * What a figure was computed from, so the report can say where a number comes from (D-181).
 * `answer` is a question or follow-up ID ("F3", "F6.1"); `default` is an engine parameter key
 * (see `PARAM_KEYS`); `rule` is a rule or formula ID; `country_pack_item` is a country-pack or tax
 * item ID.
 */
export interface InputRef {
  readonly kind: 'answer' | 'default' | 'rule' | 'country_pack_item';
  readonly id: string;
}

/**
 * A value with the provenance of CLAUDE.md rule 2 (D-181). The engine returns its results as
 * figures, never as bare numbers, so that a low-confidence pivotal number can be highlighted. The
 * unit of `value` is whatever the producing function documents.
 */
export interface Figure<T> {
  readonly value: T;
  readonly source: FigureSource;
  readonly confidence: FigureConfidence;
  /** True only when the founder or a check confirmed every input. */
  readonly validated: boolean;
  /** Every answer, default, rule and country-pack item the value used, without repeats. */
  readonly inputs: readonly InputRef[];
}

/** The provenance part of a figure: everything but the value. */
export type Provenance = Omit<Figure<unknown>, 'value'>;

/**
 * "Weakest" runs from the founder's own data, through an external fact, to an assumption: a
 * figure that uses any assumption is an assumption, and otherwise one that uses any external
 * value is external (D-181).
 */
const SOURCE_WEAKNESS: Readonly<Record<FigureSource, number>> = {
  user: 0,
  external: 1,
  assumption: 2,
};

const CONFIDENCE_RANK: Readonly<Record<FigureConfidence, number>> = { low: 0, medium: 1, high: 2 };

/** Builds a figure from a value and its provenance. */
export function makeFigure<T>(value: T, provenance: Provenance): Figure<T> {
  const { source, confidence, validated, inputs } = provenance;
  return { value, source, confidence, validated, inputs };
}

/**
 * Combines the provenance of the inputs of a computation into the provenance of its result: the
 * weakest source wins (assumption over external over user), the lowest confidence wins, `validated`
 * is true only when every input is, and the inputs are the union of theirs in first-seen order
 * (D-181). `extraInputs` adds references that carry no provenance of their own, such as the rule
 * that was applied. Throws `empty_input` when there are no inputs at all: a result that depends on
 * nothing has no honest provenance.
 */
export function combineProvenance(
  inputs: readonly Provenance[],
  extraInputs: readonly InputRef[] = [],
): Provenance {
  const [first, ...rest] = inputs;
  if (!first) throw new EngineError('empty_input', 'A figure needs at least one input.');
  let { source, confidence, validated } = first;
  const seen = new Set<string>();
  const refs: InputRef[] = [];
  const remember = (ref: InputRef) => {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };
  first.inputs.forEach(remember);
  for (const input of rest) {
    if (SOURCE_WEAKNESS[input.source] > SOURCE_WEAKNESS[source]) source = input.source;
    if (CONFIDENCE_RANK[input.confidence] < CONFIDENCE_RANK[confidence]) {
      confidence = input.confidence;
    }
    validated = validated && input.validated;
    input.inputs.forEach(remember);
  }
  extraInputs.forEach(remember);
  return { source, confidence, validated, inputs: refs };
}

/**
 * A computed value with the combined provenance of the figures it was computed from. Units:
 * whatever the caller documents for `value`. Throws `empty_input` for no inputs.
 */
export function combineFigures<T>(
  value: T,
  inputs: readonly Provenance[],
  extraInputs: readonly InputRef[] = [],
): Figure<T> {
  return makeFigure(value, combineProvenance(inputs, extraInputs));
}

/**
 * A stored answer as the database holds it: its question ID, its provenance columns, and either a
 * real value or «لا أعرف». `pickedRange` marks an answer given by choosing a range after an
 * unreadable number (R3). Independent of the question bank; the adapter maps its answers to this.
 */
export type StoredAnswer<T> = {
  readonly id: string;
  readonly source: FigureSource;
  readonly confidence: FigureConfidence;
  readonly validated: boolean;
  readonly pickedRange?: boolean;
} & ({ readonly status: 'answered'; readonly value: T } | { readonly status: 'unknown' });

/**
 * The figure of a stored answer. A real answer keeps its stored source, confidence and validated;
 * one given by a picked range is an assumption whatever it was stored as (D-157); «لا أعرف» is an
 * unvalidated low-confidence assumption (D-104) with no value (`null`). The figure's only input is
 * the answer's ID.
 */
export function figureFromAnswer<T>(answer: StoredAnswer<T>): Figure<T | null> {
  const inputs = [{ kind: 'answer', id: answer.id }] as const;
  if (answer.status === 'unknown') {
    return makeFigure(null, { source: 'assumption', confidence: 'low', validated: false, inputs });
  }
  return makeFigure(answer.value, {
    source: answer.pickedRange === true ? 'assumption' : answer.source,
    confidence: answer.confidence,
    validated: answer.validated,
    inputs,
  });
}

/**
 * A figure whose value is an engine default: an assumption of medium confidence, not validated,
 * naming its stable key as its only input (D-195).
 */
export function defaultFigure<T>(key: string, value: T): Figure<T> {
  return makeFigure(value, {
    source: 'assumption',
    confidence: 'medium',
    validated: false,
    inputs: [{ kind: 'default', id: key }],
  });
}

/**
 * The provenance of an answer that is missing or «لا أعرف»: an unvalidated low-confidence
 * assumption (D-104) naming the question. Used where a figure would exist if the answer did, such
 * as the set-up costs F5 when the cash flow cannot be made, so that a result built on its absence
 * still says which answer it lacks.
 */
export function missingProvenance(questionId: string): Provenance {
  return {
    source: 'assumption',
    confidence: 'low',
    validated: false,
    inputs: [{ kind: 'answer', id: questionId }],
  };
}
