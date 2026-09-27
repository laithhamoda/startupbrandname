import { option } from '../options';
import { define, t } from './define';

// H — الأهداف والقيود.
export const AXIS_H = [
  define({
    id: 'H1',
    star: true,
    field: { kind: 'short_text' },
    label: t(
      'ما الذي يجب أن يحدث خلال 12 شهراً لتعتبر المشروع ناجحاً؟',
      'What must happen within 12 months for you to call the project a success?',
    ),
    help: t(
      'هدف قابل للقياس، مثل: 50 عميلًا يدفعون شهريًا، أو دخل يغطي مصاريفي الشخصية.',
      'A measurable goal, such as 50 paying customers a month, or income that covers my personal expenses.',
    ),
    rules: ['R5'],
  }),
  define({
    id: 'H2',
    field: { kind: 'short_text' },
    label: t('ما الرقم الذي ستراقبه أسبوعياً؟', 'Which number will you watch every week?'),
    help: t(
      'مثال: عدد الطلبات، أو نسبة العملاء العائدين.',
      'For example the number of orders, or the share of returning customers.',
    ),
  }),
  define({
    id: 'H3',
    field: {
      kind: 'multi',
      other: false,
      options: [
        option('self', 'مدخراتي الشخصية', 'My own savings'),
        option('family', 'العائلة والأصدقاء', 'Family and friends'),
        option('loan', 'قرض', 'A loan'),
        option('investor', 'مستثمر', 'An investor'),
        option('grant', 'منحة', 'A grant'),
        option('competition', 'جائزة مسابقة', 'A competition prize'),
      ],
    },
    label: t('كيف ستموّل المشروع؟', 'How will you fund the project?'),
    help: t('يمكنك اختيار أكثر من مصدر.', 'You can choose more than one source.'),
  }),
  define({
    id: 'H4',
    field: { kind: 'long_text', minWords: 2 },
    label: t('ما الأمور التي لن تفعلها مهما حدث؟', 'What will you never do, whatever happens?'),
    help: t(
      'خطوطك الحمراء، وستلتزم بها كل التوصيات. مثال: لن أعمل يوم الجمعة.',
      'Your red lines; every recommendation will respect them. Example: I will not work on Fridays.',
    ),
  }),
  define({
    id: 'H5',
    field: {
      kind: 'single',
      options: [
        option('m6', '6 أشهر', '6 months'),
        option('m12', '12 شهرًا', '12 months'),
        option('m18', '18 شهرًا', '18 months'),
        option('m24', '24 شهرًا', '24 months'),
        option('m36', '36 شهرًا', '36 months'),
        option('more', 'أكثر من 36 شهرًا', 'More than 36 months'),
      ],
    },
    label: t(
      'ما أقصى مدة تقبلها للوصول إلى التعادل؟',
      'What is the longest you would accept to reach break-even?',
    ),
    help: t(
      'نقطة التعادل (Break-even): حين تغطي الإيرادات كل التكاليف.',
      'Break-even: when revenue covers all the costs.',
    ),
  }),
  define({
    id: 'H6',
    field: { kind: 'long_text', minWords: 1 },
    label: t(
      'ما أكبر شيء لا تعرفه أو يقلقك؟',
      'What is the biggest thing you don’t know, or that worries you?',
    ),
    help: t('يصبح أولوية في خطة التحقّق.', 'It becomes a priority in the validation plan.'),
  }),
  define({
    id: 'H7',
    field: {
      kind: 'single',
      options: [
        option('no', 'لا', 'No'),
        option('cities', 'إلى مدن أخرى', 'To other cities'),
        option('countries', 'إلى دول أخرى', 'To other countries'),
        option('franchise', 'بالامتياز التجاري (Franchise)', 'By franchising'),
      ],
    },
    label: t('هل تريد التوسع لاحقاً؟', 'Do you want to expand later?'),
    help: t('يؤثّر في توصيات النمو.', 'It shapes the growth recommendations.'),
  }),
  define({
    id: 'H8',
    star: true,
    allowUnknown: false,
    field: {
      kind: 'single',
      options: [
        option('self', 'لي وحدي', 'Just me'),
        option('investor', 'مستثمر', 'An investor'),
        option('bank', 'بنك', 'A bank'),
        option('grant_body', 'جهة مانحة', 'A grant body'),
        option('course', 'مهمة في دورة تدريبية', 'A course assignment'),
      ],
    },
    label: t('لمن سيُعرض هذا التقرير؟', 'Who will this report be shown to?'),
    help: t('يحدّد قالب التقرير ونبرته.', 'It sets the report’s template and tone.'),
  }),
] as const;
