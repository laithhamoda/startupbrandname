import { describe, expect, it } from 'vitest';
import { completeness, STANDARD_THRESHOLD } from './completeness';
import { FOLLOW_UPS } from './follow-ups';
import { QUESTIONS, STANDARD_EXTRA_QUESTIONS, questionsFor } from './questions';
import { diagnosticSequence, positionInMode } from './sequence';
import { sampleAnswers } from './testing';

// The standard mode of the «متردد» package (D-314): the 20 ★ questions and 20 more.
describe('the standard mode', () => {
  const standard = questionsFor('standard');

  it('asks 40 questions: the 20 of quick mode and the 20 it adds', () => {
    expect(standard).toHaveLength(40);
    const ids = standard.map((question) => question.id);
    for (const question of questionsFor('quick')) expect(ids).toContain(question.id);
    for (const id of STANDARD_EXTRA_QUESTIONS) expect(ids).toContain(id);
  });

  it('adds only questions outside quick mode, each once', () => {
    expect(new Set(STANDARD_EXTRA_QUESTIONS).size).toBe(20);
    for (const id of STANDARD_EXTRA_QUESTIONS) {
      expect(QUESTIONS.find((question) => question.id === id)?.star).toBe(false);
    }
  });

  it('keeps the order of the bank', () => {
    const order = QUESTIONS.map((question) => question.id);
    const positions = standard.map((question) => order.indexOf(question.id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('counts its own 40 questions in "question n of 40"', () => {
    expect(positionInMode('standard', 'A1')).toEqual({ index: 1, total: 40 });
    expect(positionInMode('standard', 'H3').total).toBe(40);
  });

  it('asks the follow-ups of its questions that quick mode leaves out', () => {
    const forStandard = FOLLOW_UPS.filter((followUp) => followUp.modes?.includes('standard'));
    expect(forStandard.map((followUp) => followUp.id).sort()).toEqual([
      'C7.1',
      'F2.1',
      'F4.1',
      'F6.2',
    ]);
    for (const followUp of forStandard) {
      expect(standard.some((question) => question.id === followUp.parent)).toBe(true);
    }
  });

  it('starts with the same questions as quick mode', () => {
    expect(diagnosticSequence('standard', {}).slice(0, 3)).toEqual(['A1', 'A4', 'A5']);
    expect(diagnosticSequence('standard', {})).toHaveLength(40);
  });

  it('cannot reach the full report gate, so it opens its own report at 60 (D-316)', () => {
    const result = completeness(sampleAnswers(standard.map((question) => question.id)));
    expect(result.score).toBeGreaterThan(STANDARD_THRESHOLD);
    expect(result.score).toBeLessThan(80);
    expect(result.gate).toBe('standard');
  });

  it('keeps the summary gate while a number of the report is missing', () => {
    const answers = sampleAnswers(
      standard.map((question) => question.id).filter((id) => id !== 'F3'),
    );
    expect(completeness(answers)).toMatchObject({ gate: 'summary', missingForFull: ['F3'] });
  });
});
