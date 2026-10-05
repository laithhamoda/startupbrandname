import { describe, expect, it } from 'vitest';
import type { Answer } from './fields';
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
    expect(firstUnanswered('full', sampleAnswers())).toBeNull();
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

  it('accepts the two modes only', () => {
    expect(MODES).toEqual(['quick', 'full']);
    expect(modeSchema.safeParse('quick').success).toBe(true);
    expect(modeSchema.safeParse('slow').success).toBe(false);
  });
});
