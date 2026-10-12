import type { Alert, AlertValue } from './alerts';
import { at } from './array';
import type { CashFlowNote } from './cash-flow';
import {
  suggestChanges,
  type Change,
  type ChangeLever,
  type LeverShift,
  type SuggestedChanges,
} from './changes';
import type { PivotalId } from './confidence';
import type { CriterionId, CriterionStatus } from './feasibility';
import type { Figure } from './figure';
import type { EngineNote } from './input';
import {
  GOLDEN_PROJECTS,
  changesAgreement,
  decisionAgreement,
  headlineValue,
  paymentVariantResults,
  runGolden,
  sameValue,
  type Expected,
  type GoldenProject,
  type HeadlineId,
  type PaymentVariantResult,
} from './golden-projects';
import { moneyFromMajor, moneyToMajorString, type Money } from './money';
import { PARAM_KEYS } from './params';
import { negateRate, rateToDecimalString, rateToPercentString, type Rate } from './rate';
import type { EngineRun, RunAlert } from './run';
import type { Scenarios, ScenarioResult, TornadoVariable } from './scenarios';
import type { TaxAlert } from './tax';
import type { CostClass } from './validation-plan';
import { VERDICT_CASES } from './verdict-cases';
import type { BlockerCode, HoldBack, Verdict } from './verdict';
import { ENGINE_VERSION } from './version';

/*
 * The owner review page (D-178, D-223): one self-contained HTML file rendered from the three
 * golden runs. A document for the owner, not an app route. Modern Standard Arabic, right to left,
 * Western digits isolated, the currency label after the number, the brand colours only, no script
 * and no request to anywhere. Pure: the same runs give the same bytes (no locale, no time zone, no
 * Intl, no floating point).
 */

/** What the page needs for one project. */
export interface ReviewEntry {
  readonly project: GoldenProject;
  readonly run: EngineRun;
  readonly variants: readonly PaymentVariantResult[];
  /** The changes that would change the verdict (D-228), searched for the same run and tax. */
  readonly changes: SuggestedChanges;
}

/** The entries of the three golden projects, as the review page shows them. */
export function goldenReviewEntries(): readonly ReviewEntry[] {
  return GOLDEN_PROJECTS.map((project) => {
    const run = runGolden(project);
    return {
      project,
      run,
      variants: paymentVariantResults(project),
      changes: suggestChanges(run, project.tax),
    };
  });
}

/** The entries of the four synthetic cases of the verdict, as the review page shows them (D-247). */
export function caseReviewEntries(): readonly ReviewEntry[] {
  return VERDICT_CASES.map((project) => {
    const run = runGolden(project);
    return { project, run, variants: [], changes: suggestChanges(run, project.tax) };
  });
}

// ---------------------------------------------------------------------------------------------
// Text and numbers

/** The named entity of a character that HTML needs escaped (named only: a numeric one holds digits). */
function entity(char: string): string {
  switch (char) {
    case '&':
      return '&amp;';
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    case '"':
      return '&quot;';
    default:
      return '&apos;';
  }
}

/** Escapes text for HTML with named entities only: a numeric entity would hold digits to isolate. */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, entity);
}

/**
 * Arithmetic and numbers are left-to-right inside right-to-left text: a run of digits and the
 * signs between them (`1,800 × 30 = 54,000`), or a question or tool ID (`F6.2`, `T7`), is wrapped in
 * a `bdi` so that its order does not depend on the words around it (CLAUDE.md §6).
 */
const ISOLATED =
  /(?<![A-Za-z\d.])[−+-]?\(*\d(?:[\d\s,.+−×÷=()%-]*[\d)%])?|(?<![A-Za-z\d.])[A-Z]+\d+(?:\.\d+)?(?![A-Za-z\d])/g;

/** The positions of the brackets in `run` that have no partner inside it. */
function unmatchedBrackets(run: string): Set<number> {
  const open: number[] = [];
  const lone = new Set<number>();
  for (let index = 0; index < run.length; index += 1) {
    const char = run.charAt(index);
    if (char === '(') open.push(index);
    else if (char === ')' && open.pop() === undefined) lone.add(index);
  }
  for (const index of open) lone.add(index);
  return lone;
}

/**
 * One isolated run. A bracket without its partner inside the run stays outside the isolate, in the
 * right-to-left text, so that the pair is not split between the two directions: `3 (7,126,000 DZD)`
 * isolates `3` and `7,126,000` and leaves both brackets to the surrounding text.
 */
function isolate(run: string): string {
  const lone = unmatchedBrackets(run);
  if (lone.size === 0) return `<bdi dir="ltr">${run}</bdi>`;
  let out = '';
  let piece = '';
  const flush = (): void => {
    const trimmed = piece.trim();
    if (!/\d/.test(trimmed)) out += piece;
    else {
      const start = piece.indexOf(trimmed);
      out += `${piece.slice(0, start)}<bdi dir="ltr">${trimmed}</bdi>${piece.slice(start + trimmed.length)}`;
    }
    piece = '';
  };
  for (let index = 0; index < run.length; index += 1) {
    const char = run.charAt(index);
    if (lone.has(index)) {
      flush();
      out += char;
    } else piece += char;
  }
  flush();
  return out;
}

/** Escaped text with its numbers and IDs isolated. */
export function h(text: string): string {
  return esc(text).replace(ISOLATED, isolate);
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "-12345.600" as "-12,345.6": thousands grouped, no trailing zeros. */
export function formatPlain(plain: string): string {
  const sign = plain.startsWith('-') ? '-' : '';
  const [whole = '', fraction = ''] = plain.replace('-', '').split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return `${sign}${group(whole)}${trimmed === '' ? '' : `.${trimmed}`}`;
}

/** An amount as the page writes it: the number, then the currency label. */
export function formatMoney(money: Money, label: string): string {
  return `${formatPlain(moneyToMajorString(money))} ${label}`;
}

const trimRate = (text: string): string =>
  text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;

/** A rate as a percentage with the sign: 3/8 is "37.5%". */
export function formatPercent(rate: Rate): string {
  return `${trimRate(rateToPercentString(rate, 2))}%`;
}

/** A ratio as a plain number: 8 or 0.6. */
export function formatRatio(rate: Rate): string {
  return trimRate(rateToDecimalString(rate, 4));
}

/** "1 month", "2 months", "3 to 10 months", "11 or more months" in Arabic. */
export function monthsPhrase(count: number): string {
  if (count === 1) return 'شهر واحد';
  if (count === 2) return 'شهران';
  return count <= 10 ? `${String(count)} أشهر` : `${String(count)} شهرًا`;
}

/** How a project's money is written: its currency code (for the decimals) and the label after the number. */
export interface Fmt {
  readonly currency: string;
  readonly label: string;
  /** The run's horizon in months, for the sentences about "within the horizon"; 36 when absent. */
  readonly horizon?: number;
}

const DEFAULT_HORIZON = 36;

const fmtOf = (project: GoldenProject, horizon: number = DEFAULT_HORIZON): Fmt => ({
  currency: project.context.currency,
  label: project.currencyLabel,
  horizon,
});

const horizonOf = (fmt: Fmt): number => fmt.horizon ?? DEFAULT_HORIZON;

/** "Not within N months" for a payback or a break-even that never comes. */
const withinHorizon = (fmt: Fmt, word: string): string =>
  `${word} خلال ${String(horizonOf(fmt))} شهرًا`;

const money = (minor: bigint, fmt: Fmt): string =>
  formatMoney({ minor, currency: fmt.currency }, fmt.label);

// ---------------------------------------------------------------------------------------------
// Words of the page

const SEVERITY_WORD = { block: 'حاجب', warning: 'تحذير', note: 'ملاحظة' } as const;
const SOURCE_WORD = { user: 'من المؤسس', assumption: 'افتراض', external: 'مصدر خارجي' } as const;
const CONFIDENCE_WORD = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' } as const;

const SCENARIO_WORD: Readonly<Record<keyof Scenarios, string>> = {
  conservative: 'متحفّظ (Conservative)',
  base: 'الأساس (Base)',
  optimistic: 'متفائل (Optimistic)',
};

const TORNADO_WORD: Readonly<Record<TornadoVariable, string>> = {
  price: 'السعر (P)',
  vc: 'التكلفة المتغيرة (VC)',
  sales: 'المبيعات',
  fixed_costs: 'التكاليف الثابتة (FC)',
};

const OPTION_WORD = {
  cash: 'نقدًا عند الشراء',
  credit: 'بالآجل (بعد شهر)',
  instalments: 'بالتقسيط (ثلاث دفعات)',
  deposit: 'دفعة مقدّمة والباقي بعد شهر',
} as const;

const NOTE_WORD: Readonly<Record<EngineNote['code'] | CashFlowNote['code'], string>> = {
  price_from_competitors: 'السعر (F1) غير معروف فأُخذ وسيط أسعار المنافسين (D4).',
  marketing_assumed_zero: 'ميزانية التسويق (F4.1) لم تُحدَّد فاعتُبرت صفرًا.',
  growth_estimated: 'النمو السنوي (F6.2) لم يُحدَّد فقدّره المحرّك من مبيعات الشهرين 6 و12.',
  capacity_unlimited: 'الطاقة القصوى (E7) لم تُحدَّد فلا سقف لعدد الوحدات.',
  seasonality_unset: 'الموسمية (D7) لم تُحدَّد فاعتُبر الطلب غير موسمي.',
  staff_unset: 'خطة الموظفين (E8) لم تُحدَّد فلا رواتب في الحساب.',
  setup_costs_unset: 'تكاليف التأسيس (F5) لم تُحدَّد فلا يُحسب التدفق النقدي.',
  seasonality_ignored: 'نمط الموسمية (D7) فيه أشهر ذروة كثيرة جدًا فتجاهله المحرّك.',
  capacity_reached: 'بلغت المبيعات الطاقة القصوى (E7) في بعض الأشهر فقُصَّت عندها.',
  inflation_not_applied: 'لم يُطبَّق تضخم على التكاليف لأنه لا توجد نسبة موثّقة بمصدرها.',
  churn_unset: 'نسبة التسرّب (F2.1) غير محددة فلا تُحسب قيمة العميل (LTV).',
  capital_unset: 'رأس المال المتاح (A5) غير محدد فلا يُقارَن بتكاليف التأسيس.',
  capital_other_currency: 'رأس المال (A5) بعملة غير عملة المشروع فلا يُقارَن، ولا يوجد تحويل.',
  runway_unset: 'مدة التحمّل بلا دخل (A7) غير محددة.',
  break_even_target_unset: 'أطول مدة مقبولة حتى التعادل (H5) غير محددة.',
  legal_form_assumed_sole: 'الشكل القانوني (G1) غير محسوم فافترض المحرّك صاحب منشأة فردية.',
  foreign_exposure_unset:
    'حصة التكاليف المرتبطة بعملة أجنبية (D6) غير محددة فلا يُجرى اختبار العملة.',
  financing_unset: 'مصدر التمويل (H3) غير محدد فلا يُطبَّق حاجب احتياج التمويل في القرار.',
  worry_unset: 'أكبر ما يقلق المؤسس (H6) غير محدد فلا يتصدّر خطة التحقّق.',
  receipts_after_horizon: 'جزء من النقد يصل بعد الشهر {horizon} فلم يدخل في الحساب.',
  tax_after_horizon: 'ضريبة السنة الأخيرة تُدفع بعد الشهر {horizon} فلم تدخل في الحساب.',
  tax_not_calculated: 'لم تُحسب ضريبة، فالتدفق النقدي قبل الضريبة.',
  payment_assumed_cash: 'طريقة دفع العميل (F7) لم تُحدَّد فافتُرض الدفع نقدًا.',
};

// ---------------------------------------------------------------------------------------------
// The founder's inputs, in words

const INPUT_ORDER = [
  'F1',
  'F2',
  'F2.1',
  'F3',
  'F4',
  'F4.1',
  'E8',
  'F5',
  'F6',
  'F6.2',
  'D7',
  'E7',
  'F7',
  'D4',
  'D6',
  'G1',
  'A5',
  'A7',
  'H3',
  'H5',
  'H6',
] as const;

const INPUT_LABEL: Readonly<Record<(typeof INPUT_ORDER)[number], string>> = {
  F1: 'سعر البيع للوحدة (F1)',
  F2: 'نموذج التسعير (F2)',
  'F2.1': 'نسبة تسرّب المشتركين شهريًا (F2.1)',
  F3: 'التكلفة المتغيرة للوحدة (F3)',
  F4: 'التكاليف الثابتة الشهرية (F4)',
  'F4.1': 'ميزانية التسويق الشهرية (F4.1)',
  E8: 'الموظفون (E8)',
  F5: 'تكاليف التأسيس (F5)',
  F6: 'المبيعات المتوقعة بالوحدات (F6)',
  'F6.2': 'النمو السنوي بعد السنة الأولى (F6.2)',
  D7: 'الموسمية (D7)',
  E7: 'الطاقة القصوى شهريًا (E7)',
  F7: 'طريقة دفع العميل (F7)',
  D4: 'أسعار المنافسين (D4)',
  D6: 'حصة التكاليف المرتبطة بالاستيراد (D6)',
  G1: 'الشكل القانوني (G1)',
  A5: 'رأس المال المتاح (A5)',
  A7: 'المدة التي يتحمّلها بلا دخل (A7)',
  H3: 'مصدر التمويل (H3)',
  H5: 'أطول مدة مقبولة حتى التعادل (H5)',
  H6: 'أكبر ما يقلقه أو لا يعرفه (H6)',
};

const OPTION_TEXT: Readonly<Record<string, string>> = {
  fixed: 'سعر ثابت',
  subscription: 'اشتراك',
  hourly: 'بالساعة',
  commission: 'عمولة',
  bundles: 'باقات',
  cash: 'نقدًا عند الشراء',
  credit: 'بالآجل',
  instalments: 'بالتقسيط',
  deposit: 'دفعة مقدّمة والباقي لاحقًا',
  sole: 'منشأة فردية',
  company: 'شركة',
  dont_know: 'لم أقرّر بعد',
  lt3: 'أقل من 3 أشهر',
  '3to6': 'من 3 إلى 6 أشهر',
  '6to12': 'من 6 إلى 12 شهرًا',
  gt12: 'أكثر من 12 شهرًا',
  m6: 'خلال 6 أشهر',
  m12: 'خلال 12 شهرًا',
  m18: 'خلال 18 شهرًا',
  m24: 'خلال 24 شهرًا',
  m36: 'خلال 36 شهرًا',
  more: 'أكثر من 36 شهرًا',
  self: 'مدخراته الشخصية',
  family: 'العائلة والأصدقاء',
  loan: 'قرض',
  investor: 'مستثمر',
  grant: 'منحة',
  competition: 'جائزة مسابقة',
};

/** The words for an option ID of the question bank; an ID without words is written as it is. */
const optionText = (option: string): string => OPTION_TEXT[option] ?? option;

const MONTH_NAME = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

interface AnyMoney {
  readonly amount: number;
  readonly currency: string;
}

/** An amount of the answers (major units, as typed) in the page's way of writing money. */
function amountText(amount: AnyMoney, fmt: Fmt): string {
  return formatMoney(moneyFromMajor(amount.amount, amount.currency), fmt.label);
}

function describeValue(id: (typeof INPUT_ORDER)[number], value: unknown, fmt: Fmt): string {
  const text = (amount: AnyMoney) => amountText(amount, fmt);
  switch (id) {
    case 'F1':
    case 'F4.1':
      return text(value as AnyMoney);
    case 'F2':
    case 'F7':
    case 'G1':
    case 'A7':
    case 'H5':
      return optionText(value as string);
    case 'F2.1':
    case 'F6.2':
      return `${String(value)}%`;
    case 'F3':
    case 'F4':
    case 'F5': {
      const rows = (value as { items: { label: string; amount: number; currency: string }[] })
        .items;
      const total = rows.reduce((sum, row) => sum + row.amount, 0);
      return `${rows.map((row) => `${row.label}: ${text(row)}`).join('، ')}. المجموع ${text({ amount: total, currency: fmt.currency })}`;
    }
    case 'E8': {
      const rows = (
        value as { items: { role: string; monthlyCost: AnyMoney; startMonth: number }[] }
      ).items;
      return rows.length === 0
        ? 'لا موظفين'
        : rows
            .map(
              (row) =>
                `${row.role}: ${text(row.monthlyCost)} شهريًا من الشهر ${String(row.startMonth)}`,
            )
            .join('، ');
    }
    case 'F6': {
      const sales = value as { month1: number; month6: number; month12: number };
      return `الشهر 1: ${String(sales.month1)}، الشهر 6: ${String(sales.month6)}، الشهر 12: ${String(sales.month12)} وحدة`;
    }
    case 'D7': {
      const season = value as { seasonal: boolean; peakMonths: number[] };
      return season.seasonal
        ? `موسمي، وذروته في ${season.peakMonths.map((month) => at(MONTH_NAME, month - 1)).join(' و')}`
        : 'غير موسمي';
    }
    case 'E7':
      return `${String(value)} وحدة`;
    case 'D4': {
      const rows = (value as { items: { name: string; price: AnyMoney | null }[] }).items;
      return rows
        .map((row) => `${row.name}: ${row.price === null ? 'غير معروف' : text(row.price)}`)
        .join('، ');
    }
    case 'D6': {
      const foreign = value as { answer: boolean; percent?: number };
      return foreign.answer ? `نعم، ${String(foreign.percent)}% من التكاليف` : 'لا';
    }
    case 'A5': {
      const range = value as { min: number; max: number; currency: string };
      return `من ${text({ amount: range.min, currency: range.currency })} إلى ${text({ amount: range.max, currency: range.currency })}`;
    }
    case 'H3':
      return (value as { values: string[] }).values.map(optionText).join(' و');
    case 'H6':
      return value as string;
  }
}

/**
 * The answers of a project as lines of words: the label and what the founder said. A question that
 * was not answered reads «لم يُجَب», or is left out when `answeredOnly` is set (the synthetic cases
 * answer only what the verdict reads).
 */
export function describeAnswers(
  project: GoldenProject,
  answeredOnly = false,
): readonly { readonly id: string; readonly label: string; readonly text: string }[] {
  return INPUT_ORDER.filter((id) => !answeredOnly || project.answers[id] !== undefined).map(
    (id) => {
      const answer = project.answers[id];
      const text =
        answer === undefined
          ? 'لم يُجَب'
          : answer.status === 'unknown'
            ? 'لا أعرف'
            : describeValue(id, answer.value, fmtOf(project));
      return { id, label: INPUT_LABEL[id], text };
    },
  );
}

// ---------------------------------------------------------------------------------------------
// Values and alerts

/** A headline value as the page writes it. */
export function describeExpected(id: HeadlineId, value: Expected, fmt: Fmt): string {
  switch (value.kind) {
    case 'money':
      return money(value.minor, fmt);
    case 'units':
      return `${String(value.units)} وحدة`;
    case 'month':
      if (value.month === null) {
        return withinHorizon(fmt, id === 'payback' ? 'لا يُسترد' : 'لا تعادل');
      }
      if (id === 'payback')
        return value.month === 0 ? 'لم ينزل الرصيد تحت الصفر' : monthsPhrase(value.month);
      return `الشهر ${String(value.month)}`;
    case 'rate':
      return id === 'ltv_cac' ? formatRatio(value.rate) : formatPercent(value.rate);
  }
}

function alertValue(value: AlertValue, fmt: Fmt): string {
  switch (value.kind) {
    case 'money':
      return formatMoney(value.money, fmt.label);
    case 'units':
      return `${String(value.units)} وحدة`;
    case 'months':
      return monthsPhrase(value.months);
    case 'months_after':
      return `بعد الشهر ${String(value.months)}`;
    case 'ratio':
      return formatRatio(value.ratio);
  }
}

function taxAlertSentence(alert: TaxAlert, fmt: Fmt): string {
  const year = String(alert.year ?? '');
  const measured = alert.measured === null ? '' : alertValue(alert.measured, fmt);
  const limit = alert.limit === null ? '' : alertValue(alert.limit, fmt);
  switch (alert.code) {
    case 'turnover_above_regime_ceiling':
      return `مبيعات السنة ${year} (${measured}) تتجاوز سقف نظام ${alert.regime ?? ''} (${limit}).`;
    case 'turnover_above_vat_threshold':
      return `مبيعات السنة ${year} (${measured}) تتجاوز حدّ التسجيل في ضريبة القيمة المضافة (${limit}).`;
    case 'tax_regime_not_calculated': {
      const gap = alert.gap;
      if (gap?.code === 'ambiguous_regime') {
        return 'لم يُحسب نظام ضريبي: القواعد المتاحة لأكثر من نظام والمحرّك لا يختار بينها.';
      }
      if (gap?.code === 'rule_other_currency') {
        return `لم يُحسب نظام ضريبي: القواعد بعملة ${gap.currency} وهي غير عملة المشروع، ولا يوجد تحويل.`;
      }
      return 'لم يُحسب نظام ضريبي: لا توجد قاعدة لهذا البلد وهذا الشكل القانوني.';
    }
  }
}

function economicsAlertSentence(alert: Alert, fmt: Fmt): string {
  const measured = alertValue(alert.measured, fmt);
  const limit = alertValue(alert.limit, fmt);
  switch (alert.code) {
    case 'cm_not_positive':
      return `هامش المساهمة (${measured}) ليس موجبًا، فكل وحدة تُباع تخسر أو تتعادل.`;
    case 'break_even_units_above_capacity':
      return `نقطة التعادل (${measured}) أعلى من الطاقة القصوى الشهرية (${limit}).`;
    case 'break_even_month_above_target':
      return `التعادل (${measured}) بعد أطول مدة قبلها المؤسس (${limit}).`;
    case 'break_even_month_above_runway':
      return `التعادل (${measured}) بعد المدة التي يتحمّلها المؤسس بلا دخل (${limit}).`;
    case 'setup_costs_above_capital':
      return `تكاليف التأسيس (${measured}) أعلى من أقصى رأس مال متاح (${limit}).`;
    case 'setup_costs_within_capital_range':
      return `تكاليف التأسيس (${measured}) فوق أدنى رأس مال متاح (${alert.lowerLimit === undefined ? '' : alertValue(alert.lowerLimit, fmt)}) وتحت أقصاه (${limit}).`;
    case 'price_below_floor':
      return `السعر (${measured}) أقل من سعر الحدّ الأدنى (${limit}).`;
    case 'ltv_to_cac_below_minimum':
      return `نسبة LTV إلى CAC (${measured}) أقل من الحدّ الأدنى (${limit}).`;
  }
}

/** The sentence of an alert in plain words, from its code and its measured values. */
export function alertSentence(alert: RunAlert, fmt: Fmt): string {
  return alert.origin === 'tax' ? taxAlertSentence(alert, fmt) : economicsAlertSentence(alert, fmt);
}

const provenanceText = (figure: {
  source: keyof typeof SOURCE_WORD;
  confidence: keyof typeof CONFIDENCE_WORD;
  validated: boolean;
}): string =>
  `${SOURCE_WORD[figure.source]}، الثقة ${CONFIDENCE_WORD[figure.confidence]}، ${figure.validated ? 'مؤكَّد' : 'غير مؤكَّد'}`;

// ---------------------------------------------------------------------------------------------
// The tables

const cell = (label: string, content: string, className = ''): string =>
  `<td data-label="${esc(label)}"${className === '' ? '' : ` class="${className}"`}>${content}</td>`;

const key = (text: string): string => `<strong class="key">${h(text)}</strong>`;

const mark = (agrees: boolean): string =>
  agrees ? '<span class="mark">✓ مطابق</span>' : '<span class="mark bad">✕ غير مطابق</span>';

function table(caption: string, headers: readonly string[], rows: readonly string[]): string {
  return [
    '<table class="stack">',
    `<caption>${h(caption)}</caption>`,
    `<thead><tr>${headers.map((header) => `<th scope="col">${h(header)}</th>`).join('')}</tr></thead>`,
    `<tbody>${rows.join('\n')}</tbody>`,
    '</table>',
  ].join('\n');
}

function headlineTable(entry: ReviewEntry): string {
  const { project, run } = entry;
  const rows = project.rows.map((row) => {
    const actual = headlineValue(run, row.id);
    return `<tr><th scope="row" data-label="الرقم">${h(row.label)}</th>${cell('الحساب اليدوي', h(row.hand))}${cell('ناتج المحرّك', key(describeExpected(row.id, actual, fmtOf(project, run.projection.calendar.horizonMonths))))}${cell('المطابقة', mark(sameValue(row.expected, actual)))}</tr>`;
  });
  return table(
    'الأرقام الرئيسية، كل رقم بجانب حسابه اليدوي',
    ['الرقم', 'الحساب اليدوي', 'ناتج المحرّك', 'المطابقة'],
    rows,
  );
}

function scenarioText(result: ScenarioResult): string {
  if (result.kind === 'base') return 'أرقام المؤسس كما أدخلها.';
  const delay =
    result.launchDelayMonths > 0
      ? `، وتأخير الإطلاق ${monthsPhrase(result.launchDelayMonths)}`
      : '';
  return `المبيعات × ${formatRatio(result.salesMultiplier)}، والتكلفة المتغيرة × ${formatRatio(result.vcMultiplier)}${delay}.`;
}

function scenarioTable(entry: ReviewEntry): string {
  const { project, run } = entry;
  const horizon = String(run.projection.calendar.horizonMonths);
  const fmt = fmtOf(project, run.projection.calendar.horizonMonths);
  const rows = (['conservative', 'base', 'optimistic'] as const).map((kind) => {
    const result = run.scenarios[kind];
    const funding =
      result.funding.status === 'ok'
        ? key(money(result.funding.need.value.minor, fmt))
        : h('غير محسوب: تكاليف التأسيس (F5) ناقصة');
    const breakEven =
      result.breakEvenMonth.value === null
        ? h(`لا تعادل خلال ${horizon} شهرًا`)
        : h(`الشهر ${String(result.breakEvenMonth.value)}`);
    return `<tr><th scope="row" data-label="السيناريو">${h(SCENARIO_WORD[kind])}</th>${cell('الافتراضات', h(scenarioText(result)))}${cell('شهر التعادل', breakEven)}${cell('احتياج التمويل', funding)}${cell('ربح السنة الأولى', key(money(result.firstYearOperatingProfit.value.minor, fmt)))}</tr>`;
  });
  return table(
    'السيناريوهات الثلاثة (T10)، يعاد فيها الإسقاط والضريبة والتدفق النقدي',
    ['السيناريو', 'الافتراضات', 'شهر التعادل', 'احتياج التمويل', 'ربح السنة الأولى'],
    rows,
  );
}

function tornadoTable(entry: ReviewEntry): string {
  const { project, run } = entry;
  const fmt = fmtOf(project);
  const swing = formatPercent(run.tornado.change.value);
  const rows = run.tornado.rows.map((row, index) => {
    const first = row.variable === run.tornado.top?.value;
    return `<tr><th scope="row" data-label="المتغيّر">${h(TORNADO_WORD[row.variable])}${first ? ` ${h('(أول تجربة مقترحة)')}` : ''}</th>${cell('الترتيب', h(String(index + 1)))}${cell(`عند −${swing}`, h(money(row.atLow.value.minor, fmt)))}${cell(`عند +${swing}`, h(money(row.atHigh.value.minor, fmt)))}${cell('الفرق', key(money(row.swing.value.minor, fmt)))}</tr>`;
  });
  return table(
    `حساسية ربح السنة الأولى (Tornado): كل متغيّر وحده يتحرك ${swing} نزولًا وصعودًا`,
    ['المتغيّر', 'الترتيب', `عند −${swing}`, `عند +${swing}`, 'الفرق'],
    rows,
  );
}

function fxTable(entry: ReviewEntry): string {
  const { project, run } = entry;
  const fx = run.cash.fxTest;
  if (fx === null) return '';
  const fmt = fmtOf(project);
  const rows = fx.shocks.map((shock) => {
    const sign = shock.shock.num > 0n ? '+' : '';
    const funding =
      shock.fundingNeed === null ? h('غير محسوب') : key(money(shock.fundingNeed.value.minor, fmt));
    const month =
      shock.breakEvenMonth.value === null
        ? h('لا تعادل')
        : h(`الشهر ${String(shock.breakEvenMonth.value)}`);
    return `<tr><th scope="row" data-label="الصدمة">${h(`${sign}${formatPercent(shock.shock)}`)}</th>${cell('معامل التكلفة المتغيرة', h(`× ${formatRatio(shock.cogsMultiplier)}`))}${cell('شهر التعادل', month)}${cell('احتياج التمويل', funding)}${cell('ربح السنة الأولى', key(money(shock.firstYearOperatingProfit.value.minor, fmt)))}</tr>`;
  });
  return [
    `<h3>اختبار العملة الأجنبية (FX test)</h3>`,
    `<p>${h(`${formatPercent(fx.share.value)} من التكاليف مرتبطة بالاستيراد. كل صدمة تغيّر هذه الحصة وحدها من تكلفة البضاعة، فيتغيّر معامل التكلفة بمقدار الحصة × الصدمة.`)}</p>`,
    table(
      'أثر تغيّر سعر العملة على تكلفة البضاعة',
      ['الصدمة', 'معامل التكلفة المتغيرة', 'شهر التعادل', 'احتياج التمويل', 'ربح السنة الأولى'],
      rows,
    ),
  ].join('\n');
}

function variantTable(entry: ReviewEntry): string {
  const { project, variants } = entry;
  if (variants.length === 0) return '';
  const fmt = fmtOf(project, entry.run.projection.calendar.horizonMonths);
  const rows = variants.map((variant) => {
    const expectedNeed = variant.row.fundingNeed === variant.fundingNeed;
    const expectedMonth = variant.row.fundingMonth === variant.fundingMonth;
    const expectedPayback = variant.row.payback === variant.payback;
    const payback =
      variant.payback === null ? withinHorizon(fmt, 'لا يُسترد') : monthsPhrase(variant.payback);
    return `<tr><th scope="row" data-label="طريقة الدفع">${h(OPTION_WORD[variant.row.option])}</th>${cell('احتياج التمويل', key(money(variant.fundingNeed, fmt)))}${cell('شهر أدنى رصيد', h(`الشهر ${String(variant.fundingMonth)}`))}${cell('الاسترداد', h(payback))}${cell('الحساب اليدوي', h(variant.row.hand))}${cell('المطابقة', mark(expectedNeed && expectedMonth && expectedPayback))}</tr>`;
  });
  return [
    '<h3>طرق الدفع الأربع على المتجر نفسه</h3>',
    `<p>${h('المشروع نفسه يُشغَّل بكل خيار من خيارات السؤال F7، فيظهر كيف يغيّر توقيت التحصيل احتياج التمويل والاسترداد. الخيار المعتمد في الملف الذهبي هو التقسيط.')}</p>`,
    table(
      'أثر طريقة دفع العميل (F7)',
      ['طريقة الدفع', 'احتياج التمويل', 'شهر أدنى رصيد', 'الاسترداد', 'الحساب اليدوي', 'المطابقة'],
      rows,
    ),
  ].join('\n');
}

function alertList(entry: ReviewEntry): string {
  const { project, run } = entry;
  if (run.alerts.length === 0) return '<p>لا تنبيهات.</p>';
  const items = run.alerts.map(
    (alert) =>
      `<li><strong class="sev sev-${alert.severity}">${SEVERITY_WORD[alert.severity]}</strong> ${h(alertSentence(alert, fmtOf(project)))} <span class="prov">${h(provenanceText(alert))}.</span></li>`,
  );
  return `<ul class="plain">${items.join('\n')}</ul>`;
}

function noteList(entry: ReviewEntry): string {
  const { run } = entry;
  const flow = run.cash.cashFlow;
  const codes = [
    ...run.projection.notes.map((note) => note.code),
    ...(flow.status === 'ok' ? flow.notes.map((note) => note.code) : []),
  ];
  const horizon = String(run.projection.calendar.horizonMonths);
  if (codes.length === 0) return '<p>لا ملاحظات.</p>';
  return `<ul class="plain">${codes.map((code) => `<li>${h(NOTE_WORD[code].replace('{horizon}', horizon))}</li>`).join('\n')}</ul>`;
}

function inputList(entry: ReviewEntry, answeredOnly = false): string {
  const rows = describeAnswers(entry.project, answeredOnly).map(
    (line) => `<dt>${h(line.label)}</dt><dd>${h(line.text)}</dd>`,
  );
  return `<dl class="inputs">${rows.join('\n')}</dl>`;
}

// ---------------------------------------------------------------------------------------------
// The score, the verdict, overall confidence and the validation plan (D-227, D-229, D-230)

const CRITERION_WORD: Readonly<Record<CriterionId, string>> = {
  margin_positive: 'هامش المساهمة للوحدة أكبر من صفر',
  break_even_within_window: 'التعادل ضمن نافذة الجدوى (36 شهرًا افتراضيًا)',
  break_even_within_target: 'التعادل ضمن أطول مدة يقبلها المؤسس (H5)',
  break_even_within_runway: 'التعادل ضمن المدة التي يتحمّلها بلا دخل (A7)',
  funding_within_capital: 'احتياج التمويل ضمن أقصى رأس مال متاح (A5)',
  setup_within_capital: 'تكاليف التأسيس ضمن أقصى رأس مال متاح (A5)',
  price_above_floor: 'السعر ليس دون سعر الحدّ الأدنى (T7)',
  ltv_cac_at_minimum: 'نسبة LTV إلى CAC لا تقل عن الحدّ الأدنى (للاشتراك فقط)',
  conservative_break_even: 'التعادل في السيناريو المتحفّظ',
  payback_within_window: 'الاسترداد ضمن نافذة الجدوى',
  break_even_units_within_capacity: 'وحدات التعادل ضمن الطاقة القصوى (E7)',
};

const STATUS_WORD: Readonly<Record<CriterionStatus, string>> = {
  pass: 'يتحقق',
  fail: 'لا يتحقق',
  not_evaluated: 'خارج العدّ',
};

const BLOCKER_WORD: Readonly<Record<BlockerCode, string>> = {
  margin_not_positive: 'هامش المساهمة صفر أو أقل',
  no_break_even_in_window: 'لا تعادل ضمن نافذة الجدوى في الحالة الأساسية',
  funding_need_above_capital_multiple: 'احتياج التمويل فوق ضعف أقصى رأس مال ولا مصدر خارجي في H3',
};

const VERDICT_WORD: Readonly<Record<Verdict, string>> = {
  go: 'امضِ',
  revise: 'عدّل',
  stop: 'توقّف',
};

/** The fixed sentence that goes with «توقّف» (CLAUDE.md section 3). */
const STOP_SENTENCE = 'غير قابل للتنفيذ بصيغته الحالية';

const HOLD_BACK_WORD: Readonly<Record<HoldBack, string>> = {
  score_below_line: 'الدرجة دون الخط',
  no_score: 'لا معيار مقيَّم',
  confidence_low: 'الثقة الإجمالية منخفضة',
};

const PIVOTAL_WORD: Readonly<Record<PivotalId, string>> = {
  F1: 'سعر البيع (F1)',
  F3: 'التكلفة المتغيرة (F3)',
  F4: 'التكاليف الثابتة (F4)',
  F5: 'تكاليف التأسيس (F5)',
  F6: 'المبيعات المتوقعة (F6)',
};

const PLAN_WORD: Readonly<Record<TornadoVariable | 'worry', string>> = {
  ...TORNADO_WORD,
  worry: 'قلق المؤسس (H6)',
};

const COST_WORD: Readonly<Record<CostClass, string>> = {
  time: 'وقت المؤسس',
  small_cash: 'مبلغ نقدي صغير',
  supplier_quote: 'عرض سعر من مورّد',
};

const CHANGE_WORD: Readonly<Record<ChangeLever, string>> = {
  price: 'سعر البيع (F1)',
  variable_cost: 'التكلفة المتغيرة (F3)',
  fixed_costs: 'التكاليف الثابتة الكاملة (F4 مع رواتب من بدأ وF4.1)',
  sales: 'المبيعات المتوقعة (F6)',
  setup_costs: 'تكاليف التأسيس (F5)',
};

const codeTag = (text: string): string => `<code>${esc(text)}</code>`;

function decisionRow(label: string, hand: string, engine: string, agrees: boolean): string {
  return `<tr><th scope="row" data-label="البند">${h(label)}</th>${cell('الحساب اليدوي', h(hand))}${cell('ناتج المحرّك', engine)}${cell('المطابقة', mark(agrees))}</tr>`;
}

function criteriaTable(entry: ReviewEntry): string {
  const { project, run } = entry;
  const agreement = decisionAgreement(run, project.decision);
  const rows = project.decision.criteria.map((row, index) => {
    const found = at(run.feasibility.criteria, index);
    return `<tr><th scope="row" data-label="المعيار">${h(CRITERION_WORD[found.id])}</th>${cell('الحالة', `<strong>${h(STATUS_WORD[found.status])}</strong>`)}${cell('الحساب اليدوي', h(row.hand))}${cell('المطابقة', mark(at(agreement.criteria, index)))}</tr>`;
  });
  return table(
    'معايير الجدوى، بأوزان متساوية: المعيار الذي تنقص مدخلاته يخرج من العدّ',
    ['المعيار', 'الحالة', 'الحساب اليدوي', 'المطابقة'],
    rows,
  );
}

function summaryTable(entry: ReviewEntry): string {
  const { project, run } = entry;
  const hand = project.decision;
  const agreement = decisionAgreement(run, hand);
  const { score, evaluated, passed } = run.feasibility;
  const scoreText =
    score === null
      ? 'لا درجة: لا معيار مقيَّم'
      : `${String(passed)} من ${String(evaluated)} = ${formatPercent(score.value)}`;
  const blockers = run.verdict.blockers.map((blocker) => BLOCKER_WORD[blocker.code]);
  const word = run.verdict.verdict.value;
  const held = run.verdict.holdBacks.map((reason) => HOLD_BACK_WORD[reason]);
  const verdict = [
    key(VERDICT_WORD[word]),
    word === 'stop' ? h(STOP_SENTENCE) : '',
    word !== 'stop' && held.length > 0
      ? `<span class="prov">${h(`ما يمنع «امضِ»: ${held.join('، ')}`)}</span>`
      : '',
  ]
    .filter((part) => part !== '')
    .join(' ');
  const level = run.confidence.level.value;
  const rows = [
    decisionRow('الدرجة', hand.scoreHand, key(scoreText), agreement.score),
    decisionRow(
      'الحواجب',
      hand.blockersHand,
      blockers.length === 0 ? h('لا حاجب') : h(blockers.join('، ')),
      agreement.blockers,
    ),
    decisionRow('القرار', hand.verdictHand, verdict, agreement.verdict),
    decisionRow(
      'الثقة الإجمالية',
      hand.confidenceHand,
      `${key(CONFIDENCE_WORD[level])} ${h(`${String(run.confidence.sound)} من 5`)}`,
      agreement.confidence,
    ),
    decisionRow(
      'خطة التحقّق',
      hand.planHand,
      h(run.validationPlan.entries.map((planned) => PLAN_WORD[planned.variable]).join(' ثم ')),
      agreement.plan,
    ),
  ];
  return table(
    'الدرجة والحواجب والقرار والثقة والخطة، كل منها بجانب حسابه اليدوي',
    ['البند', 'الحساب اليدوي', 'ناتج المحرّك', 'المطابقة'],
    rows,
  );
}

function confidenceTable(entry: ReviewEntry): string {
  const rows = entry.run.confidence.pivotal.map((pivotal) => {
    const level = pivotal.level.value;
    return `<tr><th scope="row" data-label="الرقم المحوري">${h(PIVOTAL_WORD[pivotal.id])}</th>${cell('الثقة', h(level === 'missing' ? 'غير موجود' : CONFIDENCE_WORD[level]))}${cell('يُحسب سليمًا', h(pivotal.sound ? 'نعم' : 'لا'))}${cell('مصدره', h(provenanceText(pivotal.level)))}</tr>`;
  });
  return table(
    'الأرقام المحورية الخمسة: السليم منها ما ثقته متوسطة أو عالية',
    ['الرقم المحوري', 'الثقة', 'يُحسب سليمًا', 'مصدره'],
    rows,
  );
}

const figureText = (figure: Figure<number> | null): string =>
  figure === null ? '—' : String(figure.value);

function planTable(entry: ReviewEntry): string {
  const rows = entry.run.validationPlan.entries.map((planned, index) => {
    const worry = planned.worry === null ? '' : `<br>${h(`«${planned.worry.value}»`)}`;
    return `<tr><th scope="row" data-label="المكان">${h(String(index + 1))}</th>${cell('المتغيّر', `${h(PLAN_WORD[planned.variable])}${worry}`)}${cell('الدرجة', h(figureText(planned.score)))}${cell('الثقة والترتيب', h(`${figureText(planned.confidence)} و${figureText(planned.rank)}`))}${cell('التجربة (رموز)', [planned.metric, planned.threshold, planned.fallback].map(codeTag).join('<br>'))}${cell('الكلفة', h(COST_WORD[planned.costClass]))}</tr>`;
  });
  return table(
    'خطة التحقّق (T18): ثلاث تجارب، وكلفتها نوع لا مبلغ',
    ['المكان', 'المتغيّر', 'الدرجة', 'الثقة والترتيب', 'التجربة (رموز)', 'الكلفة'],
    rows,
  );
}

const absRate = (rate: Rate): Rate => (rate.num < 0n ? negateRate(rate) : rate);

/** One lever of a change: the founder's value, the suggested one (a key number) and the relative change. */
function shiftLines(shift: LeverShift, fmt: Fmt): { value: string; change: string } {
  const direction = shift.relativeChange.value.num < 0n ? 'تخفيض' : 'زيادة';
  const change = `${direction} ${formatPercent(absRate(shift.relativeChange.value))}`;
  const name = CHANGE_WORD[shift.lever];
  if (shift.unit === 'money') {
    return {
      value: `${h(`${name}: من ${money(shift.from.value.minor, fmt)} إلى `)}${key(money(shift.to.value.minor, fmt))}`,
      change: h(`${name}: ${change}`),
    };
  }
  const factor = shift.to.value;
  return {
    value: `${h(`${name}: تُضرب في `)}${key(formatRatio(factor))}${h(` (${formatPercent(factor)} من قيمتها)`)}`,
    change: h(`${name}: ${change}`),
  };
}

function changeRow(
  entry: ReviewEntry,
  change: Change,
  hand: string | undefined,
  agrees: boolean,
): string {
  const fmt = fmtOf(entry.project, entry.run.projection.calendar.horizonMonths);
  const lines = change.shifts.map((shift) => shiftLines(shift, fmt));
  const { score, passed, evaluated } = change.outcome;
  const scoreText =
    score === null
      ? 'لا درجة: لا معيار مقيَّم'
      : `الدرجة ${String(passed)} من ${String(evaluated)} = ${formatPercent(score.value)}`;
  const ceiling = entry.changes.marketCeiling;
  const premium =
    !change.premium || ceiling === null
      ? ''
      : `<br><span class="prov">${h(`سعر مميَّز (Premium): أعلى من أعلى سعر منافس معروف (${money(ceiling.value.minor, fmt)}). السعر الأعلى من السوق يحتاج فرقًا في العرض يمكن قياسه (القاعدة R5)، ولا يعطي المحرّك رقمًا يدّعي أن السوق سيدفعه.`)}</span>`;
  const reach = change.reachesThreshold ? 'يبلغ خط «امضِ»' : 'يزيل الحاجب ولا يبلغ خط «امضِ»';
  const effort =
    change.shifts.length > 1
      ? `<br>${h(`الجهد (مجموع النسبتين): ${formatPercent(change.effort.value)}`)}`
      : '';
  return `<tr>${cell('التغيير', lines.map((line) => line.value).join('<br>'))}${cell('نسبة التغيير', `${lines.map((line) => line.change).join('<br>')}${effort}`)}${cell('بعد التغيير', `${h(scoreText)}<br>${key(VERDICT_WORD[change.outcome.verdict.value])} ${h(reach)}${premium}`)}${cell('الحساب اليدوي', hand === undefined ? h('—') : h(hand))}${cell('المطابقة', mark(agrees))}</tr>`;
}

/**
 * The changes that would change the verdict (D-228, D-262), for a project that is not `go`: one
 * table with each change, what the engine says about the project once it is made, its hand
 * computation and a mark; then the levers to rethink, when fewer than three changes work, and how
 * many times the search ran the engine.
 */
function changesBlocks(entry: ReviewEntry): readonly string[] {
  const { changes, project } = entry;
  if (changes.status === 'none_needed') return [];
  const hand = project.decision;
  const agreement = changesAgreement(changes, hand);
  const fmt = fmtOf(project, entry.run.projection.calendar.horizonMonths);
  const blocks = [
    '<h4>التغييرات التي قد تغيّر القرار</h4>',
    `<p>${h('كل تغيير يعدّل رقمًا من أرقام المؤسس نفسها ويُحكم عليه بالمحرّك نفسه الذي حكم على الأصلية. الرقم المقترح افتراض يحتاج المؤسس إلى التحقق من إمكانه، وليس وعدًا بنتيجة.')}</p>`,
  ];
  if (changes.goBlockedBy !== null) {
    blocks.push(
      `<p>${h('لا يوجد تغيير في هذه الأرقام يرفع القرار إلى «امضِ»: الثقة الإجمالية منخفضة، وهي تأتي من جودة الإجابات لا من قيمها، فيبدأ التحسين بتأكيد الأرقام المحورية.')}</p>`,
    );
  }
  if (changes.changes.length > 0) {
    blocks.push(
      table(
        'التغييرات الأصغر جهدًا أولًا (جهد التغيير مجموع نسب تغيير أرقامه)',
        ['التغيير', 'نسبة التغيير', 'بعد التغيير', 'الحساب اليدوي', 'المطابقة'],
        changes.changes.map((change, index) =>
          changeRow(entry, change, hand.changes[index]?.hand, agreement.changes[index] === true),
        ),
      ),
    );
  }
  if (changes.rethink.length > 0) {
    const items = changes.rethink.map(
      (item) =>
        `${CHANGE_WORD[item.lever]}: الترتيب ${String(item.rank)} في الحساسية، وتأرجح ربح السنة الأولى ${money(item.swing.value.minor, fmt)}`,
    );
    blocks.push(
      `<p>${h(`لم يكفِ أي تغيير في الأرقام لملء الأماكن الثلاثة، فيُطلب من المؤسس أن يعيد التفكير في: ${items.join('؛ ')}. لا قيمة مقترحة لها.`)}</p>`,
    );
  }
  blocks.push(
    `<p>${h(hand.rethinkHand)} ${mark(agreement.list)}</p>`,
    `<p class="prov">${h(`شغّل البحث المحرّك ${String(changes.evaluations)} مرة، ${changes.complete ? 'واكتمل داخل ميزانيته' : 'وانتهت ميزانيته قبل أن يكتمل، فهذه ما وُجد وقد لا تكون الأصغر'}.`)}</p>`,
  );
  return blocks;
}

/** The blocks of the decision, under a heading the caller chose: criteria, summary, confidence, plan. */
function decisionBlocks(entry: ReviewEntry): readonly string[] {
  const stopped = entry.run.verdict.verdict.value === 'stop';
  return [
    '<h4>معايير الجدوى</h4>',
    criteriaTable(entry),
    '<h4>الدرجة والقرار</h4>',
    summaryTable(entry),
    `<p>${h('الدرجة ليست احتمال نجاح: هي نسبة المعايير المقيَّمة التي تحققت، بأوزان متساوية.')}</p>`,
    stopped ? `<p>${h(`القرار توقّف: ${STOP_SENTENCE}.`)}</p>` : '',
    ...changesBlocks(entry),
    '<h4>الثقة الإجمالية</h4>',
    confidenceTable(entry),
    '<h4>خطة التحقّق</h4>',
    planTable(entry),
  ].filter((part) => part !== '');
}

function projectSection(entry: ReviewEntry, index: number): string {
  const { project } = entry;
  const id = project.name;
  return [
    `<section id="${id}" aria-labelledby="${id}-title">`,
    `<h2 id="${id}-title">${h(`${String(index + 1)}. ${project.title}`)}</h2>`,
    `<p class="sentence">${h(project.sentence)}</p>`,
    '<h3>المدخلات بالكلمات</h3>',
    inputList(entry),
    '<h3>الأرقام الرئيسية</h3>',
    headlineTable(entry),
    '<h3>السيناريوهات وحساسية الربح</h3>',
    scenarioTable(entry),
    tornadoTable(entry),
    fxTable(entry),
    variantTable(entry),
    '<h3>التنبيهات التي ظهرت</h3>',
    alertList(entry),
    '<h3>الجدوى والقرار</h3>',
    ...decisionBlocks(entry),
    '<h3>ما قرأه المحرّك على غير ظاهره</h3>',
    noteList(entry),
    '</section>',
  ]
    .filter((part) => part !== '')
    .join('\n');
}

function caseArticle(entry: ReviewEntry): string {
  const { project } = entry;
  const id = project.name;
  return [
    `<article id="${id}" aria-labelledby="${id}-title">`,
    `<h3 id="${id}-title">${h(project.title)}</h3>`,
    `<p class="sentence">${h(project.sentence)}</p>`,
    '<h4>المدخلات بالكلمات</h4>',
    inputList(entry, true),
    ...decisionBlocks(entry),
    '</article>',
  ].join('\n');
}

function casesSection(cases: readonly ReviewEntry[]): string {
  if (cases.length === 0) return '';
  return [
    '<section id="verdict-cases" aria-labelledby="verdict-cases-title">',
    '<h2 id="verdict-cases-title">حالات اصطناعية للقرار</h2>',
    `<p>${h('أربع حالات بُنيت في اختبارات المحرّك على مشروع بسيط مسطّح (400 وحدة شهريًا بسعر 10 د.أ)، وليست ملفات ذهبية ولا مشاريع حقيقية: مشروع جيد، ومشروع على الحدّ دون خط 75% بمعيار واحد، ومشروع هامشه سالب، ومشروع احتياج تمويله فوق ضعف رأس ماله بلا مصدر خارجي. لكل حالة معاييرها وحسابها اليدوي كما في المشاريع الثلاثة.')}</p>`,
    ...cases.map(caseArticle),
    '</section>',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// The engine's assumptions

const PARAM_ROWS: readonly {
  readonly key: string;
  readonly label: string;
  readonly show: (value: never) => string;
}[] = [
  {
    key: PARAM_KEYS.horizonMonths,
    label: 'أفق الإسقاط',
    show: (v: number) => `${String(v)} شهرًا`,
  },
  { key: PARAM_KEYS.growthUpperBound, label: 'سقف تقدير النمو السنوي', show: formatPercent },
  {
    key: PARAM_KEYS.growthFounderShare,
    label: 'حصة نمو المؤسس التي يحتفظ بها التقدير',
    show: formatPercent,
  },
  {
    key: PARAM_KEYS.growthYear3Share,
    label: 'حصة السنة الثالثة من نمو السنة الثانية',
    show: formatPercent,
  },
  {
    key: PARAM_KEYS.seasonalPeakFactor,
    label: 'معامل شهر الذروة',
    show: (v: Rate) => `× ${formatRatio(v)}`,
  },
  {
    key: PARAM_KEYS.inflationRate,
    label: 'التضخم السنوي للتكاليف',
    show: (v: Rate | null) => (v === null ? 'غير مطبّق: لا نسبة موثّقة' : formatPercent(v)),
  },
  {
    key: PARAM_KEYS.conservativeSalesFactor,
    label: 'السيناريو المتحفّظ: مضاعف المبيعات',
    show: (v: Rate) => `× ${formatRatio(v)}`,
  },
  {
    key: PARAM_KEYS.optimisticSalesFactor,
    label: 'السيناريو المتفائل: مضاعف المبيعات',
    show: (v: Rate) => `× ${formatRatio(v)}`,
  },
  {
    key: PARAM_KEYS.conservativeVcFactor,
    label: 'السيناريو المتحفّظ: مضاعف التكلفة المتغيرة',
    show: (v: Rate) => `× ${formatRatio(v)}`,
  },
  {
    key: PARAM_KEYS.optimisticVcFactor,
    label: 'السيناريو المتفائل: مضاعف التكلفة المتغيرة',
    show: (v: Rate) => `× ${formatRatio(v)}`,
  },
  {
    key: PARAM_KEYS.conservativeLaunchDelayMonths,
    label: 'السيناريو المتحفّظ: تأخير الإطلاق',
    show: (v: number) => monthsPhrase(v),
  },
  {
    key: PARAM_KEYS.penetrationFloorFactor,
    label: 'معامل سعر الاختراق فوق الحدّ الأدنى',
    show: (v: Rate) => `× ${formatRatio(v)}`,
  },
  {
    key: PARAM_KEYS.ltvCacMinimum,
    label: 'أدنى نسبة مقبولة بين LTV وCAC',
    show: (v: Rate) => formatRatio(v),
  },
  {
    key: PARAM_KEYS.fxShocks,
    label: 'صدمات تكلفة المستورد في اختبار العملة',
    show: (v: readonly Rate[]) => v.map(formatPercent).join('، '),
  },
  {
    key: PARAM_KEYS.tornadoSwing,
    label: 'مدى حركة كل متغيّر في مخطط الحساسية',
    show: formatPercent,
  },
  {
    key: PARAM_KEYS.feasibilityWindowMonths,
    label: 'نافذة الجدوى للتعادل والاسترداد',
    show: (v: number) => monthsPhrase(v),
  },
  {
    key: PARAM_KEYS.goScoreLine,
    label: 'خط الدرجة للقرار «امضِ»',
    show: formatPercent,
  },
  {
    key: PARAM_KEYS.fundingBlockerMultiple,
    label: 'حاجب التمويل: احتياج التمويل أكثر من هذا المضاعف لأقصى رأس مال',
    show: (v: Rate) => `× ${formatRatio(v)}`,
  },
  {
    key: PARAM_KEYS.confidenceHighLine,
    label: 'خط الثقة الإجمالية العالية',
    show: formatPercent,
  },
  {
    key: PARAM_KEYS.confidenceMediumLine,
    label: 'خط الثقة الإجمالية المتوسطة',
    show: formatPercent,
  },
];

function paramSection(run: EngineRun): string {
  const byKey = new Map<string, Figure<unknown>>(
    run.parameters.flatMap((figure) => {
      const first = figure.inputs[0];
      return first === undefined ? [] : [[first.id, figure] as const];
    }),
  );
  const rows = PARAM_ROWS.flatMap((row) => {
    const figure = byKey.get(row.key);
    if (figure === undefined) return [];
    const value = (row.show as (value: unknown) => string)(figure.value);
    return [
      `<tr><th scope="row" data-label="الافتراض">${h(row.label)}</th>${cell('القيمة', h(value))}${cell('الحالة', h(provenanceText(figure)))}</tr>`,
    ];
  });
  return [
    '<section id="assumptions" aria-labelledby="assumptions-title">',
    '<h2 id="assumptions-title">افتراضات المحرّك</h2>',
    `<p>${h('هذه قيم افتراضية يعتمدها المحرّك حين لا تقول الأسئلة غير ذلك. كلها افتراضات غير مؤكَّدة، وليست حقائق عن سوق أو قانون، ويمكن تغيير أي منها. جداول تحصيل طرق الدفع الأربع: نقدًا في الشهر نفسه، وبالآجل بعد شهر، وبالتقسيط ثلاث دفعات متساوية في الشهر نفسه وبعده بشهر وبشهرين، والدفعة المقدّمة نصفان في الشهر نفسه وبعد شهر.')}</p>`,
    table('الافتراضات التي استُخدمت في الأرقام أعلاه', ['الافتراض', 'القيمة', 'الحالة'], rows),
    '</section>',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// The page

const STYLE = `
:root{color-scheme:light dark;--bg:#ffffff;--fg:#0a0a0a;--muted:#4d4d4d;--line:#b5b5b5;--soft:#f1f1f1;--gold:#d4a537;--chip:#000000;--teal:#1fa3c7;--link:#0a0a0a;--ring:#000000}
@media (prefers-color-scheme:dark){:root{--bg:#000000;--fg:#f2f2f2;--muted:#b8b8b8;--line:#3d3d3d;--soft:#141414;--link:#1fa3c7;--ring:#000000}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:1rem/1.85 Tajawal,Cairo,"Segoe UI",Tahoma,"Noto Sans Arabic","Noto Naskh Arabic",system-ui,sans-serif}
.page{max-inline-size:62rem;margin-inline:auto;padding-inline:1rem;padding-block:1rem 3rem}
h1{font-size:1.9rem;line-height:1.45;margin-block:1.5rem .5rem}
h2{font-size:1.5rem;line-height:1.5;margin-block:3rem 1rem;padding-block-start:.75rem;border-block-start:3px solid var(--fg)}
h3{font-size:1.15rem;line-height:1.6;margin-block:2rem .5rem}
h4{font-size:1rem;line-height:1.6;margin-block:1.5rem .25rem}
article{margin-block:2rem;padding-block-start:1rem;border-block-start:1px solid var(--line)}
p,li,dd{max-inline-size:70ch;overflow-wrap:anywhere}
.lead{font-size:1.1rem}
.sentence{font-size:1.1rem}
.banner{border-inline-start:.4rem solid var(--fg);background:var(--soft);padding:.75rem 1rem;margin-block:1.25rem}
a{color:var(--link);text-decoration:underline;text-decoration-color:var(--teal);text-decoration-thickness:.15em;text-underline-offset:.25em}
:focus-visible{outline:3px solid var(--teal);outline-offset:2px;box-shadow:0 0 0 2px var(--ring)}
.skip{position:absolute;inset-inline-start:1rem;inset-block-start:-4rem;background:var(--bg);color:var(--fg);padding:.5rem 1rem;border:2px solid var(--fg)}
.skip:focus{inset-block-start:.5rem}
nav ul,.plain{list-style:none;margin:0;padding:0}
nav li{display:inline-block;margin-inline-end:1.25rem}
.plain li{padding-block:.35rem;border-block-end:1px solid var(--line)}
table{inline-size:100%;border-collapse:collapse;margin-block:1rem 1.5rem;font-size:.95rem}
caption{text-align:start;font-weight:700;padding-block-end:.5rem}
th{text-align:start;font-weight:700}
thead th{border-block-end:2px solid var(--fg);padding:.5rem}
td,tbody th{border-block-end:1px solid var(--line);padding:.6rem .5rem;vertical-align:top;font-variant-numeric:tabular-nums}
.key{background:var(--chip);color:var(--gold);border:1px solid var(--gold);padding:.05em .5em;font-weight:700;white-space:nowrap}
.mark{font-weight:700;white-space:nowrap}
.mark.bad{text-decoration:underline wavy}
.sev{margin-inline-end:.35rem}
.prov{color:var(--muted);font-size:.9rem}
.inputs{display:grid;grid-template-columns:minmax(0,16rem) minmax(0,1fr);gap:.35rem 1.25rem;margin:0}
.inputs dt{font-weight:700}
.inputs dd{margin:0}
code{font-family:ui-monospace,Consolas,monospace;direction:ltr;unicode-bidi:isolate}
footer{margin-block-start:3rem;padding-block-start:1rem;border-block-start:1px solid var(--line);color:var(--muted)}
@media (max-width:42em){
.inputs{grid-template-columns:minmax(0,1fr)}
.inputs dd{margin-block-end:.6rem}
table.stack thead{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%)}
table.stack tr{display:block;padding-block:.6rem;border-block-end:1px solid var(--line)}
table.stack td,table.stack tbody th{display:block;border:0;padding:.15rem 0}
table.stack td::before{content:attr(data-label);display:block;color:var(--muted);font-size:.85rem}
h1{font-size:1.6rem}
}
`;

/**
 * Renders the owner review page from the golden runs (D-223): the banner, how to read the page,
 * and for each project the inputs in words, the headline numbers beside their hand computations
 * with a mark of agreement, the three scenarios, the tornado, the FX test and the payment options
 * where the project has them, the alerts that fired, the feasibility score with its verdict, the
 * overall confidence and the validation plan (each beside its hand computation), and what the engine
 * assumed; then, when `cases` is given, the synthetic cases of the verdict. Pure: the same entries
 * give the same text, ending with one newline.
 */
export function renderReviewPage(
  entries: readonly ReviewEntry[],
  cases: readonly ReviewEntry[] = [],
): string {
  const first = entries[0];
  const nav = [
    ...entries.map(
      (entry) => `<li><a href="#${entry.project.name}">${h(entry.project.title)}</a></li>`,
    ),
    ...(cases.length === 0
      ? []
      : [`<li><a href="#verdict-cases">${h('حالات اصطناعية للقرار')}</a></li>`]),
  ].join('\n');
  const body = [
    '<a class="skip" href="#main">انتقل إلى المحتوى</a>',
    '<div class="page">',
    '<header>',
    `<h1>${h('مراجعة المحرّك الحسابي: ثلاثة مشاريع نموذجية')}</h1>`,
    `<p class="lead">${h(`هذه وثيقة للمالك وليست جزءًا من التطبيق. تعرض ما يحسبه المحرّك الحسابي (Engine) في نسخته ${ENGINE_VERSION} لثلاثة مشاريع نموذجية، ولكل رقم رئيسي حسابه اليدوي بجانبه وعلامة تقول هل يطابقه المحرّك. كل رقم هنا من حساب حتمي: المحرّك لا يكتب رقمًا ولا يستعين بنموذج لغوي.`)}</p>`,
    '</header>',
    '<main id="main">',
    `<p class="banner" role="note">${h('هذه مشاريع نموذجية وليست حقيقية. قواعد الضرائب فيها تجريبية غير موثّقة، ومصدرها عنوان وهمي، ولا تعني أي نسبة حقيقية. ولا نصيحة مالية أو ضريبية في هذه الصفحة. ولن يرى المؤسسون أي رقم من المحرّك قبل المرحلة M5.')}</p>`,
    `<nav aria-label="${h('المشاريع')}"><ul>${nav}</ul></nav>`,
    '<section id="how" aria-labelledby="how-title">',
    '<h2 id="how-title">كيف تقرأ كل مشروع</h2>',
    `<p>${h('يبدأ كل مشروع بجملة تصفه، ثم المدخلات بالكلمات كما أجاب المؤسس، ثم جدول الأرقام الرئيسية: الرقم، وحسابه اليدوي، وما أخرجه المحرّك، وهل يتطابقان. بعد ذلك السيناريوهات الثلاثة (Scenarios) ومخطط الحساسية (Tornado) الذي يرتّب المتغيّرات بحسب أثرها على ربح السنة الأولى، ثم اختبار العملة الأجنبية (FX test) إن وُجد، ثم التنبيهات التي ظهرت. بعدها قسم «الجدوى والقرار»: معايير الجدوى الأحد عشر بأوزان متساوية (كل معيار منها نتيجة محسوبة أصلًا في التحليل، فلا يخالف القرار تنبيهًا)، ثم الدرجة والحواجب والقرار (امضِ أو عدّل أو توقّف) والثقة الإجمالية وخطة التحقّق، وكلها بجانب حسابها اليدوي. ثم ما افترضه المحرّك لأن إجابة ناقصة. الأرقام المقصودة بالنظر مكتوبة بخط عريض ذهبي على أسود.')}</p>`,
    `<p>${h('لكل مشروع قراره «توقّف» أو «عدّل» جدول بالتغييرات التي قد تغيّر القرار. يبحث المحرّك في خمسة أرقام للمؤسس: السعر (حتى ضعفه)، والتكلفة المتغيرة والتكاليف الثابتة وتكاليف التأسيس (حتى نصفها)، والمبيعات (حتى ضعفها). هدفه في «توقّف» أن يزيل الحاجب أولًا، ثم أن يبلغ خط «امضِ» إن أمكن داخل الحدود فيذكر الأخير، وفي «عدّل» أن يبلغ الخط. يجرّب رقمًا واحدًا ثم رقمين يتحركان بالنسبة نفسها حين لا يكفي الواحد، ويرتّب بحسب الجهد وهو مجموع نسب التغيير، ويعرض الثلاثة الأصغر. سعر فوق أعلى سعر منافس معروف يُعلَّم «مميَّز»: يحتاج فرقًا في العرض يمكن قياسه، والمحرّك لا يقدّم رقمًا يدّعي أن السوق سيدفعه. المبيعات تُجرَّب خطوة خطوة بنسبة 5% لأن زيادتها مع الدفع المتأخر قد تحتاج تمويلًا أكبر فلا تُحسَّن النتيجة دائمًا. وإن نفدت ميزانية البحث قال ذلك.')}</p>`,
    '</section>',
    ...entries.map(projectSection),
    casesSection(cases),
    first === undefined ? '' : paramSection(first.run),
    '</main>',
    '<footer>',
    `<p>${h('وُلّدت هذه الصفحة من الاختبارات ومن ملفات packages/engine/golden، ولا تُعدَّل يدويًا. لإعادة توليدها بعد تغيير مقصود في صيغة:')} <code>UPDATE_GOLDEN=1 pnpm --filter @sbn/engine test</code></p>`,
    '</footer>',
    '</div>',
  ]
    .filter((part) => part !== '')
    .join('\n');
  return [
    '<!doctype html>',
    '<html lang="ar" dir="rtl">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light dark">',
    '<meta name="robots" content="noindex">',
    '<title>مراجعة المحرّك الحسابي</title>',
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
