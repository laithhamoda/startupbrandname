import type { Answer } from './fields';
import { QUESTIONS } from './questions';
import type { Field, FieldKind, FieldOf, Option, QuestionId } from './types';
import type { Answers, ValueByKind } from './values';

/** The first option's value. Every choice question has options; one without would be a bug. */
function firstValue(options: readonly Option[]): string {
  const [first] = options;
  if (!first) throw new Error('A choice field without options has no sample value.');
  return first.value;
}

/** A sample of each kind's value, typed against its shape in ValueByKind like the schemas. */
const SAMPLES: { [K in FieldKind]: (field: FieldOf<K>) => ValueByKind[K] } = {
  short_text: () => '50 مطعمًا صغيرًا في وسط إربد',
  long_text: () =>
    'تتعطّل مكيّفات المطاعم الصغيرة في الصيف فيتوقف المطبخ يومين وتخسر المطاعم مبيعاتها.',
  number: (field) => Math.min(field.max, Math.max(field.min, 12)),
  boolean: () => true,
  single: (field) => firstValue(field.options),
  multi: (field) => ({ values: [firstValue(field.options)] }),
  money: () => ({ amount: 25, currency: 'JOD' }),
  money_range: () => ({ min: 3000, max: 5000, currency: 'JOD' }),
  currency: () => 'JOD',
  country_city: () => ({ country: 'JO', city: 'إربد' }),
  cost_items: () => ({ items: [{ label: 'قطع غيار', amount: 8, currency: 'JOD' }] }),
  people: () => ({
    items: [
      { name: 'مورّد قطع الغيار', detail: 'قطع المكيّفات' },
      { name: 'مورّد بديل', detail: 'قطع المكيّفات' },
    ],
  }),
  competitors: () => ({
    items: ['فنّي مستقل', 'شركة صيانة كبيرة', 'وكيل المكيّفات'].map((name) => ({
      name,
      strength: 'متوفّر بسرعة',
      weakness: 'لا يقدّم عقود صيانة دورية',
    })),
  }),
  competitor_prices: () => ({
    items: [{ name: 'فنّي مستقل', price: { amount: 30, currency: 'JOD' } }],
  }),
  percent_split: () => ({ items: [{ label: 'المؤسس', percent: 100 }] }),
  yes_no_detail: () => ({ answer: true, detail: 'صاحب المطعم يستخدم ويقرّر' }),
  yes_no_percent: () => ({ answer: true, percent: 20 }),
  seasonality: () => ({ seasonal: true, peakMonths: [6, 7, 8] }),
  sales_forecast: () => ({ month1: 5, month6: 15, month12: 30 }),
  three_texts: () => ({ items: ['شراء القطع بسعر جيد', 'جدولة الزيارات', 'الاستجابة السريعة'] }),
  staff_plan: () => ({
    items: [{ role: 'فنّي', monthlyCost: { amount: 400, currency: 'JOD' }, startMonth: 3 }],
  }),
  // Complete for every kind of payer in C1.
  customer_profile: () => ({
    ageBand: '35_44',
    city: 'إربد',
    incomeBand: 'middle',
    occupation: 'أصحاب مطاعم',
    sector: 'I',
    size: 'micro',
    decisionMaker: 'صاحب المطعم',
  }),
};

/**
 * A valid example value for a field. Used by the tests here and by the app's end-to-end tests to
 * fill every question; the values are neutral and trigger no rule. Typed like valueSchema.
 */
export function sampleValue<K extends FieldKind>(field: FieldOf<K> & { kind: K }): ValueByKind[K] {
  return SAMPLES[field.kind](field);
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
