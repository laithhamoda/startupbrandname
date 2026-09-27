import { option } from '../options';
import { define, t } from './define';

// B — الفكرة والمشكلة.
export const AXIS_B = [
  define({
    id: 'B1',
    star: true,
    allowUnknown: false,
    field: { kind: 'short_text', maxWords: 40, singleSentence: true },
    label: t(
      'صف فكرتك في جملة واحدة: ماذا تقدّم، ولمن، ولماذا؟',
      'Describe your idea in one sentence: what you offer, to whom, and why.',
    ),
    help: t(
      'مثال: خدمة صيانة دورية لمكيّفات المطاعم الصغيرة في إربد، لأن الأعطال في الصيف توقف المطبخ.',
      'Example: scheduled air-conditioning maintenance for small restaurants in Irbid, because summer breakdowns shut the kitchen.',
    ),
  }),
  define({
    id: 'B2',
    star: true,
    field: { kind: 'long_text', minWords: 8 },
    label: t('ما المشكلة التي تحلّها بالضبط؟', 'What exact problem do you solve?'),
    help: t(
      'صف ما يعانيه العميل قبل أن يعرفك: ماذا يحدث، وكم مرة، وكم يكلّفه.',
      'Describe what the customer goes through before they know you: what happens, how often, and what it costs them.',
    ),
    rules: ['R7', 'R8'],
  }),
  define({
    id: 'B3',
    field: { kind: 'short_text' },
    label: t('من يعاني من هذه المشكلة أكثر من غيره؟', 'Who suffers from this problem most?'),
    help: t(
      'شريحة محدّدة، مثل: أصحاب المطاعم الصغيرة في وسط المدينة.',
      'A specific group, such as owners of small restaurants in the city centre.',
    ),
    rules: ['R1'],
  }),
  define({
    id: 'B4',
    star: true,
    field: { kind: 'long_text', minWords: 5 },
    label: t(
      'كيف يحلّ الناس هذه المشكلة اليوم دون مشروعك؟',
      'How do people solve this problem today, without your project?',
    ),
    help: t(
      'حتى «يتحمّلونها» أو «يطلبون من قريب» حلٌّ بديل يجب ذكره.',
      'Even “they put up with it” or “they ask a relative” is an alternative worth naming.',
    ),
    rules: ['R2', 'R7'],
  }),
  define({
    id: 'B5',
    field: {
      kind: 'number',
      min: 0,
      max: 100_000,
      integer: true,
      ranges: [
        { min: 0, max: 0 },
        { min: 1, max: 5 },
        { min: 6, max: 20 },
        { min: 21, max: 50 },
        { min: 50 },
      ],
    },
    label: t(
      'كم شخصاً تحدثت معهم فعلياً عن هذه المشكلة؟',
      'How many people have you actually talked to about this problem?',
    ),
    help: t(
      'محادثات حقيقية مع عملاء محتملين، لا مع أصدقاء يجاملون.',
      'Real conversations with potential customers, not friends being polite.',
    ),
  }),
  define({
    id: 'B6',
    optional: true,
    field: { kind: 'long_text', minWords: 5 },
    label: t('لماذا الآن؟ ما الذي تغيّر في السوق؟', 'Why now? What has changed in the market?'),
    help: t(
      'مثال: قانون جديد، أو تقنية أرخص، أو عادة شراء تغيّرت.',
      'For example a new law, a cheaper technology, or a change in how people buy.',
    ),
    rules: ['R7'],
  }),
  define({
    id: 'B7',
    allowUnknown: false,
    field: {
      kind: 'single',
      options: [
        option('physical_product', 'منتج مادي', 'Physical product'),
        option('service', 'خدمة', 'Service'),
        option('digital', 'منتج رقمي', 'Digital product'),
        option('hybrid', 'مختلط', 'Hybrid'),
      ],
    },
    label: t('نوع المشروع', 'Type of project'),
    help: t(
      'يحدّد القالب المالي المستخدم في الحساب.',
      'It picks the financial template used in the calculations.',
    ),
  }),
  define({
    id: 'B8',
    field: { kind: 'long_text', minWords: 5 },
    label: t(
      'ما الذي يمنع شخصاً آخر من نسخ فكرتك غداً؟',
      'What stops someone else copying your idea tomorrow?',
    ),
    help: t(
      'مثل: علاقات حصرية، أو خبرة نادرة، أو موقع، أو تكلفة أقل تستطيع إثباتها.',
      'Such as exclusive relationships, rare expertise, a location, or lower costs you can prove.',
    ),
    rules: ['R7'],
  }),
] as const;
