import { option } from '../options';
import { define, t } from './define';

// F — الأرقام. F1, F3, F4 and F5 gate the full report (docs/SPEC.md §3).
export const AXIS_F = [
  define({
    id: 'F1',
    star: true,
    field: { kind: 'money' },
    label: t('سعر البيع للوحدة أو للخدمة', 'Selling price per unit or service'),
    help: t(
      'السعر الذي سيدفعه العميل، مع العملة. إن لم تعرفه بعد، نقترح نطاقًا من أسعار المنافسين.',
      'The price the customer will pay, with the currency. If you do not know it yet, we suggest a range from competitors’ prices.',
    ),
  }),
  define({
    id: 'F2',
    allowUnknown: false,
    field: {
      kind: 'single',
      options: [
        option('fixed', 'سعر ثابت', 'Fixed price'),
        option('subscription', 'اشتراك', 'Subscription'),
        option('hourly', 'بالساعة', 'Hourly'),
        option('commission', 'عمولة', 'Commission'),
        option('bundles', 'باقات', 'Bundles'),
      ],
    },
    label: t('نموذج التسعير', 'Pricing model'),
    help: t(
      'يحدّد المعادلات المستخدمة في الحساب.',
      'It decides which formulas the calculations use.',
    ),
  }),
  define({
    id: 'F3',
    star: true,
    field: { kind: 'cost_items', minItems: 1 },
    label: t('التكلفة المتغيرة لكل وحدة', 'Variable cost per unit'),
    help: t(
      'كل ما يزيد مع كل وحدة تبيعها: مواد، وتغليف، وتوصيل، وعمولة منصة. بندًا بندًا مع العملة.',
      'Everything that rises with each unit sold: materials, packaging, delivery, platform fees. Item by item, with the currency.',
    ),
  }),
  define({
    id: 'F4',
    star: true,
    field: { kind: 'cost_items', minItems: 1 },
    label: t('التكاليف الثابتة الشهرية', 'Monthly fixed costs'),
    help: t(
      'ما تدفعه كل شهر مهما بعت: إيجار، ورواتب، واشتراكات، واتصالات.',
      'What you pay every month whatever you sell: rent, salaries, subscriptions, phone and internet.',
    ),
  }),
  define({
    id: 'F5',
    star: true,
    field: { kind: 'cost_items', minItems: 1 },
    label: t('تكاليف التأسيس لمرة واحدة', 'One-off set-up costs'),
    help: t(
      'ما تدفعه قبل البدء أو عنده: معدات، وتسجيل، وتجهيز، ومخزون أولي.',
      'What you pay before or at launch: equipment, registration, fitting out, first stock.',
    ),
  }),
  define({
    id: 'F6',
    star: true,
    field: { kind: 'sales_forecast' },
    label: t('المبيعات المتوقعة في الشهر 1 و6 و12', 'Expected sales in months 1, 6 and 12'),
    help: t(
      'بعدد الوحدات أو العملاء في كل شهر، لا بالمبلغ.',
      'As the number of units or customers in each month, not as an amount of money.',
    ),
  }),
  define({
    id: 'F7',
    field: {
      kind: 'single',
      options: [
        option('cash', 'نقدًا عند الشراء', 'Cash on purchase'),
        option('credit', 'بالآجل', 'On credit'),
        option('instalments', 'بالتقسيط', 'In instalments'),
        option('deposit', 'دفعة مقدّمة والباقي لاحقًا', 'A deposit, the rest later'),
      ],
    },
    label: t('كيف يدفع العميل؟', 'How does the customer pay?'),
    help: t(
      'يحدّد متى يدخل النقد في التوقعات المالية.',
      'It sets when the cash comes in within the financial projection.',
    ),
  }),
  define({
    id: 'F8',
    allowUnknown: false,
    field: { kind: 'currency' },
    label: t('عملة التقرير', 'Report currency'),
    help: t(
      'كل أرقام التقرير بهذه العملة. نسألك عنها دائمًا ولا نستنتجها.',
      'Every figure in the report uses this currency. We always ask and never guess it.',
    ),
  }),
] as const;
