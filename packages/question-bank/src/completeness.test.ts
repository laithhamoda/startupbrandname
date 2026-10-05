import { describe, expect, it } from 'vitest';
import {
  AXIS_WEIGHTS,
  completeness,
  displayPercent,
  questionGain,
  STAR_WEIGHT,
} from './completeness';
import type { Answer } from './fields';
import { activeFollowUps } from './follow-ups';
import { MESSAGES, message } from './messages';
import { getQuestion, QUESTIONS, questionsFor } from './questions';
import { validationTasks } from './tasks';
import { sampleAnswers } from './testing';
import type { QuestionId } from './types';
import type { Answers } from './values';

const answered = (value: unknown): Answer => ({ status: 'answered', value });
const unknown: Answer = { status: 'unknown' };
const ids = (mode: 'quick' | 'full') => questionsFor(mode).map((question) => question.id);

describe('completeness (SPEC §3, D-102, D-104, D-105)', () => {
  it('uses the SPEC axis weights, adding up to 100', () => {
    expect(AXIS_WEIGHTS).toEqual({ F: 25, C: 20, D: 15, B: 12, E: 10, H: 8, A: 5, G: 5 });
    expect(Object.values(AXIS_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
    expect(STAR_WEIGHT).toBe(2);
  });

  it('starts at zero with nothing unlocked', () => {
    expect(completeness({})).toMatchObject({
      score: 0,
      gate: 'none',
      missingForFull: ['F1', 'F3', 'F4', 'F5'],
    });
  });

  it('reaches 100% and the full report with all 64 answers', () => {
    const result = completeness(sampleAnswers());
    expect(result.score).toBeCloseTo(100, 10);
    expect(result.gate).toBe('full');
    expect(result.next).toEqual([]);
    expect(Object.values(result.byAxis).every((share) => share === 1)).toBe(true);
  });

  it('gives the quick mode (20 ★ questions) 53.4%: the one-page summary (D-102, resolves #35)', () => {
    const result = completeness(sampleAnswers(ids('quick')));
    expect(result.score).toBeCloseTo(53.4, 1);
    expect(result.gate).toBe('summary');
  });

  it('weighs one axis by its share: all of F alone is 25%', () => {
    const numbers = QUESTIONS.filter((question) => question.axis === 'F').map(
      (question) => question.id,
    );
    expect(completeness(sampleAnswers(numbers)).score).toBeCloseTo(25, 10);
  });

  it('counts «لا أعرف» as answered (D-104)', () => {
    const all = sampleAnswers();
    all.B6 = unknown;
    expect(completeness(all).score).toBeCloseTo(100, 10);
  });

  it('ignores follow-ups (D-105)', () => {
    expect(completeness({ 'A2.1': answered('نص') }).score).toBe(0);
  });

  it('needs real F3, F4 and F5 values for the full report (D-110)', () => {
    const all = sampleAnswers();
    all.F3 = unknown;
    expect(completeness(all)).toMatchObject({ gate: 'summary', missingForFull: ['F3'] });
  });

  it('accepts an unknown price (F1) when a competitor price is known (SPEC F1)', () => {
    const all = sampleAnswers();
    all.F1 = unknown;
    expect(completeness(all).gate).toBe('full');
    all.D4 = answered({ items: [{ name: 'فنّي', price: null }] });
    expect(completeness(all)).toMatchObject({ gate: 'summary', missingForFull: ['F1'] });
    all.D4 = unknown;
    expect(completeness(all).missingForFull).toEqual(['F1']);
  });

  it('keeps the summary below 80% even with the four numbers', () => {
    expect(completeness(sampleAnswers(ids('quick'))).missingForFull).toEqual([]);
  });

  it('suggests the questions that raise the score most first', () => {
    const { next } = completeness({});
    expect(next[0]).toBe('F1');
    expect(next.slice(0, 5)).toEqual(['F1', 'F3', 'F4', 'F5', 'F6']);
    expect(questionGain(getQuestion('F1'))).toBeCloseTo((25 * 2) / 13, 10);
    expect(next).toHaveLength(64);
  });

  it('shows whole percentages rounded down', () => {
    expect(displayPercent(39.999)).toBe(39);
    expect(displayPercent(40)).toBe(40);
    expect(displayPercent(53.4)).toBe(53);
  });
});

describe('follow-ups (never counted, D-105)', () => {
  const base = sampleAnswers();
  const active = (changes: Answers) =>
    activeFollowUps({ ...base, ...changes }).map((followUp) => followUp.id);

  it('appear only when their trigger holds', () => {
    expect(active({})).toEqual([]);
    expect(active({ A2: answered(0) })).toEqual(['A2.1']);
    expect(active({ C8: answered(5000), C7: unknown })).toEqual(['C8.1']);
    expect(active({ C8: answered(5000) })).toEqual([]);
    expect(active({ F6: answered({ month1: 2, month6: 10, month12: 40 }) })).toEqual(['F6.1']);
    expect(active({ F6: answered({ month1: 0, month6: 0, month12: 11 }) })).toEqual(['F6.1']);
    expect(
      active({
        G4: answered({
          items: [
            { label: 'أ', percent: 50 },
            { label: 'ب', percent: 50 },
          ],
        }),
      }),
    ).toEqual(['G4.1']);
  });
});

describe('validation tasks', () => {
  it('turn unknowns, untested problems and unknown prices into tasks', () => {
    const answers: Answers = {
      ...sampleAnswers(),
      A5: unknown,
      B5: answered(0),
      D4: answered({ items: [{ name: 'فنّي', price: null }] }),
    };
    expect(validationTasks(answers)).toEqual([
      { kind: 'assumption', questionId: 'A5' },
      { kind: 'interview', questionId: 'B5' },
      { kind: 'research', questionId: 'D4' },
    ]);
    expect(validationTasks(sampleAnswers())).toEqual([]);
  });
});

describe('messages', () => {
  it('say every finding in Arabic and English, with matching placeholders', () => {
    for (const [code, text] of Object.entries(MESSAGES)) {
      expect(text.ar, code).toMatch(/[؀-ۿ]/);
      expect(text.en.trim(), code).not.toBe('');
      expect(text.ar.includes('{word}'), code).toBe(text.en.includes('{word}'));
    }
  });

  it('fill in the founder’s word', () => {
    expect(message('R3_two_readings', 'en', '1.500')).toContain('“1.500”');
    expect(message('R1_everyone', 'ar')).toContain('الجميع');
  });

  it('keep the SPEC wording for R1, R2, R5 and R8', () => {
    expect(MESSAGES.R1_everyone.ar).toBe(
      'المشروع الذي يستهدف الجميع لا يصل إلى أحد. من أول 10 عملاء سيدفعون لك؟',
    );
    expect(MESSAGES.R2_no_competitors.ar).toBe('كيف يتصرف العميل اليوم دونك؟ هذا هو منافسك.');
    expect(MESSAGES.R8_solution.ar).toBe('هذا حلّك. ما الألم الذي يشعر به العميل قبل أن يعرفك؟');
  });
});

// Keeps the type import used when the suite is trimmed.
export type { QuestionId };
