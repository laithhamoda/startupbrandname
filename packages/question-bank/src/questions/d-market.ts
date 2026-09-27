import { option, SECTORS } from '../options';
import { define, t } from './define';

// D — السوق والدولة.
export const AXIS_D = [
  define({
    id: 'D1',
    star: true,
    field: {
      kind: 'single',
      options: [
        option('neighbourhood', 'حيّ', 'A neighbourhood'),
        option('city', 'مدينة', 'A city'),
        option('country', 'دولة', 'A country'),
        option('multi_country', 'أكثر من دولة', 'Several countries'),
      ],
    },
    label: t(
      'ما النطاق الجغرافي في السنة الأولى؟',
      'What is your geographic scope in the first year?',
    ),
    help: t(
      'النطاق الأضيق غالبًا أفضل في البداية.',
      'A narrower scope is usually better at the start.',
    ),
  }),
  define({
    id: 'D2',
    allowUnknown: false,
    field: { kind: 'single', options: SECTORS },
    label: t('ما القطاع؟', 'Which sector?'),
    help: t(
      'بحسب التصنيف الصناعي الدولي الموحّد (ISIC). اختر الأقرب إلى نشاطك الرئيسي.',
      'Following the International Standard Industrial Classification (ISIC). Choose the closest to your main activity.',
    ),
  }),
  define({
    id: 'D3',
    star: true,
    field: { kind: 'competitors', minItems: 3 },
    label: t('اذكر 3 منافسين أو بدائل على الأقل', 'Name at least 3 competitors or alternatives'),
    help: t(
      'البديل قد يكون حلًا يدويًا أو منتجًا مختلفًا يؤدي المهمة نفسها. لكل منها: الاسم، والرابط إن وُجد، ونقطة قوة، ونقطة ضعف.',
      'An alternative can be a manual fix or a different product that does the same job. For each: the name, a link if any, one strength and one weakness.',
    ),
    rules: ['R2'],
  }),
  define({
    id: 'D4',
    star: true,
    field: { kind: 'competitor_prices' },
    label: t('ما أسعار هؤلاء المنافسين؟', 'What do these competitors charge?'),
    help: t(
      'سعر المنتج أو الخدمة الأقرب لما تقدّمه، مع العملة. إن لم تعرف سعرًا فاتركه فارغًا، وسنضيف مهمة بحث.',
      'The price of the product or service closest to yours, with the currency. Leave a price empty if you do not know it, and we will add a research task.',
    ),
  }),
  define({
    id: 'D5',
    field: { kind: 'long_text', minWords: 5 },
    label: t(
      'ما الذي يجعل العميل يختارك بدلاً منهم؟',
      'What makes the customer choose you over them?',
    ),
    help: t(
      'بالأرقام إن أمكن: أرخص بكم، أو أسرع بكم، أو أقرب بكم.',
      'In numbers if you can: cheaper by how much, faster by how much, closer by how much.',
    ),
    rules: ['R5', 'R7'],
  }),
  define({
    id: 'D6',
    field: {
      kind: 'yes_no_percent',
      percentLabel: t('كم في المئة من تكاليفك تقريبًا؟', 'About what share of your costs?'),
    },
    label: t(
      'هل يعتمد مشروعك على الاستيراد أو عملة أجنبية؟',
      'Does your project depend on imports or a foreign currency?',
    ),
    help: t(
      'مثل: مواد خام مستوردة، أو اشتراكات برمجية بعملة أجنبية.',
      'For example imported raw materials, or software subscriptions in a foreign currency.',
    ),
  }),
  define({
    id: 'D7',
    field: { kind: 'seasonality' },
    label: t('هل الطلب موسمي؟', 'Is demand seasonal?'),
    help: t('إن كان كذلك، اختر أشهر الذروة.', 'If it is, choose the peak months.'),
  }),
  define({
    id: 'D8',
    field: { kind: 'long_text', minWords: 1 },
    label: t(
      'ما التراخيص أو الموافقات المطلوبة التي تعرفها؟',
      'Which licences or approvals do you know you need?',
    ),
    help: t(
      'اذكر ما تعرفه فقط؛ دليل التسجيل يكمل الباقي من مصادر رسمية.',
      'List only what you know; the registration guide fills in the rest from official sources.',
    ),
  }),
] as const;
