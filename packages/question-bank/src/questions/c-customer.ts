import { option } from '../options';
import { define, t } from './define';

// C — العميل.
export const AXIS_C = [
  define({
    id: 'C1',
    star: true,
    allowUnknown: false,
    field: {
      kind: 'single',
      options: [
        option('b2c', 'أفراد', 'Individuals (B2C)'),
        option('b2b', 'شركات', 'Businesses (B2B)'),
        option('b2g', 'جهات حكومية', 'Government bodies (B2G)'),
        option('mixed', 'أكثر من نوع', 'A mix'),
      ],
    },
    label: t('من يدفع لك؟', 'Who pays you?'),
    help: t(
      'من يدفع فعلًا، لا من يستخدم المنتج فقط.',
      'Who actually pays, not only who uses the product.',
    ),
  }),
  define({
    id: 'C2',
    star: true,
    field: { kind: 'customer_profile' },
    label: t('صف عميلك الأول بدقة', 'Describe your first customer precisely'),
    help: t(
      'للأفراد: العمر، والمدينة، ومستوى الدخل، والمهنة. للشركات والجهات: القطاع، والحجم، ومسمّى صاحب القرار.',
      'For individuals: age, city, income level and occupation. For businesses and bodies: sector, size and the decision-maker’s title.',
    ),
    rules: ['R1'],
  }),
  define({
    id: 'C3',
    field: { kind: 'short_text' },
    label: t(
      'ما «المهمة» التي يستأجر العميل منتجك لإنجازها؟',
      'What “job” does the customer hire your product to do?',
    ),
    help: t(
      'مثال: «أن يبقى المطبخ يعمل في الصيف دون انقطاع».',
      'Example: “keep the kitchen running through the summer without a breakdown”.',
    ),
  }),
  define({
    id: 'C4',
    field: { kind: 'short_text' },
    label: t(
      'ما اللحظة أو الحدث الذي يدفعه للشراء؟',
      'What moment or event makes the customer buy?',
    ),
    help: t(
      'مثال: عطل مفاجئ، أو بداية الموسم، أو زيارة ضيوف.',
      'For example a sudden breakdown, the start of the season, or guests coming.',
    ),
  }),
  define({
    id: 'C5',
    field: {
      kind: 'yes_no_detail',
      detailWhen: 'no',
      detailLabel: t(
        'من يقرّر الشراء إذن، وما الذي يهمه؟',
        'Who decides, then, and what matters to them?',
      ),
    },
    label: t(
      'هل من يستخدم المنتج هو من يقرّر الشراء؟',
      'Is the person who uses the product the one who decides to buy?',
    ),
    help: t(
      'مثال: الطفل يستخدم، والأهل يقرّرون ويدفعون.',
      'For example, a child uses it while the parents decide and pay.',
    ),
  }),
  define({
    id: 'C6',
    field: {
      kind: 'single',
      options: [
        option('paid', 'نعم، دفع', 'Yes, paid'),
        option('promised', 'وعد بالدفع', 'Promised to pay'),
        option('no', 'ليس بعد', 'Not yet'),
      ],
    },
    label: t('هل دفع أي عميل لك أو وعد بالدفع؟', 'Has any customer paid you or promised to pay?'),
    help: t(
      'الدفع الفعلي أقوى دليل على الطلب.',
      'An actual payment is the strongest proof of demand.',
    ),
  }),
  define({
    id: 'C7',
    field: {
      kind: 'multi',
      other: true,
      options: [
        option('social_media', 'وسائل التواصل الاجتماعي', 'Social media'),
        option('messaging', 'تطبيقات المراسلة', 'Messaging apps'),
        option('search', 'محرّكات البحث', 'Search engines'),
        option('marketplaces', 'المتاجر الإلكترونية الكبرى', 'Online marketplaces'),
        option('email', 'البريد الإلكتروني', 'Email'),
        option('events', 'المعارض والفعاليات', 'Fairs and events'),
        option('shops', 'المحلات والأسواق', 'Shops and markets'),
        option('workplaces', 'أماكن العمل', 'Workplaces'),
        option('education', 'المدارس والجامعات', 'Schools and universities'),
        option('community', 'أماكن التجمّع في الحي', 'Community places'),
        option('word_of_mouth', 'التوصيات الشخصية', 'Word of mouth'),
      ],
    },
    label: t(
      'أين يقضي عميلك وقته رقمياً وميدانياً؟',
      'Where does your customer spend time, online and offline?',
    ),
    help: t(
      'اختر الأماكن التي تستطيع الوصول إليه فيها فعلًا.',
      'Choose the places where you can actually reach them.',
    ),
  }),
  define({
    id: 'C8',
    star: true,
    field: {
      kind: 'number',
      min: 0,
      max: 100_000_000,
      integer: true,
      ranges: [
        { min: 0, max: 10 },
        { min: 11, max: 50 },
        { min: 51, max: 200 },
        { min: 201, max: 1000 },
        { min: 1000 },
      ],
    },
    label: t(
      'كم عميلاً محتملاً تستطيع الوصول إليه في أول شهر؟',
      'How many potential customers can you reach in the first month?',
    ),
    help: t(
      'من تستطيع التواصل معهم فعلًا عبر قنواتك، لا حجم السوق كله.',
      'People you can actually contact through your channels, not the size of the whole market.',
    ),
  }),
] as const;
