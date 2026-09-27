import { describe, expect, it } from 'vitest';
import type { Answer } from './fields';
import {
  AXIS_NAMES,
  diagnosticSequence,
  firstUnanswered,
  nextStep,
  positionInAxis,
  previousStep,
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
});
