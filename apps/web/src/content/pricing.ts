import 'server-only';
import type { Entitlements, PlanId, ReportLevel } from '@/config/plans';
import type { Localized } from './types';

export type FeatureKey = keyof Entitlements;

export interface PricingContent {
  heading: string;
  lead: string;
  notice: string;
  /** Shown only while early access is on (D-290): the full report is free, whatever the table says. */
  earlyAccess: string;
  tableCaption: string;
  featureColumn: string;
  choosePlan: string;
  planNames: Readonly<Record<PlanId, string>>;
  /** How each plan is billed. Numbers must match config/plans.ts (content.test.ts). */
  billing: Readonly<Record<PlanId, string>>;
  priceRow: string;
  free: string;
  features: Readonly<Record<FeatureKey, string>>;
  /** Features not built yet, marked until they ship. */
  soon: string;
  soonFeatures: readonly FeatureKey[];
  /** "{count}" is replaced by the number of questions of the package's diagnostic. */
  questionsCount: string;
  reportLevels: Readonly<Record<ReportLevel, string>>;
  included: string;
  notIncluded: string;
  locked: string;
  unlimited: string;
  /** "{count}" is replaced by the number. */
  perProject: string;
  /** The projects one purchase covers (D-320). */
  perPurchase: string;
  days: string;
  readOnlyAfter: string;
  startFree: string;
  /** The buy button of a paid package, once checkout is open. */
  buy: string;
  /** Replaces `notice` once checkout is open. */
  noticeOpen: string;
  paidSoon: string;
  /** Beside the one start button under the desktop table. */
  paidPlansSoon: string;
  fairUse: string;
  currency: string;
  payment: string;
  courseHeading: string;
  courseLead: string;
  voucherNote: string;
}

export const PRICING: Localized<PricingContent> = {
  ar: {
    heading: 'الأسعار',
    lead: 'ادفع مرة واحدة حسب عمق التحليل الذي تحتاجه، دون اشتراك يتجدّد. كل باقة لمشروع واحد لمدة 12 شهرًا، والترقية من «استراتيجي» إلى «قائد» بدفع الفرق.',
    notice: 'الباقات المدفوعة غير متاحة للشراء بعد، وتُفتح قريبًا. إنشاء الحساب المجاني متاح الآن.',
    earlyAccess:
      'وصول مبكر: يُتاح التقرير الكامل الآن مجانًا لكل حساب تبلغ إجاباته 80% مع السعر والتكاليف والمبيعات، إلى أن تُفتح الباقات المدفوعة.',
    tableCaption: 'مقارنة الباقات',
    featureColumn: 'الميزة',
    choosePlan: 'اختر باقة لعرض تفاصيلها',
    planNames: {
      free: 'مستكشف',
      strategist: 'استراتيجي',
      commander: 'قائد',
      course: 'متدرّبو الدورة',
    },
    billing: {
      free: 'مجانًا، دون بطاقة دفع',
      strategist: 'دفعة واحدة لمدة 365 يومًا',
      commander: 'دفعة واحدة لمدة 365 يومًا',
      course: 'مجانًا لمدة 12 شهرًا من التفعيل',
    },
    priceRow: 'السعر',
    free: 'مجانًا',
    features: {
      projects: 'المشاريع',
      questions: 'أسئلة التشخيص',
      report: 'التقرير',
      mentorMessages: 'رسائل المرشد الذكي',
      retention: 'مدة حفظ المشاريع',
    },
    soon: 'قريبًا',
    soonFeatures: ['mentorMessages'],
    questionsCount: '{count} سؤالًا',
    reportLevels: {
      summary: 'الملخّص في صفحة واحدة',
      standard: 'تقرير الأرقام: التسعير والتعادل والتوقعات والنقد',
      full: 'التقرير الكامل',
    },
    included: 'متاح',
    notIncluded: 'غير متاح',
    locked: 'مقفل',
    unlimited: 'غير محدود',
    perProject: '{count} لكل مشروع',
    perPurchase: '{count} لكل شراء',
    days: '{count} يومًا',
    readOnlyAfter: 'مدة الباقة، ثم {count} يومًا للقراءة فقط',
    startFree: 'ابدأ مجانًا',
    buy: 'اشترِ الباقة',
    noticeOpen: 'ادفع مرة واحدة ببطاقتك أو عبر PayPal، وتُفتح باقتك فور تأكيد الدفع.',
    paidSoon: 'قريبًا',
    paidPlansSoon: 'الباقات المدفوعة قريبًا.',
    fairUse: '* غير محدود ضمن سياسة استخدام عادل تحمي الخدمة من الإساءة.',
    currency: 'الأسعار بالدولار الأمريكي.',
    payment:
      'الدفع ببطاقات Visa والبطاقات الدولية الأخرى، أو عبر PayPal، من خلال Paddle. لا نحفظ بيانات بطاقتك. الترقية من «استراتيجي» إلى «قائد» بدفع الفرق فقط.',
    courseHeading: 'لمتدرّبي دورة «الذكاء الاصطناعي في ريادة الأعمال»',
    courseLead:
      'يحصل متدرّبو الدورة على باقة «استراتيجي» لكل مشاريعهم لمدة 12 شهرًا بكود يبدأ بـ VIVA.',
    voucherNote: 'يُتاح تفعيل أكواد VIVA مع فتح الباقات المدفوعة.',
  },
  en: {
    heading: 'Pricing',
    lead: 'Pay once for the depth of analysis you need, with no renewing subscription. Each package is for one project, for 12 months, and moving from Strategist to Commander costs the difference.',
    notice: 'Paid packages cannot be bought yet and open soon. You can create a free account now.',
    earlyAccess:
      'Early access: the full report is free for now for every account whose answers reach 80%, with the price, costs and sales, until paid packages open.',
    tableCaption: 'Package comparison',
    featureColumn: 'Feature',
    choosePlan: 'Choose a package to see its details',
    planNames: {
      free: 'Explorer',
      strategist: 'Strategist',
      commander: 'Commander',
      course: 'Course trainees',
    },
    billing: {
      free: 'Free, no payment card',
      strategist: 'One payment for 365 days',
      commander: 'One payment for 365 days',
      course: 'Free for 12 months from activation',
    },
    priceRow: 'Price',
    free: 'Free',
    features: {
      projects: 'Projects',
      questions: 'Diagnostic questions',
      report: 'Report',
      mentorMessages: 'AI mentor messages',
      retention: 'How long projects are kept',
    },
    soon: 'Coming soon',
    soonFeatures: ['mentorMessages'],
    questionsCount: '{count} questions',
    reportLevels: {
      summary: 'One-page summary',
      standard: 'The numbers report: pricing, break-even, projection and cash',
      full: 'Full report',
    },
    included: 'Included',
    notIncluded: 'Not included',
    locked: 'Locked',
    unlimited: 'Unlimited',
    perProject: '{count} per project',
    perPurchase: '{count} per purchase',
    days: '{count} days',
    readOnlyAfter: 'The package’s term, then {count} days read-only',
    startFree: 'Start for free',
    buy: 'Buy this package',
    noticeOpen:
      'Pay once by card or PayPal; your package opens as soon as the payment is confirmed.',
    paidSoon: 'Coming soon',
    paidPlansSoon: 'Paid packages are coming soon.',
    fairUse: '* Unlimited under a fair-use policy that protects the service from abuse.',
    currency: 'Prices are in US dollars.',
    payment:
      'Pay by Visa or another international card, or with PayPal, through Paddle. We never store your card details. Moving from Strategist to Commander costs only the difference.',
    courseHeading: 'For trainees of the “AI in Entrepreneurship” course',
    courseLead:
      'Course trainees get the Strategist package on all their projects for 12 months with a code that starts with VIVA.',
    voucherNote: 'VIVA codes can be activated once paid packages open.',
  },
};
