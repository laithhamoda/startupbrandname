import type { Answers } from '@sbn/question-bank';
import type { ProjectContext, ProvenanceBySteps } from './input';
import { makeMoney, sumMoney, type Money } from './money';
import { compareRates, makeRate, type Rate } from './rate';
import { runEngine, type EngineRun } from './run';
import type { TaxContext, TaxRule } from './tax';

/*
 * The three golden projects of M4 (D-178, D-222). Each is a fixture of answers with provenance, a
 * project context and a tax context; the engine's whole run on it is the golden file in
 * packages/engine/golden/, and the owner review page (docs/engine-review/index.html) is rendered
 * from the same runs. Every headline number has its hand computation in `rows`, in Modern Standard
 * Arabic for the page; golden.test.ts asserts that the engine equals it. The inputs are round: a
 * flat, linear or exactly doubling curve, so that the numbers can be checked with a pencil.
 *
 * The tax rules are clearly artificial fixtures (source https://example.invalid/fixture, status
 * unverified, a name that says fixture): they imply no real rate (CLAUDE.md rules 8 and 9). The
 * Algerian rule uses the values SPEC section 7 lists for the auto-entrepreneur, still unverified.
 * Nothing in this file is market data; the wording of the questions is not final (OPEN-QUESTIONS 86).
 */

export type GoldenName = 'jo-service-subscription' | 'jo-home-ecommerce' | 'dz-auto-entrepreneur';

/** What a hand computation expects, and what the engine gave, in the same four shapes. */
export type Expected =
  | { readonly kind: 'money'; readonly minor: bigint }
  | { readonly kind: 'units'; readonly units: bigint }
  | { readonly kind: 'month'; readonly month: number | null }
  | { readonly kind: 'rate'; readonly rate: Rate };

export type HeadlineId =
  | 'revenue_y1'
  | 'profit_y1'
  | 'cm'
  | 'cm_rate'
  | 'be_units'
  | 'be_rev'
  | 'be_month'
  | 'tax_y1'
  | 'funding_need'
  | 'funding_month'
  | 'payback'
  | 'ltv'
  | 'cac'
  | 'ltv_cac'
  | 'floor'
  | 'turnover_y2'
  | 'turnover_y3';

/** A headline number: its label, the hand computation as the page shows it, and the value expected. */
export interface HeadlineRow {
  readonly id: HeadlineId;
  readonly label: string;
  readonly hand: string;
  readonly expected: Expected;
}

/** One way the customer can pay (F7), run on the same project with its own hand computation. */
export interface PaymentVariantRow {
  readonly option: 'cash' | 'credit' | 'instalments' | 'deposit';
  readonly hand: string;
  readonly fundingNeed: bigint;
  readonly fundingMonth: number;
  readonly payback: number | null;
}

export interface GoldenProject {
  readonly name: GoldenName;
  readonly title: string;
  /** One plain sentence about the project, for the owner. */
  readonly sentence: string;
  /** The currency as the page writes it after a number. */
  readonly currencyLabel: string;
  readonly context: ProjectContext;
  readonly answers: Answers;
  readonly provenance: ProvenanceBySteps;
  readonly tax: TaxContext;
  readonly rows: readonly HeadlineRow[];
  /** The project run again under each F7 option, when the project shows them (the e-commerce shop). */
  readonly paymentVariants: readonly PaymentVariantRow[];
}

const real = (value: unknown) => ({ status: 'answered' as const, value });
const UNKNOWN = { status: 'unknown' as const };
const money = (amount: number, currency: string) => ({ amount, currency });
const items = (currency: string, ...rows: readonly (readonly [string, number])[]) => ({
  items: rows.map(([label, amount]) => ({ label, amount, currency })),
});

const userHigh = { source: 'user', confidence: 'high', validated: true } as const;
const userMedium = { source: 'user', confidence: 'medium', validated: true } as const;
const userGuess = { source: 'user', confidence: 'low', validated: false } as const;
const assumedMedium = { source: 'assumption', confidence: 'medium', validated: false } as const;

/** An artificial tax rule: no real rate, no real source (D-222). */
function fixtureRule(
  over: Partial<TaxRule> & Pick<TaxRule, 'id' | 'countryCode' | 'currency'>,
): TaxRule {
  return {
    legalForm: 'sole',
    regime: 'fixture_regime',
    levy: 'fixture_levy',
    kind: 'tax',
    basis: 'profit',
    rate: null,
    brackets: [],
    fixedAmount: null,
    minimum: null,
    turnoverCeiling: null,
    paymentMonth: 4,
    effectiveFrom: '2020-01-01',
    sourceUrl: 'https://example.invalid/fixture',
    lastVerified: null,
    status: 'unverified',
    ...over,
  };
}

/** Two artificial Jordanian rules: 10% of profit for a sole proprietor, 20% for a company, in April. */
const JORDAN_FIXTURE_RULES: readonly TaxRule[] = [
  fixtureRule({
    id: 'fixture.jo.sole.profit_tax',
    countryCode: 'JO',
    currency: 'JOD',
    legalForm: 'sole',
    regime: 'fixture_regime_sole',
    levy: 'fixture_profit_tax',
    rate: makeRate(1n, 10n),
  }),
  fixtureRule({
    id: 'fixture.jo.company.profit_tax',
    countryCode: 'JO',
    currency: 'JOD',
    legalForm: 'company',
    regime: 'fixture_regime_company',
    levy: 'fixture_profit_tax',
    rate: makeRate(1n, 5n),
  }),
];

/** The SPEC section 7 values for the Algerian auto-entrepreneur, as an unverified fixture. */
const ALGERIA_FIXTURE_RULES: readonly TaxRule[] = [
  fixtureRule({
    id: 'fixture.dz.sole.turnover_levy',
    countryCode: 'DZ',
    currency: 'DZD',
    legalForm: 'sole',
    regime: 'fixture_auto_entrepreneur',
    levy: 'fixture_turnover_levy',
    basis: 'turnover',
    rate: makeRate(1n, 200n),
    minimum: makeMoney(1_000_000n, 'DZD'),
    turnoverCeiling: makeMoney(500_000_000n, 'DZD'),
    paymentMonth: 3,
  }),
];

const REFERENCE_DATE = '2026-10-05';

const moneyOf = (minor: bigint): Expected => ({ kind: 'money', minor });
const unitsOf = (units: bigint): Expected => ({ kind: 'units', units });
const monthOf = (month: number | null): Expected => ({ kind: 'month', month });
const rateOf = (num: bigint, den: bigint): Expected => ({ kind: 'rate', rate: makeRate(num, den) });

/*
 * Project 1: a Jordanian software service sold as a monthly subscription (JOD, 3 decimals).
 * A straight line from 0 to 200 subscribers in months 1 to 6, then flat; no season; no growth.
 */
const subscription: GoldenProject = {
  name: 'jo-service-subscription',
  title: 'خدمة برمجية بالاشتراك الشهري',
  sentence:
    'شركة أردنية صغيرة تبيع خدمة برمجية باشتراك شهري قيمته 30 د.أ، وتبدأ بلا مشتركين ثم تصل إلى 200 مشترك في الشهر السادس وتثبت عليه.',
  currencyLabel: 'د.أ',
  context: { country: 'JO', currency: 'JOD', mode: 'full', referenceDate: REFERENCE_DATE },
  answers: {
    F1: real(money(30, 'JOD')),
    F2: real('subscription'),
    'F2.1': real(5),
    F3: real(items('JOD', ['الاستضافة والخدمات السحابية', 4], ['دعم العملاء', 2])),
    F4: real(items('JOD', ['إيجار المكتب', 1200], ['البرمجيات والاشتراكات', 800])),
    'F4.1': real(money(600, 'JOD')),
    E8: real({
      items: [{ role: 'مطوّر برمجيات', monthlyCost: money(1500, 'JOD'), startMonth: 4 }],
    }),
    F5: real(
      items(
        'JOD',
        ['المعدات', 7000],
        ['التسجيل والاستشارة القانونية', 3000],
        ['إطلاق المنتج', 2000],
      ),
    ),
    F6: real({ month1: 0, month6: 200, month12: 200 }),
    'F6.2': real(0),
    D7: real({ seasonal: false, peakMonths: [] }),
    F7: real('cash'),
    D4: real({
      items: [
        { name: 'منافس أ', price: money(35, 'JOD') },
        { name: 'منافس ب', price: money(28, 'JOD') },
        { name: 'منافس ج', price: money(32, 'JOD') },
        { name: 'منافس د', price: null },
      ],
    }),
    D6: real({ answer: false }),
    G1: real('company'),
    A5: real({ min: 8000, max: 15000, currency: 'JOD' }),
    A7: real('lt3'),
    H5: real('m12'),
  },
  provenance: {
    F1: userHigh,
    F2: userHigh,
    'F2.1': userGuess,
    F3: userMedium,
    F4: userHigh,
    'F4.1': userHigh,
    E8: userHigh,
    F5: userHigh,
    F6: userHigh,
    'F6.2': userHigh,
    D7: userHigh,
    F7: userHigh,
    D4: userHigh,
    D6: userHigh,
    G1: userHigh,
    A5: userHigh,
    A7: userHigh,
    H5: userHigh,
  },
  tax: { rules: JORDAN_FIXTURE_RULES },
  rows: [
    {
      id: 'revenue_y1',
      label: 'إيراد السنة الأولى',
      hand: 'المشتركون في الأشهر 1 إلى 6: 0 + 40 + 80 + 120 + 160 + 200 = 600، وفي الأشهر 7 إلى 12: 200 × 6 = 1,200؛ المجموع 1,800 اشتراك شهري. 1,800 × 30 = 54,000 د.أ',
      expected: moneyOf(54_000_000n),
    },
    {
      id: 'profit_y1',
      label: 'ربح التشغيل قبل الضريبة في السنة الأولى',
      hand: 'الإيراد 54,000 − التكلفة المتغيرة (1,800 × 6 = 10,800) − التكاليف الثابتة (2,000 × 12 = 24,000) − التسويق (600 × 12 = 7,200) − راتب المطوّر لتسعة أشهر (1,500 × 9 = 13,500) = −1,500 د.أ، أي خسارة',
      expected: moneyOf(-1_500_000n),
    },
    {
      id: 'cm',
      label: 'هامش المساهمة للوحدة (CM)',
      hand: '30 − 6 = 24 د.أ',
      expected: moneyOf(24_000n),
    },
    {
      id: 'cm_rate',
      label: 'نسبة هامش المساهمة (CM%)',
      hand: '24 ÷ 30 = 80%',
      expected: rateOf(4n, 5n),
    },
    {
      id: 'be_units',
      label: 'نقطة التعادل بالوحدات (BE units)',
      hand: 'التكلفة الثابتة الكاملة في الشهر 12 = 2,000 + 600 + 1,500 = 4,100؛ 4,100 ÷ 24 = 170.83، وتُقرَّب إلى أعلى: 171 اشتراكًا',
      expected: unitsOf(171n),
    },
    {
      id: 'be_rev',
      label: 'إيراد التعادل الشهري (BE revenue)',
      hand: '4,100 ÷ 0.8 = 5,125 د.أ',
      expected: moneyOf(5_125_000n),
    },
    {
      id: 'be_month',
      label: 'شهر التعادل (BE month)',
      hand: 'ربح الشهر 5: 160 × 24 − 4,100 = −260 (خسارة)، وربح الشهر 6: 200 × 24 − 4,100 = 700 (أول شهر غير سالب)',
      expected: monthOf(6),
    },
    {
      id: 'tax_y1',
      label: 'ضريبة السنة الأولى (قاعدة تجريبية)',
      hand: 'الشركة: 20% من الربح، والربح سالب فالأساس صفر. 0 د.أ',
      expected: moneyOf(0n),
    },
    {
      id: 'funding_need',
      label: 'احتياج التمويل',
      hand: 'التأسيس 12,000؛ خسائر الأشهر 1 إلى 5: 2,600 + 1,640 + 680 + 1,220 + 260 = 6,400. أدنى رصيد تراكمي −12,000 − 6,400 = −18,400 د.أ',
      expected: moneyOf(18_400_000n),
    },
    {
      id: 'funding_month',
      label: 'شهر أدنى رصيد',
      hand: 'بعد الشهر 5 يصير الربح الشهري 700 فيبدأ الرصيد بالصعود',
      expected: monthOf(5),
    },
    {
      id: 'payback',
      label: 'مدة الاسترداد (Payback) بالأشهر',
      hand: 'من الشهر 6 يربح المشروع 700 كل شهر، وضريبة السنة الثانية (20% × 8,400 = 1,680) تُدفع في الشهر 28. رصيد الشهر 34 = −18,400 + 700 × 29 − 1,680 = 220، وهو أول رصيد غير سالب يبقى كذلك',
      expected: monthOf(34),
    },
    {
      id: 'ltv',
      label: 'قيمة العميل على مدى عمره (LTV)',
      hand: 'التسرّب 5% شهريًا: 24 ÷ 0.05 = 480 د.أ',
      expected: moneyOf(480_000n),
    },
    {
      id: 'cac',
      label: 'تكلفة اكتساب العميل (CAC)',
      hand: 'عملاء الشهر 12 الجدد = 200 − 200 × 0.95 = 10؛ 600 ÷ 10 = 60 د.أ',
      expected: moneyOf(60_000n),
    },
    {
      id: 'ltv_cac',
      label: 'نسبة LTV إلى CAC',
      hand: '480 ÷ 60 = 8',
      expected: rateOf(8n, 1n),
    },
    {
      id: 'floor',
      label: 'سعر الحدّ الأدنى (T7)',
      hand: '6 + 44,700 ÷ 1,800 = 30.833 د.أ، والسعر 30 أقل منه',
      expected: moneyOf(30_833n),
    },
  ],
  paymentVariants: [],
};

/*
 * Project 2: a Jordanian home shop selling imported goods online. A flat level of 100 units a
 * month with a season on November and December (150 in a peak month, 90 in the others), sold in
 * three instalments. G1 is "not sure yet": the sole proprietor is assumed.
 */
const ecommerce: GoldenProject = {
  name: 'jo-home-ecommerce',
  title: 'متجر إلكتروني منزلي للبضائع المستوردة',
  sentence:
    'متجر إلكتروني يُدار من المنزل في الأردن ويبيع بضاعة مستوردة بسعر 40 د.أ للقطعة، وموسمه في نوفمبر وديسمبر، ويقبل الدفع على ثلاث دفعات.',
  currencyLabel: 'د.أ',
  context: { country: 'JO', currency: 'JOD', mode: 'full', referenceDate: REFERENCE_DATE },
  answers: {
    F1: real(money(40, 'JOD')),
    F2: real('fixed'),
    F3: real(items('JOD', ['سعر شراء البضاعة', 22], ['الشحن والتغليف', 3])),
    F4: real(items('JOD', ['غرفة التخزين', 700], ['الإنترنت والأدوات', 200])),
    'F4.1': real(money(300, 'JOD')),
    F5: real(
      items('JOD', ['الموقع الإلكتروني', 3000], ['المخزون الأول', 5000], ['التصوير والعرض', 1000]),
    ),
    F6: real({ month1: 150, month6: 90, month12: 90 }),
    D7: real({ seasonal: true, peakMonths: [11, 12] }),
    E7: real(200),
    F7: real('instalments'),
    D4: real({
      items: [
        { name: 'متجر أ', price: money(45, 'JOD') },
        { name: 'متجر ب', price: money(42, 'JOD') },
        { name: 'متجر ج', price: money(38, 'JOD') },
      ],
    }),
    D6: real({ answer: true, percent: 60 }),
    G1: real('dont_know'),
    A5: real({ min: 3000, max: 6000, currency: 'JOD' }),
    A7: real('gt12'),
    H5: real('m6'),
  },
  provenance: {
    F1: userHigh,
    F2: userHigh,
    F3: userHigh,
    F4: userHigh,
    'F4.1': userHigh,
    F5: userMedium,
    F6: { source: 'user', confidence: 'medium', validated: false },
    D7: userHigh,
    E7: userHigh,
    F7: userHigh,
    D4: userHigh,
    D6: assumedMedium,
    G1: userHigh,
    A5: userHigh,
    A7: userHigh,
    H5: userHigh,
  },
  tax: { rules: JORDAN_FIXTURE_RULES },
  rows: [
    {
      id: 'revenue_y1',
      label: 'إيراد السنة الأولى',
      hand: 'شهرا الذروة (نوفمبر وديسمبر): 150 × 40 = 6,000 لكل شهر؛ و10 أشهر عادية: 90 × 40 = 3,600 لكل شهر. 2 × 6,000 + 10 × 3,600 = 48,000 د.أ',
      expected: moneyOf(48_000_000n),
    },
    {
      id: 'profit_y1',
      label: 'ربح التشغيل قبل الضريبة في السنة الأولى',
      hand: 'الإيراد 48,000 − التكلفة المتغيرة لـ 1,200 وحدة (1,200 × 25 = 30,000) − التكاليف الثابتة والتسويق ((900 + 300) × 12 = 14,400) = 3,600 د.أ',
      expected: moneyOf(3_600_000n),
    },
    {
      id: 'cm',
      label: 'هامش المساهمة للوحدة (CM)',
      hand: '40 − 25 = 15 د.أ',
      expected: moneyOf(15_000n),
    },
    {
      id: 'cm_rate',
      label: 'نسبة هامش المساهمة (CM%)',
      hand: '15 ÷ 40 = 37.5%',
      expected: rateOf(3n, 8n),
    },
    {
      id: 'be_units',
      label: 'نقطة التعادل بالوحدات (BE units)',
      hand: '1,200 ÷ 15 = 80 وحدة بالضبط',
      expected: unitsOf(80n),
    },
    {
      id: 'be_rev',
      label: 'إيراد التعادل الشهري (BE revenue)',
      hand: '1,200 ÷ 0.375 = 3,200 د.أ',
      expected: moneyOf(3_200_000n),
    },
    {
      id: 'be_month',
      label: 'شهر التعادل (BE month)',
      hand: 'ربح الشهر 1: 150 × 15 − 1,200 = 1,050، وهو غير سالب',
      expected: monthOf(1),
    },
    {
      id: 'tax_y1',
      label: 'ضريبة السنة الأولى (قاعدة تجريبية)',
      hand: 'الشكل القانوني غير محسوم فيُفترض صاحب منشأة فردية: 10% × 3,600 = 360 د.أ',
      expected: moneyOf(360_000n),
    },
    {
      id: 'funding_need',
      label: 'احتياج التمويل',
      hand: 'التأسيس 9,000. بالتقسيط يصل في الشهر 1 ثلث مبيعاته فقط: 2,000 − 4,950 = −2,950، وفي الشهر 2: 4,000 − 4,950 = −950. أدنى رصيد −9,000 − 2,950 − 950 = −12,900 د.أ',
      expected: moneyOf(12_900_000n),
    },
    {
      id: 'funding_month',
      label: 'شهر أدنى رصيد',
      hand: 'في الشهر 3 يصل 5,200 ويزيد على المصروف 3,450 فيصعد الرصيد',
      expected: monthOf(2),
    },
    {
      id: 'payback',
      label: 'مدة الاسترداد (Payback) بالأشهر',
      hand: 'رصيد الشهر 36 ما زال −2,520 د.أ، أي أن التأسيس لا يُسترد خلال ثلاث سنوات',
      expected: monthOf(null),
    },
    {
      id: 'floor',
      label: 'سعر الحدّ الأدنى (T7)',
      hand: '25 + 14,400 ÷ 1,200 = 37 د.أ، والسعر 40 فوقه',
      expected: moneyOf(37_000n),
    },
  ],
  paymentVariants: [
    {
      option: 'cash',
      hand: 'كل بيع يُحصَّل في شهره فيكون الربح الشهري هو التدفق: 1,050 في الذروة و150 في غيرها. أدنى رصيد هو التأسيس −9,000 في الشهر 0. بعد ضريبتي السنتين الأوليين (360 في الشهر 16 و360 في الشهر 28) يلمس الرصيد الصفر في الشهر 27 (+90) ثم تعيده ضريبة الشهر 28 إلى −120، فيبقى غير سالب من الشهر 29',
      fundingNeed: 9_000_000n,
      fundingMonth: 0,
      payback: 29,
    },
    {
      option: 'credit',
      hand: 'التحصيل بعد شهر: في الشهر 1 لا يصل شيء فيكون 0 − 4,950، فيهبط الرصيد إلى −9,000 − 4,950 = −13,950 د.أ، ويبقى سالبًا في الشهر 36 (−2,520)',
      fundingNeed: 13_950_000n,
      fundingMonth: 1,
      payback: null,
    },
    {
      option: 'instalments',
      hand: 'ثلاث دفعات: الحساب في جدول الأرقام الرئيسية أعلاه (12,900 د.أ في الشهر 2)',
      fundingNeed: 12_900_000n,
      fundingMonth: 2,
      payback: null,
    },
    {
      option: 'deposit',
      hand: 'نصف عند البيع والنصف في الشهر التالي: الشهر 1 يصل 3,000 فيكون 3,000 − 4,950 = −1,950 ويهبط الرصيد إلى −10,950 د.أ، ويبقى سالبًا في الشهر 36 (−720)',
      fundingNeed: 10_950_000n,
      fundingMonth: 1,
      payback: null,
    },
  ],
};

/*
 * Project 3: an Algerian auto-entrepreneur selling home-made food (DZD, 2 decimals). A straight
 * line from 0 to 100 units in months 1 to 6, flat to month 12, then 100% growth a year, so that
 * turnover crosses the 5,000,000 DZD ceiling of the regime in year 3 and not before. A deposit of
 * half at the sale and half the month after.
 */
const algeria: GoldenProject = {
  name: 'dz-auto-entrepreneur',
  title: 'مقاول ذاتي يبيع أكلات منزلية في الجزائر',
  sentence:
    'مقاول ذاتي في الجزائر يبيع علبة أكل منزلي بسعر 2,000 DZD، ويضاعف مبيعاته كل سنة بعد السنة الأولى، فيتجاوز في السنة الثالثة سقف النظام المبسّط.',
  currencyLabel: 'DZD',
  context: { country: 'DZ', currency: 'DZD', mode: 'full', referenceDate: REFERENCE_DATE },
  answers: {
    F1: real(money(2000, 'DZD')),
    F2: real('fixed'),
    F3: real(items('DZD', ['مواد التحضير', 650], ['التغليف والتوصيل', 150])),
    F4: real(items('DZD', ['إيجار المطبخ', 30000], ['الكهرباء والاتصالات', 10000])),
    'F4.1': real(money(10000, 'DZD')),
    F5: real(
      items(
        'DZD',
        ['تجهيزات المطبخ', 220000],
        ['التسجيل كمقاول ذاتي', 30000],
        ['مخزون أولي وتغليف', 50000],
      ),
    ),
    F6: real({ month1: 0, month6: 100, month12: 100 }),
    'F6.2': real(100),
    D7: UNKNOWN,
    F7: real('deposit'),
    D4: real({
      items: [
        { name: 'منافس أ', price: money(2200, 'DZD') },
        { name: 'منافس ب', price: money(1800, 'DZD') },
      ],
    }),
    D6: real({ answer: false }),
    G1: real('sole'),
    A5: real({ min: 200000, max: 400000, currency: 'DZD' }),
    A7: real('3to6'),
    H5: real('m6'),
  },
  provenance: {
    F1: userHigh,
    F2: userHigh,
    F3: userHigh,
    F4: userHigh,
    'F4.1': userMedium,
    F5: userHigh,
    F6: userMedium,
    'F6.2': userGuess,
    F7: userHigh,
    D4: userHigh,
    D6: userHigh,
    G1: userHigh,
    A5: userHigh,
    A7: userHigh,
    H5: userHigh,
  },
  tax: { rules: ALGERIA_FIXTURE_RULES },
  rows: [
    {
      id: 'revenue_y1',
      label: 'إيراد السنة الأولى',
      hand: 'الوحدات في الأشهر 1 إلى 6: 0 + 20 + 40 + 60 + 80 + 100 = 300، وفي الأشهر 7 إلى 12: 100 × 6 = 600؛ المجموع 900 علبة. 900 × 2,000 = 1,800,000 DZD',
      expected: moneyOf(180_000_000n),
    },
    {
      id: 'profit_y1',
      label: 'ربح التشغيل قبل الضريبة في السنة الأولى',
      hand: 'الإيراد 1,800,000 − التكلفة المتغيرة (900 × 800 = 720,000) − التكاليف الثابتة والتسويق ((40,000 + 10,000) × 12 = 600,000) = 480,000 DZD',
      expected: moneyOf(48_000_000n),
    },
    {
      id: 'cm',
      label: 'هامش المساهمة للوحدة (CM)',
      hand: '2,000 − 800 = 1,200 DZD',
      expected: moneyOf(120_000n),
    },
    {
      id: 'cm_rate',
      label: 'نسبة هامش المساهمة (CM%)',
      hand: '1,200 ÷ 2,000 = 60%',
      expected: rateOf(3n, 5n),
    },
    {
      id: 'be_units',
      label: 'نقطة التعادل بالوحدات (BE units)',
      hand: '50,000 ÷ 1,200 = 41.67، وتُقرَّب إلى أعلى: 42 علبة',
      expected: unitsOf(42n),
    },
    {
      id: 'be_rev',
      label: 'إيراد التعادل الشهري (BE revenue)',
      hand: '50,000 ÷ 0.6 = 83,333.33 DZD',
      expected: moneyOf(8_333_333n),
    },
    {
      id: 'be_month',
      label: 'شهر التعادل (BE month)',
      hand: 'ربح الشهر 3: 40 × 1,200 − 50,000 = −2,000 (خسارة)، وربح الشهر 4: 60 × 1,200 − 50,000 = 22,000',
      expected: monthOf(4),
    },
    {
      id: 'tax_y1',
      label: 'ضريبة السنة الأولى (قاعدة تجريبية بقيم SPEC)',
      hand: '0.5% × 1,800,000 = 9,000 وهو أقل من الحدّ الأدنى 10,000، فيُدفع الحدّ الأدنى: 10,000 DZD',
      expected: moneyOf(1_000_000n),
    },
    {
      id: 'funding_need',
      label: 'احتياج التمويل',
      hand: 'التأسيس 300,000. صافي النقد في الأشهر 1 إلى 3: −50,000 و−46,000 و−22,000 (نصف المبيع يصل في شهره والنصف في التالي). أدنى رصيد −300,000 − 118,000 = −418,000 DZD',
      expected: moneyOf(41_800_000n),
    },
    {
      id: 'funding_month',
      label: 'شهر أدنى رصيد',
      hand: 'في الشهر 4 يصير صافي النقد موجبًا (+2,000)',
      expected: monthOf(3),
    },
    {
      id: 'payback',
      label: 'مدة الاسترداد (Payback) بالأشهر',
      hand: 'صافي النقد بعد الشهر 3: +2,000 و+26,000 و+50,000 ثم +70,000 كل شهر. رصيد الشهر 10 = −60,000، ورصيد الشهر 11 = +10,000، ويبقى موجبًا بعده',
      expected: monthOf(11),
    },
    {
      id: 'floor',
      label: 'سعر الحدّ الأدنى (T7)',
      hand: '800 + 600,000 ÷ 900 = 1,466.67 DZD، والسعر 2,000 فوقه',
      expected: moneyOf(146_667n),
    },
    {
      id: 'turnover_y2',
      label: 'مبيعات السنة الثانية',
      hand: 'يرتفع المستوى من 100 إلى 200 (نمو 100%) بنسبة ثابتة كل شهر. الوحدات 106 و112 و119 و126 و133 و141 و150 و159 و168 و178 و189 و200، أي 1,781 وحدة. 1,781 × 2,000 = 3,562,000 DZD، تحت السقف',
      expected: moneyOf(356_200_000n),
    },
    {
      id: 'turnover_y3',
      label: 'مبيعات السنة الثالثة',
      hand: 'يرتفع المستوى من 200 إلى 400. الوحدات 212 و224 و238 و252 و267 و283 و300 و317 و336 و356 و378 و400، أي 3,563 وحدة. 3,563 × 2,000 = 7,126,000 DZD، فوق سقف 5,000,000',
      expected: moneyOf(712_600_000n),
    },
  ],
  paymentVariants: [],
};

/** The three golden projects, in the order of the review page. */
export const GOLDEN_PROJECTS: readonly GoldenProject[] = [subscription, ecommerce, algeria];

/** Runs the engine on a golden project; throws if the answers are not calculable. */
export function runGolden(project: GoldenProject): EngineRun {
  const result = runEngine(project.answers, project.provenance, project.context, project.tax);
  if (result.status !== 'ok') {
    throw new Error(`${project.name} is not calculable: ${JSON.stringify(result.reasons)}`);
  }
  return result.run;
}

/** The project run again with F7 set to `option`; the rest of the answers stay as they are. */
export function runWithPayment(
  project: GoldenProject,
  option: PaymentVariantRow['option'],
): EngineRun {
  return runGolden({ ...project, answers: { ...project.answers, F7: real(option) } });
}

const yearOne = (run: EngineRun, line: readonly Money[]): Money =>
  sumMoney(run.input.currency, line.slice(0, 12));

function need<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`The run has no ${what}.`);
  return value;
}

function okEconomics(run: EngineRun) {
  if (run.unitEconomics.status !== 'ok') throw new Error('T8 is blocked.');
  return run.unitEconomics;
}

function okCashFlow(run: EngineRun) {
  if (run.cash.cashFlow.status !== 'ok') throw new Error('The cash flow is not calculable.');
  return run.cash.cashFlow;
}

function taxYear(run: EngineRun, year: number) {
  if (run.cash.tax.status !== 'calculated') throw new Error('The tax was not calculated.');
  return need(run.cash.tax.years[year - 1], `tax year ${String(year)}`);
}

/** What the engine gave for a headline number, in the same shape as `Expected`. */
export function headlineValue(run: EngineRun, id: HeadlineId): Expected {
  switch (id) {
    case 'revenue_y1':
      return moneyOf(yearOne(run, run.projection.revenue.monthly).minor);
    case 'profit_y1':
      return moneyOf(yearOne(run, run.projection.operatingProfit.monthly).minor);
    case 'cm':
      return moneyOf(okEconomics(run).contributionMargin.value.minor);
    case 'cm_rate':
      return { kind: 'rate', rate: okEconomics(run).contributionMarginRate.value };
    case 'be_units':
      return unitsOf(okEconomics(run).breakEvenUnits.value);
    case 'be_rev':
      return moneyOf(okEconomics(run).breakEvenRevenue.value.minor);
    case 'be_month':
      return monthOf(okEconomics(run).breakEvenMonth.value);
    case 'tax_y1':
      return moneyOf(taxYear(run, 1).total.value.minor);
    case 'funding_need':
      return moneyOf(okCashFlow(run).fundingNeed.value.minor);
    case 'funding_month':
      return monthOf(okCashFlow(run).lowest.value.month);
    case 'payback':
      return monthOf(okCashFlow(run).payback.value);
    case 'ltv':
      return moneyOf(need(okEconomics(run).subscription?.ltv, 'LTV').value.minor);
    case 'cac':
      return moneyOf(need(okEconomics(run).subscription?.cac, 'CAC').value.minor);
    case 'ltv_cac':
      return { kind: 'rate', rate: need(okEconomics(run).subscription?.ltvToCac, 'LTV/CAC').value };
    case 'floor':
      return moneyOf(need(run.pricing.floor, 'floor').value.minor);
    case 'turnover_y2':
      return moneyOf(taxYear(run, 2).turnover.minor);
    case 'turnover_y3':
      return moneyOf(taxYear(run, 3).turnover.minor);
  }
}

/** Whether the engine's value is the value the hand computation expects. */
export function sameValue(a: Expected, b: Expected): boolean {
  switch (a.kind) {
    case 'money':
      return b.kind === 'money' && a.minor === b.minor;
    case 'units':
      return b.kind === 'units' && a.units === b.units;
    case 'month':
      return b.kind === 'month' && a.month === b.month;
    case 'rate':
      return b.kind === 'rate' && compareRates(a.rate, b.rate) === 0;
  }
}

/** What the engine gave when a project was run under one of its F7 variants. */
export interface PaymentVariantResult {
  readonly row: PaymentVariantRow;
  readonly fundingNeed: bigint;
  readonly fundingMonth: number;
  readonly payback: number | null;
}

/** Runs a project under each of its F7 variants and reads the funding need and the payback. */
export function paymentVariantResults(project: GoldenProject): readonly PaymentVariantResult[] {
  return project.paymentVariants.map((row) => {
    const flow = okCashFlow(runWithPayment(project, row.option));
    return {
      row,
      fundingNeed: flow.fundingNeed.value.minor,
      fundingMonth: flow.lowest.value.month,
      payback: flow.payback.value,
    };
  });
}
