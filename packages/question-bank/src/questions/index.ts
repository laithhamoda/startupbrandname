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

/** The questions of a diagnostic mode: the 20 ★ questions for quick, all 64 for full. */
export function questionsFor(mode: 'quick' | 'full'): readonly Question[] {
  return mode === 'quick' ? QUESTIONS.filter((question) => question.star) : QUESTIONS;
}
