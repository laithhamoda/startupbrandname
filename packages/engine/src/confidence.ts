import {
  combineFigures,
  makeFigure,
  missingProvenance,
  type Figure,
  type FigureConfidence,
  type Provenance,
} from './figure';
import type { EngineInput } from './input';
import type { EngineParams } from './params';
import { compareRates, makeRate } from './rate';

/** The stable IDs of the confidence rules, listed in the inputs of the figures they produce (D-181). */
export const CONFIDENCE_RULES = {
  overall: 'confidence.overall',
} as const;

/** The five pivotal figures of the project (D-229): price, variable cost, fixed costs, set-up costs, sales. */
export type PivotalId = 'F1' | 'F3' | 'F4' | 'F5' | 'F6';

/** The pivotal figures, in the order of D-229. */
export const PIVOTAL_IDS: readonly PivotalId[] = ['F1', 'F3', 'F4', 'F5', 'F6'];

/**
 * One pivotal figure: how far the answer behind it can be trusted. `missing` is a figure that has
 * no value, such as the set-up costs when F5 is unknown. `sound` is true at medium or high
 * confidence; a missing or low one is not.
 */
export interface PivotalFigure {
  readonly id: PivotalId;
  readonly level: Figure<FigureConfidence | 'missing'>;
  readonly sound: boolean;
}

/**
 * Overall confidence in the project's numbers (D-229): the share of the five pivotal figures that
 * are sound, as high (`confidenceHighLine`, 75% by default), medium (`confidenceMediumLine`, 50%)
 * or low. Like every figure, `level` carries the combined provenance of what it used.
 */
export interface OverallConfidence {
  readonly pivotal: readonly PivotalFigure[];
  /** How many of the five pivotal figures are at medium or high confidence. */
  readonly sound: number;
  readonly level: Figure<FigureConfidence>;
}

function pivotalOf(id: PivotalId, figure: Figure<unknown> | null): PivotalFigure {
  const provenance: Provenance = figure ?? missingProvenance(id);
  const level = figure === null ? 'missing' : figure.confidence;
  return {
    id,
    level: makeFigure<FigureConfidence | 'missing'>(level, provenance),
    sound: level === 'medium' || level === 'high',
  };
}

/**
 * Overall confidence from the adapter's input (D-229). A pivotal figure whose answer is missing or
 * low counts as not sound; the share of sound ones is compared with the two lines by exact integer
 * cross-multiplication (`sound` x denominator against numerator x 5), never by floating point.
 * Pure and deterministic.
 */
export function overallConfidence(input: EngineInput, params: EngineParams): OverallConfidence {
  const pivotal = [
    pivotalOf('F1', input.price),
    pivotalOf('F3', input.variableCost),
    pivotalOf('F4', input.fixedCosts),
    pivotalOf('F5', input.setupCosts),
    pivotalOf('F6', input.sales),
  ];
  const sound = pivotal.filter((figure) => figure.sound).length;
  const share = makeRate(BigInt(sound), BigInt(pivotal.length));
  const level: FigureConfidence =
    compareRates(share, params.confidenceHighLine.value) >= 0
      ? 'high'
      : compareRates(share, params.confidenceMediumLine.value) >= 0
        ? 'medium'
        : 'low';
  return {
    pivotal,
    sound,
    level: combineFigures(
      level,
      [
        ...pivotal.map((figure) => figure.level),
        params.confidenceHighLine,
        params.confidenceMediumLine,
      ],
      [{ kind: 'rule', id: CONFIDENCE_RULES.overall }],
    ),
  };
}
