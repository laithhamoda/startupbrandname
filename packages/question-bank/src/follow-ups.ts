import type { Answer } from './fields';
import { t } from './questions/define';
import type { StepId } from './sequence';
import type { FieldKind, FollowUp, FollowUpId } from './types';
import { type Answers, type ValueByKind, valueOf } from './values';

/** A follow-up, with the condition on the answers that calls for it. */
export type FollowUpDefinition = FollowUp & { when: (answers: Answers) => boolean };

/** Follow-up questions (docs/SPEC.md §1, Logic column). They never count in completeness (D-105). */
export const FOLLOW_UPS: readonly FollowUpDefinition[] = [
  {
    id: 'A2.1',
    parent: 'A2',
    field: { kind: 'long_text', minWords: 3 },
    label: t(
      'من في محيطك يملك خبرة في هذا القطاع، وكيف ستستفيد منها؟',
      'Who around you has experience in this sector, and how will you draw on it?',
    ),
    help: t(
      'مثال: خالي يعمل في توريد المطاعم منذ عشر سنوات، وسيعرّفني على أول العملاء.',
      'For example: my uncle has supplied restaurants for ten years and will introduce me to my first customers.',
    ),
    when: (answers) => valueOf(answers, 'A2', 'number') === 0,
  },
  {
    id: 'C8.1',
    parent: 'C8',
    field: { kind: 'long_text', minWords: 3 },
    label: t(
      'كيف ستصل إلى هذا العدد في الشهر الأول، وعبر أي قناة؟',
      'How will you reach that many people in the first month, and through which channel?',
    ),
    help: t(
      'اذكر القناة والعدد الذي تتوقعه منها.',
      'Name the channel and how many people you expect to reach through it.',
    ),
    when: (answers) => {
      const reach = valueOf(answers, 'C8', 'number');
      if (reach === undefined || reach <= 1000) return false;
      const channels = valueOf(answers, 'C7', 'multi');
      return !channels || (channels.values.length === 0 && (channels.other ?? '') === '');
    },
  },
  {
    id: 'F2.1',
    parent: 'F2',
    field: { kind: 'number', min: 0, max: 100, integer: false, ranges: [] },
    modes: ['full'],
    allowUnknown: true,
    label: t(
      'من كل 100 مشترك، كم يلغون اشتراكهم كل شهر؟',
      'Out of every 100 subscribers, how many cancel each month?',
    ),
    help: t(
      'اكتب رقمًا من 0 إلى 100، ويقبل الكسور مثل 2.5. نستخدمه لحساب قيمة العميل على مدى عمره.',
      'Enter a number from 0 to 100; decimals such as 2.5 are fine. We use it to work out what a customer is worth over their lifetime.',
    ),
    when: (answers) => valueOf(answers, 'F2', 'single') === 'subscription',
  },
  {
    id: 'F4.1',
    parent: 'F4',
    field: { kind: 'money' },
    modes: ['full'],
    allowUnknown: true,
    label: t(
      'كم تنوي أن تنفق على التسويق كل شهر؟',
      'How much do you plan to spend on marketing each month?',
    ),
    help: t(
      'مبلغ شهري للإعلانات والترويج، مع العملة. إن لم تعرفه نعدّ التسويق صفرًا ونذكر ذلك في النتائج.',
      'A monthly amount for advertising and promotion, with the currency. If you do not know it, we count marketing as zero and say so in the results.',
    ),
    when: (answers) => answers.F4?.status === 'answered',
  },
  {
    id: 'F6.1',
    parent: 'F6',
    field: { kind: 'long_text', minWords: 3 },
    label: t(
      'ما الذي سيضاعف مبيعاتك أكثر من عشر مرات خلال السنة؟',
      'What will multiply your sales more than tenfold within the year?',
    ),
    help: t(
      'مثال: عقد مع موزّع يبدأ في الشهر السادس.',
      'For example a distribution contract that starts in month six.',
    ),
    when: (answers) => {
      const sales = valueOf(answers, 'F6', 'sales_forecast');
      return sales !== undefined && sales.month12 > 10 * Math.max(sales.month1, 1);
    },
  },
  {
    id: 'F6.2',
    parent: 'F6',
    field: { kind: 'number', min: 0, max: 1000, integer: false, ranges: [] },
    modes: ['full'],
    allowUnknown: true,
    label: t(
      'بكم تتوقع أن تنمو مبيعاتك كل سنة بعد السنة الأولى؟',
      'By how much do you expect your sales to grow each year after the first year?',
    ),
    help: t(
      'نسبة مئوية في السنة، مثل 20. اكتب 0 إن لم تتوقع نموًا، فالحساب لا يتناول تراجع المبيعات.',
      'A percentage a year, such as 20. Enter 0 for no growth: the calculation does not model a decline in sales.',
    ),
    when: (answers) => answers.F6?.status === 'answered',
  },
  {
    id: 'G4.1',
    parent: 'G4',
    field: { kind: 'boolean' },
    label: t(
      'هل لديكم اتفاق مكتوب بين الشركاء؟',
      'Do you have a written agreement between the partners?',
    ),
    help: t(
      'اتفاق يحدّد الحصص والأدوار وطريقة الخروج.',
      'An agreement that sets out shares, roles and how a partner can leave.',
    ),
    when: (answers) => (valueOf(answers, 'G4', 'percent_split')?.items.length ?? 0) >= 2,
  },
];

/** The follow-ups the current answers call for, in diagnostic order. */
export function activeFollowUps(answers: Answers): readonly FollowUp[] {
  return FOLLOW_UPS.filter((followUp) => followUp.when(answers));
}

/** The follow-up with this ID; undefined for any other string (a URL, a stored row). */
export function findFollowUp(id: string): FollowUpDefinition | undefined {
  return FOLLOW_UPS.find((followUp) => followUp.id === id);
}

/**
 * The value of a follow-up's real answer, typed by its field; undefined if none (no answer, or
 * «لا أعرف»: tell them apart with `answerState`). Throws for an ID that is no follow-up, or when
 * `kind` is not its field's kind, like `valueOf`.
 */
export function followUpValueOf<K extends FieldKind>(
  answers: Answers,
  id: FollowUpId,
  kind: K,
): ValueByKind[K] | undefined {
  const followUp = findFollowUp(id);
  if (!followUp) throw new Error(`${id} is no follow-up`);
  if (followUp.field.kind !== kind) {
    throw new Error(`${id} is a ${followUp.field.kind} field, not ${kind}`);
  }
  const answer: Answer | undefined = answers[id];
  return answer?.status === 'answered' ? (answer.value as ValueByKind[K]) : undefined;
}

/** What the founder gave for a step: a real answer, «لا أعرف», or nothing (D-199). */
export function answerState(answers: Answers, id: StepId): 'answered' | 'unknown' | 'none' {
  return answers[id]?.status ?? 'none';
}
