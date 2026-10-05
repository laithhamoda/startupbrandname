import { QUESTIONS } from './questions';
import { AXES, type Axis, type Question, type QuestionId } from './types';
import { type Answers, valueOf } from './values';

/** Share of each axis in the completeness score (docs/SPEC.md §3). Adds up to 100. */
export const AXIS_WEIGHTS: Readonly<Record<Axis, number>> = {
  A: 5,
  B: 12,
  C: 20,
  D: 15,
  E: 10,
  F: 25,
  G: 5,
  H: 8,
};

/** Inside its axis a ★ question weighs double (D-102). */
export const STAR_WEIGHT = 2;

export const SUMMARY_THRESHOLD = 40;
export const FULL_THRESHOLD = 80;

/** Needed for the full report besides the score (SPEC §3), each with a real value (D-110). */
export const FULL_REPORT_QUESTIONS = [
  'F1',
  'F3',
  'F4',
  'F5',
] as const satisfies readonly QuestionId[];

/**
 * - none: below 40%; list the most important missing questions.
 * - summary: the free one-page summary.
 * - full: the full report (a paid entitlement).
 */
export type Gate = 'none' | 'summary' | 'full';

export interface Completeness {
  /** 0 to 100, unrounded; the gates compare this value. */
  score: number;
  /** Share of each axis answered, 0 to 1. */
  byAxis: Readonly<Record<Axis, number>>;
  gate: Gate;
  /** Of F1, F3, F4, F5: those still without the value the full report needs. */
  missingForFull: QuestionId[];
  /** Unanswered questions, those that raise the score most first. */
  next: QuestionId[];
}

const questionWeight = (question: Question) => (question.star ? STAR_WEIGHT : 1);

const axisTotal = (axis: Axis) =>
  QUESTIONS.filter((question) => question.axis === axis).reduce(
    (sum, question) => sum + questionWeight(question),
    0,
  );

/** How much answering a question adds to the score, in points. */
export function questionGain(question: Question): number {
  return (AXIS_WEIGHTS[question.axis] * questionWeight(question)) / axisTotal(question.axis);
}

/** Answered means a real value or «لا أعرف» (D-104); follow-ups are not counted (D-105). */
const isAnswered = (answers: Answers, id: QuestionId) => answers[id] !== undefined;

/**
 * F3, F4 and F5 need real values. F1 may be «لا أعرف» when at least one competitor price is
 * known, since the engine then derives a price range from D4 (SPEC F1).
 */
function hasRealValue(answers: Answers, id: (typeof FULL_REPORT_QUESTIONS)[number]): boolean {
  if (answers[id]?.status === 'answered') return true;
  if (id !== 'F1' || answers.F1?.status !== 'unknown') return false;
  return (
    valueOf(answers, 'D4', 'competitor_prices')?.items.some((item) => item.price !== null) ?? false
  );
}

/** The completeness score and what it unlocks (SPEC §3, D-102, D-104, D-105, D-110). */
export function completeness(answers: Answers): Completeness {
  const byAxis = Object.fromEntries(
    AXES.map((axis) => {
      const questions = QUESTIONS.filter((question) => question.axis === axis);
      const answered = questions
        .filter((question) => isAnswered(answers, question.id))
        .reduce((sum, question) => sum + questionWeight(question), 0);
      return [axis, answered / axisTotal(axis)];
    }),
  ) as Record<Axis, number>;

  const score = AXES.reduce((sum, axis) => sum + AXIS_WEIGHTS[axis] * byAxis[axis], 0);
  const missingForFull = FULL_REPORT_QUESTIONS.filter((id) => !hasRealValue(answers, id));

  let gate: Gate = 'none';
  if (score >= FULL_THRESHOLD && missingForFull.length === 0) gate = 'full';
  else if (score >= SUMMARY_THRESHOLD) gate = 'summary';

  const next = QUESTIONS.filter((question) => !isAnswered(answers, question.id))
    .map((question, index) => ({ id: question.id, gain: questionGain(question), index }))
    .sort((a, b) => b.gain - a.gain || a.index - b.index)
    .map((item) => item.id);

  return { score, byAxis, gate, missingForFull, next };
}

/** The whole percentage shown to the founder: rounded down, so 39.9 never reads as 40. */
export function displayPercent(score: number): number {
  return Math.floor(score + 1e-9);
}
