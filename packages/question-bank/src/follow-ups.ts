import { t } from './questions/define';
import type { FollowUp } from './types';
import { type Answers, valueOf } from './values';

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
