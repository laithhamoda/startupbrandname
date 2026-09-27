import type { Answer } from './fields';
import { QUESTIONS } from './questions';
import type { Field, QuestionId } from './types';
import type { Answers } from './values';

/**
 * A valid example value for a field. Used by the tests here and by the app's end-to-end tests to
 * fill every question; the values are neutral and trigger no rule.
 */
export function sampleValue(field: Field): unknown {
  switch (field.kind) {
    case 'short_text':
      return '50 مطعمًا صغيرًا في وسط إربد';
    case 'long_text':
      return 'تتعطّل مكيّفات المطاعم الصغيرة في الصيف فيتوقف المطبخ يومين وتخسر المطاعم مبيعاتها.';
    case 'number':
      return Math.min(field.max, Math.max(field.min, 12));
    case 'boolean':
      return true;
    case 'single':
      return field.options[0]?.value;
    case 'multi':
      return { values: [field.options[0]?.value] };
    case 'money':
      return { amount: 25, currency: 'JOD' };
    case 'money_range':
      return { min: 3000, max: 5000, currency: 'JOD' };
    case 'currency':
      return 'JOD';
    case 'country_city':
      return { country: 'JO', city: 'إربد' };
    case 'cost_items':
      return { items: [{ label: 'قطع غيار', amount: 8, currency: 'JOD' }] };
    case 'people':
      return {
        items: [
          { name: 'مورّد قطع الغيار', detail: 'قطع المكيّفات' },
          { name: 'مورّد بديل', detail: 'قطع المكيّفات' },
        ],
      };
    case 'competitors':
      return {
        items: ['فنّي مستقل', 'شركة صيانة كبيرة', 'وكيل المكيّفات'].map((name) => ({
          name,
          strength: 'متوفّر بسرعة',
          weakness: 'لا يقدّم عقود صيانة دورية',
        })),
      };
    case 'competitor_prices':
      return { items: [{ name: 'فنّي مستقل', price: { amount: 30, currency: 'JOD' } }] };
    case 'percent_split':
      return { items: [{ label: 'المؤسس', percent: 100 }] };
    case 'yes_no_detail':
      return { answer: true, detail: 'صاحب المطعم يستخدم ويقرّر' };
    case 'yes_no_percent':
      return { answer: true, percent: 20 };
    case 'seasonality':
      return { seasonal: true, peakMonths: [6, 7, 8] };
    case 'sales_forecast':
      return { month1: 5, month6: 15, month12: 30 };
    case 'three_texts':
      return { items: ['شراء القطع بسعر جيد', 'جدولة الزيارات', 'الاستجابة السريعة'] };
    case 'staff_plan':
      return {
        items: [{ role: 'فنّي', monthlyCost: { amount: 400, currency: 'JOD' }, startMonth: 3 }],
      };
    case 'customer_profile':
      // Complete for every kind of payer in C1.
      return {
        ageBand: '35_44',
        city: 'إربد',
        incomeBand: 'middle',
        occupation: 'أصحاب مطاعم',
        sector: 'I',
        size: 'micro',
        decisionMaker: 'صاحب المطعم',
      };
  }
}

export function sampleAnswer(field: Field): Answer {
  return { status: 'answered', value: sampleValue(field) };
}

/** Where the first option would contradict another sample answer (A7 against H5, R6). */
const OVERRIDES: Partial<Record<QuestionId, unknown>> = { A7: 'gt12' };

/** Sample answers for the given questions (all 64 by default); together they trigger no rule. */
export function sampleAnswers(ids: readonly QuestionId[] = QUESTIONS.map((q) => q.id)): Answers {
  const answers: Answers = {};
  for (const question of QUESTIONS) {
    if (!ids.includes(question.id)) continue;
    const override = OVERRIDES[question.id];
    answers[question.id] =
      override === undefined
        ? sampleAnswer(question.field)
        : { status: 'answered', value: override };
  }
  return answers;
}
