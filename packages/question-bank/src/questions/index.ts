import type { Mode } from '../sequence';
import type { Question, QuestionId } from '../types';
import { AXIS_A } from './a-founder';
import { AXIS_B } from './b-idea';
import { AXIS_C } from './c-customer';
import { AXIS_D } from './d-market';
import { AXIS_E } from './e-operations';
import { AXIS_F } from './f-numbers';
import { AXIS_G } from './g-legal';
import { AXIS_H } from './h-goals';

/** The 64 core questions in diagnostic order: 8 axes × 8 questions (docs/SPEC.md §1). */
export const QUESTIONS: readonly Question[] = [
  ...AXIS_A,
  ...AXIS_B,
  ...AXIS_C,
  ...AXIS_D,
  ...AXIS_E,
  ...AXIS_F,
  ...AXIS_G,
  ...AXIS_H,
];

const BY_ID = new Map<string, Question>(QUESTIONS.map((question) => [question.id, question]));

export function isQuestionId(id: string): id is QuestionId {
  return BY_ID.has(id);
}

export function getQuestion(id: QuestionId): Question {
  const question = BY_ID.get(id);
  if (!question) throw new Error(`Unknown question: ${id}`);
  return question;
}

/**
 * The question whose answer is the project's idea statement (B1). The AI review checks it as a
 * coherent idea first, and reviews no other answer until it passes (D-072).
 */
export function ideaQuestion(): Question {
  const idea = QUESTIONS.find((question) => question.ideaCheck);
  if (!idea) throw new Error('No question holds the idea statement');
  return idea;
}

/**
 * The 20 questions the standard mode adds to the ★ ones (D-314): those that make the numbers more
 * exact (pricing model, how customers pay, capital, runway, financing, imports, seasonality),
 * then capacity and team, the customer's evidence, and the legal form.
 */
export const STANDARD_EXTRA_QUESTIONS = [
  'A4',
  'A5',
  'A7',
  'B3',
  'B5',
  'B7',
  'C4',
  'C6',
  'C7',
  'D2',
  'D5',
  'D6',
  'D7',
  'E6',
  'E7',
  'E8',
  'F2',
  'F7',
  'G1',
  'H3',
] as const satisfies readonly QuestionId[];

const STANDARD = new Set<QuestionId>(STANDARD_EXTRA_QUESTIONS);

/**
 * The questions of a diagnostic mode, in the bank's order: the 20 ★ questions for quick, those and
 * the 20 of STANDARD_EXTRA_QUESTIONS for standard, all 64 for full.
 */
export function questionsFor(mode: Mode): readonly Question[] {
  if (mode === 'quick') return QUESTIONS.filter((question) => question.star);
  if (mode === 'standard') {
    return QUESTIONS.filter((question) => question.star || STANDARD.has(question.id));
  }
  return QUESTIONS;
}
