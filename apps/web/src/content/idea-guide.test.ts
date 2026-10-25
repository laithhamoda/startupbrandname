import { QUESTIONS } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { IDEA_GUIDE, IDEA_GUIDE_UPDATED } from './idea-guide';

const everything = (locale: 'ar' | 'en') => JSON.stringify(IDEA_GUIDE[locale]);

describe('idea guide', () => {
  it('has the same shape in both languages', () => {
    const { ar, en } = IDEA_GUIDE;
    expect(en.steps.map((step) => step.id)).toEqual(ar.steps.map((step) => step.id));
    expect(en.faq.map((item) => item.id)).toEqual(ar.faq.map((item) => item.id));
    expect(en.formulas.map((formula) => formula.id)).toEqual(ar.formulas.map((f) => f.id));
    expect(en.mistakes).toHaveLength(ar.mistakes.length);
    expect(en.example).toHaveLength(ar.example.length);
    expect(en.helps).toHaveLength(ar.helps.length);
    expect(en.limits).toHaveLength(ar.limits.length);
  });

  it('uses unique anchors for steps and questions', () => {
    const ids = [...IDEA_GUIDE.ar.steps, ...IDEA_GUIDE.ar.faq].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has seven steps, as the heading and the page description say', () => {
    expect(IDEA_GUIDE.ar.steps).toHaveLength(7);
    expect(IDEA_GUIDE.en.steps).toHaveLength(7);
  });

  it('keeps the worked example arithmetic right and the same in both languages', () => {
    const numbers = (locale: 'ar' | 'en') =>
      IDEA_GUIDE[locale].example.flatMap((line) => line.match(/\d+/g) ?? []).map(Number);
    expect(numbers('ar')).toEqual(numbers('en'));
    const [price = 0, cost = 0, margin = 0, fixed = 0, units = 0] = numbers('en');
    expect(price - cost).toBe(margin);
    expect(fixed / margin).toBe(units);
  });

  it('names a currency in every line of the example (CLAUDE.md §3)', () => {
    for (const line of [...IDEA_GUIDE.ar.example, ...IDEA_GUIDE.en.example]) {
      expect(line).toContain('USD');
    }
  });

  it('says the example is made up and that the platform does not replace talking to customers', () => {
    expect(IDEA_GUIDE.ar.exampleNote).toContain('مختلقة');
    expect(IDEA_GUIDE.en.exampleNote).toContain('made up');
    expect(IDEA_GUIDE.ar.limits[0]).toContain('عملاء حقيقيين');
    expect(IDEA_GUIDE.en.limits[0]).toContain('real customers');
  });

  it('is dated with the day of its last edit', () => {
    expect(IDEA_GUIDE_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  for (const locale of ['ar', 'en'] as const) {
    it(`publishes no wording of the questions kept private, and no question id (${locale})`, () => {
      // The quick-set wording is already public (D-304), so common phrases may repeat it.
      const text = everything(locale);
      for (const question of QUESTIONS.filter((candidate) => !candidate.star)) {
        expect(text).not.toContain(question.label[locale]);
      }
      expect(text).not.toMatch(/"[A-H][1-8]"/);
    });

    it(`makes no ranking, certification or AI-calculation claim (${locale})`, () => {
      const text = everything(locale).toLowerCase();
      for (const claim of ['#1', 'best-in-class', 'ai-powered', 'مدعوم بالذكاء', 'المنصة الأولى']) {
        expect(text).not.toContain(claim);
      }
    });
  }
});
