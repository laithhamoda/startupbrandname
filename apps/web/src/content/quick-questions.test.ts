import { QUESTIONS, questionsFor } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { privateQuestionCount, QUESTIONS_PAGE, quickQuestionsByAxis } from './quick-questions';

const LOCALES = ['ar', 'en'] as const;

describe('quickQuestionsByAxis', () => {
  for (const locale of LOCALES) {
    describe(locale, () => {
      const groups = quickQuestionsByAxis(locale);
      const shown = groups.flatMap((group) => group.questions);
      const quick = questionsFor('quick');
      const hidden = QUESTIONS.filter((question) => !question.star);

      it('lists exactly the quick-mode questions, in diagnostic order', () => {
        expect(shown).toEqual(quick.map((question) => question.label[locale]));
        expect(shown).toHaveLength(20);
      });

      it('never lists a question that only the full diagnostic asks', () => {
        for (const question of hidden) expect(shown).not.toContain(question.label[locale]);
      });

      it('shows wording only: no ids, help texts or answer options', () => {
        const everything = JSON.stringify(groups);
        for (const question of QUESTIONS) {
          expect(everything).not.toContain(`"${question.id}"`);
          expect(everything).not.toContain(question.help[locale]);
        }
        expect(Object.keys(groups[0] ?? {}).sort()).toEqual(['axis', 'name', 'questions']);
      });

      it('names every axis it shows and shows no empty axis', () => {
        for (const group of groups) {
          expect(group.name.length).toBeGreaterThan(2);
          expect(group.questions.length).toBeGreaterThan(0);
        }
      });
    });
  }

  it('counts the questions kept private from the bank, not from a typed number', () => {
    expect(privateQuestionCount()).toBe(QUESTIONS.length - 20);
  });
});

describe('the questions page text', () => {
  const counts = { quick: 20, total: 64, hidden: 44, axes: 8 };

  it('says in both languages that the rest of the questions stay inside the diagnostic', () => {
    expect(QUESTIONS_PAGE.ar.notice(counts)).toContain('20 من 64');
    expect(QUESTIONS_PAGE.ar.notice(counts)).toContain('داخل التشخيص نفسه');
    expect(QUESTIONS_PAGE.en.notice(counts)).toContain('20 of 64');
    expect(QUESTIONS_PAGE.en.notice(counts)).toContain('inside the diagnostic');
  });

  it('keeps the numbers it says tied to the counts it is given', () => {
    expect(QUESTIONS_PAGE.ar.lead(counts)).toContain('الـ20');
    expect(QUESTIONS_PAGE.en.lead(counts)).toContain('20 questions');
    expect(QUESTIONS_PAGE.en.notice({ ...counts, hidden: 44 })).toContain('other 44');
  });

  it('does not promise “I don’t know” for every question', () => {
    expect(QUESTIONS_PAGE.ar.how).toContain('في معظم الأسئلة');
    expect(QUESTIONS_PAGE.en.how).toContain('For most questions');
  });
});
