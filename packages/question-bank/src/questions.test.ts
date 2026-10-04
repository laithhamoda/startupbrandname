import { describe, expect, it } from 'vitest';
import { answerSchema, valueSchema } from './fields';
import { findFollowUp, FOLLOW_UPS } from './follow-ups';
import { rangeValue } from './numbers';
import { getQuestion, ideaQuestion, isQuestionId, QUESTIONS, questionsFor } from './questions';
import { sampleAnswers, sampleValue } from './testing';
import { AXES } from './types';
import { totalIn, valueOf } from './values';

// The ★ questions of docs/SPEC.md §1, the quick mode.
const SPEC_STARS = [
  'A1',
  'A8',
  'B1',
  'B2',
  'B4',
  'C1',
  'C2',
  'C8',
  'D1',
  'D3',
  'D4',
  'E1',
  'F1',
  'F3',
  'F4',
  'F5',
  'F6',
  'G6',
  'H1',
  'H8',
];

const ARABIC = /[؀-ۿ]/;

describe('the question bank (M3 definition of done: all 64 questions)', () => {
  it('has 64 questions, A1 to H8 in order, 8 per axis', () => {
    expect(QUESTIONS.map((question) => question.id)).toEqual(
      AXES.flatMap((axis) => ['1', '2', '3', '4', '5', '6', '7', '8'].map((n) => `${axis}${n}`)),
    );
    for (const question of QUESTIONS) expect(question.axis).toBe(question.id.charAt(0));
  });

  it('marks exactly the 20 ★ questions of SPEC for the quick mode', () => {
    expect(QUESTIONS.filter((question) => question.star).map((question) => question.id)).toEqual(
      SPEC_STARS,
    );
    expect(questionsFor('quick')).toHaveLength(20);
    expect(questionsFor('full')).toHaveLength(64);
  });

  it('writes every label and hint in Arabic and in English', () => {
    for (const question of QUESTIONS) {
      for (const text of [question.label, question.help]) {
        expect(text.ar, question.id).toMatch(ARABIC);
        expect(text.en.trim(), question.id).not.toBe('');
      }
    }
  });

  it('gives every option a unique value and both labels', () => {
    for (const question of QUESTIONS) {
      if (question.field.kind !== 'single' && question.field.kind !== 'multi') continue;
      const values = question.field.options.map((option) => option.value);
      expect(new Set(values).size, question.id).toBe(values.length);
      for (const option of question.field.options) {
        expect(option.label.ar, `${question.id} ${option.value}`).toMatch(ARABIC);
        expect(option.label.en.trim(), `${question.id} ${option.value}`).not.toBe('');
      }
    }
  });

  it('refuses «لا أعرف» only on structural questions (D-104)', () => {
    expect(
      QUESTIONS.filter((question) => !question.allowUnknown).map((question) => question.id),
    ).toEqual(['A1', 'B1', 'B7', 'C1', 'D2', 'F2', 'F8', 'G1', 'H8']);
  });

  it('marks B1 alone as the idea statement the AI review checks first (D-072)', () => {
    expect(
      QUESTIONS.filter((question) => question.ideaCheck).map((question) => question.id),
    ).toEqual(['B1']);
    expect(ideaQuestion().id).toBe('B1');
  });

  it('marks B6 as the one optional question', () => {
    expect(
      QUESTIONS.filter((question) => question.optional).map((question) => question.id),
    ).toEqual(['B6']);
  });

  it('accepts a sample answer for every question and follow-up', () => {
    for (const question of QUESTIONS) {
      const parsed = answerSchema(question.field, question.allowUnknown).safeParse({
        status: 'answered',
        value: sampleValue(question.field),
      });
      expect(parsed.success, `${question.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
    for (const followUp of FOLLOW_UPS) {
      expect(
        valueSchema(followUp.field).safeParse(sampleValue(followUp.field)).success,
        followUp.id,
      ).toBe(true);
    }
    expect(Object.keys(sampleAnswers())).toHaveLength(64);
  });

  it('stores a value its own question accepts for every suggested range (UX-1)', () => {
    for (const { id, field } of [...QUESTIONS, ...FOLLOW_UPS]) {
      if (field.kind !== 'number') continue;
      for (const range of field.ranges) {
        const value = rangeValue(range, field.integer);
        expect(valueSchema(field).safeParse(value).success, `${id} ${JSON.stringify(range)}`).toBe(
          true,
        );
      }
    }
  });

  it('finds questions and follow-ups by ID', () => {
    expect(isQuestionId('F3')).toBe(true);
    expect(isQuestionId('Z9')).toBe(false);
    expect(getQuestion('C2').field.kind).toBe('customer_profile');
    expect(() => getQuestion('Z9' as 'A1')).toThrow('Unknown question');
    expect(findFollowUp('G4.1')?.parent).toBe('G4');
    expect(findFollowUp('A1.9')).toBeUndefined();
    expect(findFollowUp('G4')).toBeUndefined();
  });

  it('reads a stored value only as its own field kind', () => {
    const answers = { A6: { status: 'answered' as const, value: 12 } };
    expect(valueOf(answers, 'A6', 'number')).toBe(12);
    expect(valueOf(answers, 'A2', 'number')).toBeUndefined();
    expect(() => valueOf(answers, 'A6', 'money')).toThrow('A6 is a number field');
  });

  it('adds amounts only when they share the currency', () => {
    const items = [
      { amount: 2, currency: 'JOD' },
      { amount: 3, currency: 'JOD' },
    ];
    expect(totalIn(items, 'JOD')).toBe(5);
    expect(totalIn([...items, { amount: 1, currency: 'USD' }], 'JOD')).toBeNull();
  });
});

describe('A4 (the team)', () => {
  it('asks for a role or title, never a name (D-148)', () => {
    const field = getQuestion('A4').field;
    if (field.kind !== 'people') throw new Error('A4 is a people field');
    expect(field.labels.name).toEqual({
      ar: 'الدور أو الصفة (لا حاجة إلى الاسم)',
      en: 'Role or title (no name needed)',
    });
  });
});
