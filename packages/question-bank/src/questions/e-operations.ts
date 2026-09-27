import { option } from '../options';
import { define, t } from './define';

// E — العمليات.
export const AXIS_E = [
  define({
    id: 'E1',
    star: true,
    field: { kind: 'long_text', minWords: 10 },
    label: t(
      'كيف يصل المنتج أو الخدمة إلى العميل خطوة بخطوة؟',
      'How does the product or service reach the customer, step by step?',
    ),
    help: t(
      'من الطلب إلى التسليم: من يفعل ماذا، وبأي أداة، وفي كم من الوقت.',
      'From order to delivery: who does what, with which tool, and how long it takes.',
    ),
    rules: ['R7'],
  }),
  define({
    id: 'E2',
    field: { kind: 'three_texts' },
    label: t(
      'ما الأنشطة الثلاثة الأهم التي يجب أن تتقنها؟',
      'Which three activities must you master?',
    ),
    help: t(
      'مثال: شراء قطع الغيار بسعر جيد، وجدولة الزيارات، والاستجابة السريعة للأعطال.',
      'For example buying spare parts at a good price, scheduling visits, and responding fast to breakdowns.',
    ),
  }),
  define({
    id: 'E3',
    field: { kind: 'cost_items', minItems: 0 },
    label: t(
      'ما المعدات أو الأدوات أو البرامج الأساسية؟',
      'Which equipment, tools or software are essential?',
    ),
    help: t(
      'مع التكلفة والعملة لكل بند. ستظهر مقترحةً ضمن تكاليف التأسيس.',
      'With the cost and currency of each item. They will be suggested again under set-up costs.',
    ),
  }),
  define({
    id: 'E4',
    field: {
      kind: 'people',
      minItems: 1,
      labels: { name: t('المورّد', 'Supplier'), detail: t('ماذا يورّد', 'What they supply') },
    },
    label: t('من هم مورّدوك الرئيسيون؟', 'Who are your main suppliers?'),
    help: t(
      'اذكر البدائل إن وُجدت: الاعتماد على مورّد واحد خطر على المشروع.',
      'List alternatives if you have them: depending on a single supplier is a risk.',
    ),
  }),
  define({
    id: 'E5',
    field: { kind: 'short_text' },
    label: t('من الشركاء الذين تحتاجهم؟', 'Which partners do you need?'),
    help: t(
      'مثل: شركة توصيل، أو مطبعة، أو مزوّد خدمة دفع.',
      'Such as a delivery company, a printer, or a payment provider.',
    ),
  }),
  define({
    id: 'E6',
    field: {
      kind: 'single',
      options: [
        option('home', 'من المنزل', 'From home'),
        option('shop', 'محل', 'A shop'),
        option('office', 'مكتب', 'An office'),
        option('online_only', 'عبر الإنترنت فقط', 'Online only'),
        option('field', 'ميدانيًا عند العملاء', 'In the field, at customers’ sites'),
      ],
    },
    label: t('أين ستعمل؟', 'Where will you work?'),
    help: t(
      'يحدّد قالب التكاليف الثابتة ومسار الترخيص.',
      'It sets the fixed-cost template and the licensing path.',
    ),
  }),
  define({
    id: 'E7',
    field: {
      kind: 'number',
      min: 1,
      max: 100_000_000,
      integer: true,
      ranges: [
        { min: 1, max: 20 },
        { min: 21, max: 100 },
        { min: 101, max: 500 },
        { min: 501, max: 2000 },
        { min: 2000 },
      ],
    },
    label: t(
      'أقصى عدد عملاء أو وحدات تستطيع خدمته شهرياً؟',
      'What is the most customers or units you can serve per month?',
    ),
    help: t(
      'بالموارد التي لديك الآن، دون توظيف إضافي.',
      'With the resources you have now, without hiring anyone.',
    ),
  }),
  define({
    id: 'E8',
    field: { kind: 'staff_plan' },
    label: t(
      'كم موظفاً تحتاج في السنة الأولى، وبأي أدوار؟',
      'How many staff do you need in year one, and in which roles?',
    ),
    help: t(
      'لكل دور: التكلفة الشهرية مع العملة، والشهر الذي يبدأ فيه. اترك القائمة فارغة إن لم تحتج أحدًا.',
      'For each role: the monthly cost with the currency, and the month they start. Leave the list empty if you need no one.',
    ),
  }),
] as const;
