import 'server-only';
import { AXES, AXIS_NAMES, QUESTIONS, questionsFor, type Axis } from '@sbn/question-bank';
import type { Locale } from '@/i18n/routing';
import type { Localized } from './types';

export interface QuickAxis {
  axis: Axis;
  name: string;
  /** The wording of each question, in the language asked for, and nothing else about it. */
  questions: readonly string[];
}

/**
 * What the public questions page may show (D-304): the wording of the 20 quick-mode questions,
 * grouped by axis. Never an id, a help text, an answer option, a follow-up rule or a weight, and
 * never a question outside the quick set. quick-questions.test.ts keeps it so.
 */
export function quickQuestionsByAxis(locale: Locale): readonly QuickAxis[] {
  const quick = questionsFor('quick');
  return AXES.map((axis) => ({
    axis,
    name: AXIS_NAMES[axis][locale],
    questions: quick.filter((question) => question.axis === axis).map((q) => q.label[locale]),
  })).filter((group) => group.questions.length > 0);
}

/** The questions asked only inside the diagnostic, never listed publicly. */
export function privateQuestionCount(): number {
  return QUESTIONS.length - questionsFor('quick').length;
}

export interface QuestionsPageContent {
  heading: string;
  lead: (counts: { quick: number; total: number; axes: number }) => string;
  /** Why this list is not the whole diagnostic, said before the list. */
  notice: (counts: { quick: number; total: number; hidden: number }) => string;
  how: string;
  start: string;
  method: string;
}

export const QUESTIONS_PAGE: Localized<QuestionsPageContent> = {
  ar: {
    heading: 'أسئلة التشخيص السريع',
    lead: ({ quick, axes }) =>
      `هذه الأسئلة الـ${String(quick)} هي ما يبدأ به التشخيص السريع، موزّعة على محاور التشخيص الثمانية (${String(axes)}). تعطيك صورة أولية عن فكرتك بحكم واضح، وتُجاب في دقائق.`,
    notice: ({ quick, total, hidden }) =>
      `هذه ${String(quick)} من ${String(total)} سؤالًا. الأسئلة الـ${String(hidden)} الباقية، وقواعد المتابعة التي تحدّد ما نسألك بعد كل إجابة، تُطرح داخل التشخيص نفسه ولا تُنشر هنا. لذلك لا تكفي هذه القائمة وحدها لتقدير مشروعك ولا لإعادة بناء تقريره: الأرقام تحسبها معادلات المحرك من إجاباتك أنت.`,
    how: 'تُجاب الأسئلة بالأرقام التي تعرفها اليوم. وفي معظم الأسئلة يمكنك اختيار «لا أعرف»، فنقترح نطاقًا ونعلّم الرقم على أنه افتراض لا حقيقة.',
    start: 'ابدأ التشخيص مجانًا',
    method: 'كيف نصل إلى الحكم',
  },
  en: {
    heading: 'Quick diagnostic questions',
    lead: ({ quick, axes }) =>
      `These ${String(quick)} questions open the quick diagnostic, spread across its ${String(axes)} axes. They give you a first picture of your idea with a clear verdict, and take a few minutes.`,
    notice: ({ quick, total, hidden }) =>
      `These are ${String(quick)} of ${String(total)} questions. The other ${String(hidden)}, and the follow-up rules that decide what we ask after each answer, are asked inside the diagnostic and are not published here. So this list alone cannot estimate your project or rebuild its report: the numbers come from the engine’s formulas applied to your own answers.`,
    how: 'Answer with the numbers you know today. For most questions you can choose “I don’t know”: we suggest a range and mark the number as an assumption, not a fact.',
    start: 'Start the diagnostic free',
    method: 'How we reach the verdict',
  },
};
