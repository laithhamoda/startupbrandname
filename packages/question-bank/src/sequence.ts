import { z } from 'zod';
import { FOLLOW_UPS, findFollowUp } from './follow-ups';
import { getQuestion, isQuestionId, questionsFor } from './questions';
import type { Axis, Field, FollowUpId, Question, QuestionId, Text } from './types';
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

/** The two diagnostic versions: the 20 ★ questions, or all 64 (SPEC §1). */
export const MODES = ['quick', 'full'] as const;
export type Mode = (typeof MODES)[number];
/** A mode as stored with a project or sent by a form; any other value is refused. */
export const modeSchema = z.enum(MODES);

export type StepId = QuestionId | FollowUpId;

/** A step as the diagnostic shows and saves it: a core question, or a follow-up. */
export interface Step {
  id: StepId;
  /** The core question; null for a follow-up. */
  question: Question | null;
  /** The question a follow-up belongs to; null for a core question. */
  parent: QuestionId | null;
  field: Field;
  label: Text;
  help: Text;
  axis: Axis;
  /** «لا أعرف» is offered where the question allows it, never on a follow-up (D-104). */
  allowUnknown: boolean;
}

/**
 * What a step is for these answers, the one answer for the step page and saveAnswer (rule 3):
 * `active`, the step to show and save; `inactive`, a follow-up its trigger no longer calls for
 * (D-116), with the question it belongs to; null for an ID that is no step.
 */
export function resolveStep(
  id: string,
  answers: Answers,
): { status: 'active'; step: Step } | { status: 'inactive'; parent: QuestionId } | null {
  if (isQuestionId(id)) {
    const question = getQuestion(id);
    const { field, label, help, axis, allowUnknown } = question;
    return {
      status: 'active',
      step: { id, question, parent: null, field, label, help, axis, allowUnknown },
    };
  }
  const followUp = findFollowUp(id);
  if (!followUp) return null;
  if (!followUp.when(answers)) return { status: 'inactive', parent: followUp.parent };
  const { field, label, help, parent } = followUp;
  return {
    status: 'active',
    step: {
      id: followUp.id,
      question: null,
      parent,
      field,
      label,
      help,
      axis: getQuestion(parent).axis,
      allowUnknown: false,
    },
  };
}

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

/**
 * The order to move on from `step` in: the project's mode, or the full order for a question
 * outside it, which stays reachable from the overview (D-117).
 */
export function sequenceModeFor(mode: Mode, answers: Answers, step: StepId): Mode {
  return diagnosticSequence(mode, answers).includes(step) ? mode : 'full';
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
