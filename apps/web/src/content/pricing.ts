import 'server-only';
import type { Entitlements, PlanId } from '@/config/plans';
import type { Localized } from './types';

export type FeatureKey = keyof Entitlements;

export interface PricingContent {
  heading: string;
  lead: string;
  notice: string;
  tableCaption: string;
  featureColumn: string;
  choosePlan: string;
  planNames: Readonly<Record<PlanId, string>>;
  /** How each plan is billed. Numbers must match config/plans.ts (content.test.ts). */
  billing: Readonly<Record<PlanId, string>>;
  priceRow: string;
  free: string;
  features: Readonly<Record<FeatureKey, string>>;
  /** v2 features, marked until they ship. */
  soon: string;
  soonFeatures: readonly FeatureKey[];
  included: string;
  notIncluded: string;
  locked: string;
  unlimited: string;
  /** "{count}" is replaced by the number. */
  perDay: string;
  days: string;
  readOnlyAfter: string;
  startFree: string;
  paidSoon: string;
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
    lead: 'اختر الخطة المناسبة لمرحلتك. لا خطة تخفي عنك الأرقام: الفرق في عدد المشاريع والتقارير والمرشد.',
    notice:
      'الاشتراكات المدفوعة غير متاحة بعد، وتُفتح في مرحلة لاحقة. إنشاء الحساب المجاني متاح الآن.',
    tableCaption: 'مقارنة الخطط',
    featureColumn: 'الميزة',
    choosePlan: 'اختر خطة لعرض تفاصيلها',
    planNames: {
      free: 'المجانية',
      weekly: 'الأسبوعية',
      monthly: 'الشهرية',
      annual: 'السنوية',
      course: 'متدرّبو الدورة',
      alumni: 'خرّيجو الدورة',
    },
    billing: {
      free: 'دون بطاقة دفع',
      weekly: 'دفعة واحدة لمدة 7 أيام',
      monthly: 'شهريًا، تتجدّد تلقائيًا',
      annual: 'دفعة واحدة لمدة 365 يومًا',
      course: 'مجانًا لمدة 12 شهرًا من التفعيل',
      alumni: 'شهريًا، دون التزام',
    },
    priceRow: 'السعر',
    free: 'مجانًا',
    features: {
      projects: 'المشاريع',
      onePageSummary: 'الملخّص في صفحة واحدة',
      fullReport: 'التقرير الكامل',
      mentorMessages: 'رسائل المرشد الذكي',
      competitorEnrichment: 'إثراء تحليل المنافسين بالبحث على الإنترنت',
      pitchDeck: 'تصدير عرض تقديمي للمستثمرين (Pitch deck)',
      quarterlyRefresh: 'تحديث بيانات السوق كل ثلاثة أشهر',
      retention: 'مدة حفظ المشاريع',
    },
    soon: 'قريبًا',
    soonFeatures: ['competitorEnrichment', 'pitchDeck', 'quarterlyRefresh'],
    included: 'متاح',
    notIncluded: 'غير متاح',
    locked: 'مقفل',
    unlimited: 'غير محدود',
    perDay: '{count} يوميًا',
    days: '{count} يومًا',
    readOnlyAfter: 'مدة الخطة، ثم {count} يومًا للقراءة فقط',
    startFree: 'ابدأ مجانًا',
    paidSoon: 'قريبًا',
    fairUse: '* غير محدود ضمن سياسة استخدام عادل تحمي الخدمة من الإساءة.',
    currency: 'الأسعار بالدولار الأمريكي.',
    payment: 'الدفع ببطاقات Visa والبطاقات الدولية الأخرى، أو عبر PayPal. لا نحفظ بيانات بطاقتك.',
    courseHeading: 'لمتدرّبي دورة «الذكاء الاصطناعي في ريادة الأعمال»',
    courseLead:
      'يحصل متدرّبو الدورة على مزايا الخطة السنوية كاملة بكود يبدأ بـ VIVA، ويستمرّ الخرّيجون بسعر شهري أقل.',
    voucherNote: 'يُتاح تفعيل أكواد VIVA مع فتح الاشتراكات.',
  },
  en: {
    heading: 'Pricing',
    lead: 'Choose the plan that fits your stage. No plan hides the numbers from you: plans differ in projects, reports and mentor use.',
    notice:
      'Paid plans are not available yet and open at a later stage. You can create a free account now.',
    tableCaption: 'Plan comparison',
    featureColumn: 'Feature',
    choosePlan: 'Choose a plan to see its details',
    planNames: {
      free: 'Free',
      weekly: 'Weekly',
      monthly: 'Monthly',
      annual: 'Annual',
      course: 'Course trainees',
      alumni: 'Course alumni',
    },
    billing: {
      free: 'No payment card',
      weekly: 'One payment for 7 days',
      monthly: 'Monthly, renews automatically',
      annual: 'One payment for 365 days',
      course: 'Free for 12 months from activation',
      alumni: 'Monthly, no commitment',
    },
    priceRow: 'Price',
    free: 'Free',
    features: {
      projects: 'Projects',
      onePageSummary: 'One-page summary',
      fullReport: 'Full report',
      mentorMessages: 'AI mentor messages',
      competitorEnrichment: 'Competitor analysis enriched by web search',
      pitchDeck: 'Pitch deck export',
      quarterlyRefresh: 'Quarterly market data refresh',
      retention: 'How long projects are kept',
    },
    soon: 'Coming soon',
    soonFeatures: ['competitorEnrichment', 'pitchDeck', 'quarterlyRefresh'],
    included: 'Included',
    notIncluded: 'Not included',
    locked: 'Locked',
    unlimited: 'Unlimited',
    perDay: '{count} a day',
    days: '{count} days',
    readOnlyAfter: 'The plan’s term, then {count} days read-only',
    startFree: 'Start for free',
    paidSoon: 'Coming soon',
    fairUse: '* Unlimited under a fair-use policy that protects the service from abuse.',
    currency: 'Prices are in US dollars.',
    payment:
      'Pay by Visa or another international card, or with PayPal. We never store your card details.',
    courseHeading: 'For trainees of the “AI in Entrepreneurship” course',
    courseLead:
      'Course trainees get the full annual plan with a code that starts with VIVA, and alumni can continue at a lower monthly price.',
    voucherNote: 'VIVA codes can be activated once paid plans open.',
  },
};
