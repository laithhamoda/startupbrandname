import { describe, expect, it } from 'vitest';
import type { Answer } from './fields';
import { activeFollowUps, answerState, FOLLOW_UPS, followUpValueOf } from './follow-ups';
import { getQuestion } from './questions';
import {
  AXIS_NAMES,
  diagnosticSequence,
  firstUnanswered,
  MODES,
  modeSchema,
  nextStep,
  positionInAxis,
  positionInMode,
  previousStep,
  resolveStep,
  sequenceModeFor,
  stepLabel,
} from './sequence';
import { sampleAnswers } from './testing';
import { AXES } from './types';

const answered = (value: unknown): Answer => ({ status: 'answered', value });

describe('the diagnostic sequence', () => {
  it('names every axis in both languages', () => {
    expect(Object.keys(AXIS_NAMES)).toEqual([...AXES]);
  });

  it('asks the 20 ★ questions in quick mode and all 64 in full mode', () => {
    expect(diagnosticSequence('quick', {})).toHaveLength(20);
    expect(diagnosticSequence('full', {})).toHaveLength(64);
    expect(diagnosticSequence('quick', {}).slice(0, 3)).toEqual(['A1', 'A8', 'B1']);
  });

  it('puts a follow-up right after the answer that calls for it', () => {
    const steps = diagnosticSequence('full', { A2: answered(0) });
    expect(steps.slice(1, 4)).toEqual(['A2', 'A2.1', 'A3']);
  });

  it('shows a follow-up in quick mode only when its parent is part of it', () => {
    expect(diagnosticSequence('quick', { A2: answered(0) })).not.toContain('A2.1');
    const growth = { F6: answered({ month1: 1, month6: 5, month12: 50 }) };
    expect(diagnosticSequence('quick', growth)).toContain('F6.1');
  });

  it('moves forward and back through the steps', () => {
    expect(nextStep('quick', {}, 'A1')).toBe('A8');
    expect(nextStep('quick', {}, 'H8')).toBeNull();
    expect(nextStep('quick', {}, 'A2')).toBe('A1');
    expect(previousStep('quick', {}, 'A8')).toBe('A1');
    expect(previousStep('quick', {}, 'A1')).toBeNull();
  });

  it('resumes at the first step without an answer', () => {
    expect(firstUnanswered('quick', {})).toBe('A1');
    expect(firstUnanswered('quick', sampleAnswers(['A1', 'A8']))).toBe('B1');
    expect(firstUnanswered('full', sampleAnswers())).toBe('C7.1');
    expect(firstUnanswered('quick', sampleAnswers())).toBeNull();
  });

  it('counts the position inside the axis for the current mode', () => {
    expect(positionInAxis('full', 'F3')).toEqual({ index: 3, total: 8 });
    expect(positionInAxis('quick', 'F3')).toEqual({ index: 2, total: 5 });
  });

  it('counts the position in the whole version, core questions only (UX-14)', () => {
    expect(positionInMode('quick', 'A1')).toEqual({ index: 1, total: 20 });
    expect(positionInMode('quick', 'F3')).toEqual({ index: 14, total: 20 });
    expect(positionInMode('full', 'F3')).toEqual({ index: 43, total: 64 });
    expect(positionInMode('full', 'H8')).toEqual({ index: 64, total: 64 });
  });
});

describe('one answer to "what is this step?" (ARCH-6)', () => {
  const partners = answered({
    items: [
      { label: 'أ', percent: 50 },
      { label: 'ب', percent: 50 },
    ],
  });

  it('resolves a core question with its own field, axis and «لا أعرف»', () => {
    const resolved = resolveStep('F3', {});
    expect(resolved).toMatchObject({
      status: 'active',
      step: { id: 'F3', parent: null, axis: 'F', allowUnknown: true },
    });
    expect(resolved?.status === 'active' && resolved.step.question).toBe(getQuestion('F3'));
  });

  it('resolves a follow-up its answers call for, in its parent’s axis, without «لا أعرف»', () => {
    expect(resolveStep('G4.1', { G4: partners })).toMatchObject({
      status: 'active',
      step: { id: 'G4.1', question: null, parent: 'G4', axis: 'G', allowUnknown: false },
    });
  });

  it('sends a follow-up its answers no longer call for back to its question (D-116)', () => {
    expect(resolveStep('G4.1', {})).toEqual({ status: 'inactive', parent: 'G4' });
  });

  it('knows no other step', () => {
    expect(resolveStep('Z9', {})).toBeNull();
    expect(resolveStep('A1.9', {})).toBeNull();
  });

  it('moves on in the project’s mode, or in the full order outside it (D-117)', () => {
    expect(sequenceModeFor('quick', {}, 'F3')).toBe('quick');
    expect(sequenceModeFor('quick', {}, 'F2')).toBe('full');
    expect(sequenceModeFor('full', {}, 'F2')).toBe('full');
    expect(sequenceModeFor('quick', { A2: answered(0) }, 'A2.1')).toBe('full');
  });

  it('accepts the three modes only (D-314)', () => {
    expect(MODES).toEqual(['quick', 'standard', 'full']);
    expect(modeSchema.safeParse('quick').success).toBe(true);
    expect(modeSchema.safeParse('standard').success).toBe(true);
    expect(modeSchema.safeParse('slow').success).toBe(false);
  });
});

describe('the follow-ups for the engine (D-183, D-197 to D-199)', () => {
  const sub = answered('subscription');
  const forecast = answered({ month1: 5, month6: 15, month12: 30 });
  const costs = answered({ items: [{ label: 'إيجار', amount: 300, currency: 'JOD' }] });
  const unknownAnswer: Answer = { status: 'unknown' };
  const full = (answers: Parameters<typeof diagnosticSequence>[1]) =>
    diagnosticSequence('full', answers);
  const around = (steps: string[], id: string) =>
    steps.slice(steps.indexOf(id), steps.indexOf(id) + 3);

  it('puts each one right after its parent in the full order', () => {
    const steps = full({ F2: sub, F4: costs, F6: forecast });
    expect(around(steps, 'F2')).toEqual(['F2', 'F2.1', 'F3']);
    expect(around(steps, 'F4')).toEqual(['F4', 'F4.1', 'F5']);
    expect(around(steps, 'F6')).toEqual(['F6', 'F6.2', 'F7']);
  });

  it('keeps F6.1 before F6.2 when sales grow more than tenfold', () => {
    const steps = full({ F6: answered({ month1: 1, month6: 5, month12: 50 }) });
    expect(around(steps, 'F6')).toEqual(['F6', 'F6.1', 'F6.2']);
  });

  it('never asks them in the quick diagnostic, which keeps its 20 questions', () => {
    const steps = diagnosticSequence('quick', { F2: sub, F4: costs, F6: forecast });
    expect(steps).toHaveLength(20);
    for (const id of ['F2.1', 'F4.1', 'F6.2']) expect(steps).not.toContain(id);
    expect(FOLLOW_UPS.filter((followUp) => followUp.modes).map((followUp) => followUp.id)).toEqual([
      'C7.1',
      'F2.1',
      'F4.1',
      'F6.2',
    ]);
  });

  it('asks F2.1 only for a subscription', () => {
    expect(full({ F2: answered('fixed') })).not.toContain('F2.1');
    expect(full({ F2: sub })).toContain('F2.1');
  });

  it('needs a real answer from the parent, not «لا أعرف»', () => {
    const steps = full({ F4: unknownAnswer, F6: unknownAnswer });
    expect(steps).not.toContain('F4.1');
    expect(steps).not.toContain('F6.2');
  });

  it('disappears when its trigger changes, and resolveStep then marks it inactive', () => {
    expect(resolveStep('F2.1', { F2: sub })).toMatchObject({ status: 'active' });
    expect(resolveStep('F2.1', { F2: answered('fixed') })).toEqual({
      status: 'inactive',
      parent: 'F2',
    });
    expect(resolveStep('F4.1', { F4: costs })).toMatchObject({ status: 'active' });
    expect(resolveStep('F4.1', {})).toEqual({ status: 'inactive', parent: 'F4' });
    expect(resolveStep('F6.2', {})).toEqual({ status: 'inactive', parent: 'F6' });
  });

  it('offers «لا أعرف» on these four follow-ups only', () => {
    const allowing = FOLLOW_UPS.filter((followUp) => followUp.allowUnknown).map(
      (followUp) => followUp.id,
    );
    expect(allowing).toEqual(['C7.1', 'F2.1', 'F4.1', 'F6.2']);
    const answers = { C7: answered({ values: ['search'] }), F2: sub, F4: costs, F6: forecast };
    for (const id of allowing) {
      expect(resolveStep(id, answers)).toMatchObject({ step: { allowUnknown: true } });
    }
    expect(resolveStep('A2.1', { A2: answered(0) })).toMatchObject({
      step: { allowUnknown: false },
    });
  });

  it('names a step by its question or follow-up text', () => {
    expect(stepLabel('F4').ar).toBe(getQuestion('F4').label.ar);
    expect(stepLabel('F4.1').en).toMatch(/marketing/);
    expect(() => stepLabel('F4.9')).toThrow(/no step/);
  });

  it('reads a follow-up’s real answer typed by its field', () => {
    const answers = {
      F2: sub,
      'F2.1': answered(2.5),
      'F4.1': answered({ amount: 150, currency: 'JOD' }),
      'F6.2': unknownAnswer,
    };
    expect(followUpValueOf(answers, 'F2.1', 'number')).toBe(2.5);
    expect(followUpValueOf(answers, 'F4.1', 'money')).toEqual({ amount: 150, currency: 'JOD' });
    expect(followUpValueOf(answers, 'F6.2', 'number')).toBeUndefined();
    expect(followUpValueOf({}, 'F6.2', 'number')).toBeUndefined();
    expect(() => followUpValueOf(answers, 'F4.1', 'number')).toThrow(/money field/);
    expect(() => followUpValueOf(answers, 'F4.9', 'number')).toThrow(/no follow-up/);
  });

  it('tells «لا أعرف», a real answer and no answer apart', () => {
    const answers = { 'F2.1': answered(0), 'F4.1': unknownAnswer };
    expect(answerState(answers, 'F2.1')).toBe('answered');
    expect(answerState(answers, 'F4.1')).toBe('unknown');
    expect(answerState(answers, 'F6.2')).toBe('none');
    expect(answerState(answers, 'F4')).toBe('none');
  });

  it('bounds F2.1 to 0 to 100 and F6.2 to 0 to 1000, decimals allowed', () => {
    const fieldOf = (id: string) => FOLLOW_UPS.find((followUp) => followUp.id === id)?.field;
    expect(fieldOf('F2.1')).toMatchObject({ kind: 'number', min: 0, max: 100, integer: false });
    expect(fieldOf('F6.2')).toMatchObject({ kind: 'number', min: 0, max: 1000, integer: false });
    expect(activeFollowUps({ F2: sub }).map((followUp) => followUp.id)).toEqual(['F2.1']);
  });
});
