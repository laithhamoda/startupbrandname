import { QUESTIONS } from './questions';
import type { QuestionId } from './types';
import { type Answers, valueOf } from './values';

/**
 * - assumption: «لا أعرف» was the answer; test it before relying on it (R4, D-104).
 * - interview: the problem is untested because no one has been asked (B5 = 0).
 * - research: a competitor's price is unknown (D4).
 */
export type TaskKind = 'assumption' | 'interview' | 'research';

export interface ValidationTask {
  kind: TaskKind;
  questionId: QuestionId;
}

/** The validation tasks the answers call for, in diagnostic order. Feeds the 30-day plan (T18). */
export function validationTasks(answers: Answers): ValidationTask[] {
  const tasks: ValidationTask[] = [];
  for (const { id } of QUESTIONS) {
    if (answers[id]?.status === 'unknown') tasks.push({ kind: 'assumption', questionId: id });
    if (id === 'B5' && valueOf(answers, 'B5', 'number') === 0) {
      tasks.push({ kind: 'interview', questionId: 'B5' });
    }
    if (
      id === 'D4' &&
      valueOf(answers, 'D4', 'competitor_prices')?.items.some((item) => item.price === null)
    ) {
      tasks.push({ kind: 'research', questionId: 'D4' });
    }
  }
  return tasks;
}
