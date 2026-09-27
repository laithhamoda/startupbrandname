import { FOLLOW_UPS } from './follow-ups';
import { questionsFor } from './questions';
import type { Axis, FollowUpId, QuestionId, Text } from './types';
import type { Answers } from './values';

/** Axis names (docs/SPEC.md §1). */
export const AXIS_NAMES: Readonly<Record<Axis, Text>> = {
  A: { ar: 'المؤسس والموارد', en: 'Founder and resources' },
  B: { ar: 'الفكرة والمشكلة', en: 'Idea and problem' },
  C: { ar: 'العميل', en: 'Customer' },
  D: { ar: 'السوق والدولة', en: 'Market and country' },
  E: { ar: 'العمليات', en: 'Operations' },
  F: { ar: 'الأرقام', en: 'Numbers' },
  G: { ar: 'الإطار القانوني', en: 'Legal setup' },
  H: { ar: 'الأهداف والقيود', en: 'Goals and limits' },
};

export type Mode = 'quick' | 'full';
export type StepId = QuestionId | FollowUpId;

/**
 * The order a founder meets the questions in: the mode's core questions, each followed by the
 * follow-ups its answers call for. Recomputed after every answer, so a follow-up appears or
 * disappears as soon as its trigger changes.
 */
export function diagnosticSequence(mode: Mode, answers: Answers): StepId[] {
  const steps: StepId[] = [];
  for (const question of questionsFor(mode)) {
    steps.push(question.id);
    for (const followUp of FOLLOW_UPS) {
      if (followUp.parent === question.id && followUp.when(answers)) steps.push(followUp.id);
    }
  }
  return steps;
}

/** The step after `current`, or null at the end. A step no longer in the sequence restarts it. */
export function nextStep(mode: Mode, answers: Answers, current: StepId): StepId | null {
  const steps = diagnosticSequence(mode, answers);
  const index = steps.indexOf(current);
  return index === -1 ? (steps[0] ?? null) : (steps[index + 1] ?? null);
}

export function previousStep(mode: Mode, answers: Answers, current: StepId): StepId | null {
  const steps = diagnosticSequence(mode, answers);
  const index = steps.indexOf(current);
  return index > 0 ? (steps[index - 1] ?? null) : null;
}

/** Where to resume: the first step without an answer, or null when everything is answered. */
export function firstUnanswered(mode: Mode, answers: Answers): StepId | null {
  return diagnosticSequence(mode, answers).find((step) => answers[step] === undefined) ?? null;
}

/** "Question 3 of 8" inside the step's axis, counting the mode's core questions only. */
export function positionInAxis(mode: Mode, id: QuestionId): { index: number; total: number } {
  const axis = id.charAt(0);
  const inAxis = questionsFor(mode).filter((question) => question.axis === axis);
  return { index: inAxis.findIndex((question) => question.id === id) + 1, total: inAxis.length };
}
