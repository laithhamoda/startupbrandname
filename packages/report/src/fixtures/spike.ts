import { buildPrintDocument, isolatedLatin, isolatedNumber } from '../print/document';
import { escapeHtml } from '../print/escape';
import type { PrintLocale } from '../print/locale';

/**
 * The PDF spike document (M5 step 0, D-235): the same content in Arabic (right-to-left) and in
 * English (left-to-right), written as literal data, with no engine call and no database. It holds
 * what the real report will hold: a cover, a verdict slab with three key numbers, Modern Standard
 * Arabic with English terms in parentheses, amounts with the currency after them, a table whose
 * numeric columns line up, a landscape page with 12 months and 8 quarters, a list, lines that
 * must wrap, mixed left-to-right fragments, and a founder's text that is hostile markup.
 *
 * Every amount here is invented for the test; none of it is market data (CLAUDE.md rule 9).
 */

/** Inline text: a string is escaped; `n` is a number or amount; `l` is a left-to-right fragment. */
type Part = string | { n: string } | { l: string };
type Inline = readonly Part[];

function inline(parts: Inline): string {
  return parts
    .map((part) => {
      if (typeof part === 'string') return escapeHtml(part);
      return 'n' in part ? isolatedNumber(part.n) : isolatedLatin(part.l);
    })
    .join('');
}

const text = (value: string): string => escapeHtml(value);

interface Row {
  label: string;
  amount: string;
  unit: string;
  share: string;
}

interface SpikeText {
  title: string;
  headerTitle: string;
  brandLine: string;
  subtitle: string;
  issued: Inline;
  summary: string;
  verdictLabel: string;
  verdict: string;
  verdictReason: string;
  keyNumbers: readonly { value: Inline; caption: string }[];
  summaryParagraphs: readonly Inline[];
  analysis: string;
  analysisParagraphs: readonly Inline[];
  glyphHeading: string;
  glyphParagraph: string;
  points: readonly Inline[];
  longHeading: string;
  longLine: string;
  numbers: string;
  tableCaption: string;
  columns: readonly [string, string, string, string];
  rows: readonly Row[];
  otherCaption: string;
  otherRows: readonly Row[];
  wide: Inline;
  monthsCaption: string;
  monthLabel: string;
  quarterLabel: string;
  monthRows: readonly { label: string; values: readonly string[] }[];
  quartersCaption: string;
  quarterRows: readonly { label: string; values: readonly string[] }[];
  userHeading: string;
  userIntro: string;
  userTexts: readonly string[];
  userOutro: string;
  sampleNote: string;
}

/** What a hostile founder could type into a free-text answer. It must come out as plain text. */
export const HOSTILE_TEXT =
  '<img src="http://example.invalid/x" onerror="document.body.append(String.fromCharCode(80,87,78))">\n' +
  '<script>document.body.append(String.fromCharCode(80,87,78))</script>';

/** What the two hostile tags would print if they ran: it must never appear in the PDF. */
export const HOSTILE_EFFECT = 'PWN';

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;
const QUARTERS = ['Y1 Q1', 'Y1 Q2', 'Y1 Q3', 'Y1 Q4', 'Y2 Q1', 'Y2 Q2', 'Y2 Q3', 'Y2 Q4'] as const;
const MONTH_SALES = [
  '8,200',
  '9,100',
  '9,800',
  '10,400',
  '11,000',
  '11,600',
  '12,000',
  '12,500',
  '12,500',
  '12,800',
  '13,000',
  '13,200',
] as const;
const MONTH_COSTS = [
  '11,900',
  '11,800',
  '11,700',
  '11,700',
  '11,800',
  '11,900',
  '12,000',
  '12,000',
  '12,000',
  '12,100',
  '12,200',
  '12,300',
] as const;
const MONTH_NET = [
  '-3,700',
  '-2,700',
  '-1,900',
  '-1,300',
  '-800',
  '-300',
  '0',
  '500',
  '500',
  '700',
  '800',
  '900',
] as const;
const QUARTER_SALES = [
  '27,100',
  '33,000',
  '37,000',
  '39,000',
  '41,000',
  '43,500',
  '45,000',
  '47,000',
] as const;
const QUARTER_COSTS = [
  '35,400',
  '35,400',
  '36,000',
  '36,600',
  '37,000',
  '37,500',
  '38,000',
  '38,500',
] as const;
const QUARTER_NET = [
  '-8,300',
  '-2,400',
  '1,000',
  '2,400',
  '4,000',
  '6,000',
  '7,000',
  '8,500',
] as const;

const AR: SpikeText = {
  title: 'تقرير نموذج العمل: مقهى الحيّ',
  headerTitle: 'تقرير نموذج العمل · مقهى الحيّ',
  brandLine: 'Startup Brand Name',
  subtitle: 'تحليل مبنيّ على الأرقام لمشروع مقهى متخصّص في عمّان',
  issued: ['تاريخ الإصدار ', { n: '2026-10-11' }, ' · نسخة المحرّك ', { n: '1.0.0' }],
  summary: 'الملخّص التنفيذي',
  verdictLabel: 'الحكم',
  verdict: 'عدّل',
  verdictReason: 'قابل للتنفيذ بعد تعديل التسعير وخفض التكاليف الثابتة.',
  keyNumbers: [
    { value: [{ n: '250' }, ' د.أ'], caption: 'متوسط قيمة الطلب' },
    { value: [{ n: '-1,500' }, ' د.أ'], caption: 'صافي الشهر الأول' },
    { value: [{ n: '42.5%' }], caption: 'هامش الربح الإجمالي' },
  ],
  summaryParagraphs: [
    [
      'يحتاج المشروع إلى رفع المبيعات الشهرية قبل أن يغطي تكاليفه. نقطة التعادل (Break-even) ',
      'تتحقّق في الشهر ',
      { n: '7' },
      ' عند مبيعات شهرية تقارب ',
      { n: '12,000' },
      ' د.أ، ويعود رأس المال تدريجيًّا بعد ذلك.',
    ],
    [
      'تبلغ قيمة العميل على مدى حياته (LTV) أعلى من تكلفة اكتسابه (CAC) في السيناريو الأساسي، ',
      'لكنّ الهامش ضعيف أمام ارتفاع الإيجار. التغييرات الثلاثة أدناه تحسّن الحكم.',
    ],
  ],
  analysis: 'التحليل والتوصيات',
  analysisParagraphs: [
    [
      'لا يكفي أن يكون المنتج جيّدًا؛ إذ يجب أن تغطّي الإيرادات التكاليف الثابتة. ',
      'يوضّح الجدول التالي كيف تتوزّع الإيرادات والتكاليف في الشهر الأول، ',
      'ويقارن ذلك بالهدف عند الوصول إلى التعادل.',
    ],
    [
      'راجع الرابط ',
      { l: 'https://startupbrandname.com/report' },
      ' ثم قارن نسبة ',
      { l: 'LTV/CAC' },
      ' في المرحلة ',
      { l: 'M5' },
      ' قبل أيّ قرار تمويل.',
    ],
  ],
  glyphHeading: 'اختبار الحروف والربط',
  glyphParagraph:
    'لا، إلا، لأنّ، الأولويّات، المسؤولية، شيء، رئيس، إنشاء، الأَسئِلَةُ، الشَّرِكَةُ الْمُؤَسِّسَةُ، مُحَمَّدٌ.',
  points: [
    ['خفض الإيجار الشهري إلى ما دون ', { n: '2,500' }, ' د.أ أو التفاوض على مدّة سماح.'],
    ['رفع متوسط قيمة الطلب من ', { n: '250' }, ' د.أ بإضافة حزمة أو منتج مكمّل.'],
    ['قياس معدّل العودة (Retention) شهريًّا قبل زيادة الإنفاق على التسويق.'],
  ],
  longHeading: 'أسطر طويلة بلا مسافات',
  longLine:
    'ولكنّهمـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ' +
    'https://startupbrandname.com/a/very/long/path/that/has/no/spaces/and/must/wrap/inside/the/page/margin/0123456789',
  numbers: 'الأرقام والعملات',
  tableCaption: 'الإيرادات والتكاليف في الشهر الأول',
  columns: ['البند', 'المبلغ', 'العملة', 'النسبة من المبيعات'],
  rows: [
    { label: 'المبيعات', amount: '12,500.00', unit: 'د.أ', share: '100.0%' },
    { label: 'تكلفة البضاعة', amount: '-7,187.50', unit: 'د.أ', share: '57.5%' },
    { label: 'الربح الإجمالي', amount: '5,312.50', unit: 'د.أ', share: '42.5%' },
    { label: 'الإيجار', amount: '-2,500.00', unit: 'د.أ', share: '20.0%' },
    { label: 'الرواتب', amount: '-3,800.00', unit: 'د.أ', share: '30.4%' },
    { label: 'مصاريف أخرى', amount: '-512.50', unit: 'د.أ', share: '4.1%' },
    { label: 'صافي الشهر', amount: '-1,500.00', unit: 'د.أ', share: '-12.0%' },
  ],
  otherCaption: 'مبالغ بعملات مختلفة',
  otherRows: [
    { label: 'متوسط قيمة الطلب', amount: '250.00', unit: 'د.أ', share: '' },
    { label: 'صافي الشهر الأول', amount: '-1,500.00', unit: 'د.أ', share: '' },
    { label: 'تكلفة الإعداد لنموذج جزائري', amount: '83,333.33', unit: 'DZD', share: '' },
  ],
  wide: ['التوقعات على مدى ', { n: '24' }, ' شهرًا'],
  monthsCaption: 'المبيعات والتكاليف والصافي بالشهر (د.أ)',
  monthLabel: 'الشهر',
  quarterLabel: 'الربع',
  monthRows: [
    { label: 'المبيعات', values: MONTH_SALES },
    { label: 'التكاليف', values: MONTH_COSTS },
    { label: 'الصافي', values: MONTH_NET },
  ],
  quartersCaption: 'المبيعات والتكاليف والصافي بالربع (د.أ)',
  quarterRows: [
    { label: 'المبيعات', values: QUARTER_SALES },
    { label: 'التكاليف', values: QUARTER_COSTS },
    { label: 'الصافي', values: QUARTER_NET },
  ],
  userHeading: 'نصوص أدخلها المستخدم',
  userIntro:
    'تُعرض الإجابات الحرّة كما كُتبت، نصًّا فقط. لا يُنفَّذ منها وسم ولا نصّ برمجي ولا يُطلب منها رابط.',
  userTexts: ["مقهى O'Brien & Sons «الحيّ» <جديد>", HOSTILE_TEXT],
  userOutro: 'انتهى المثال.',
  sampleNote: 'بيانات توضيحية لاختبار الطباعة فقط، وليست بيانات سوق.',
};

const EN: SpikeText = {
  title: 'Business model report: Neighbourhood Café',
  headerTitle: 'Business model report · Neighbourhood Café',
  brandLine: 'Startup Brand Name',
  subtitle: 'A numbers-based analysis of a specialty café project in Amman',
  issued: ['Issued ', { n: '2026-10-11' }, ' · engine version ', { n: '1.0.0' }],
  summary: 'Executive summary',
  verdictLabel: 'Verdict',
  verdict: 'Adjust',
  verdictReason: 'Viable after the pricing is adjusted and the fixed costs are reduced.',
  keyNumbers: [
    { value: [{ n: '250' }, ' JOD'], caption: 'Average order value' },
    { value: [{ n: '-1,500' }, ' JOD'], caption: 'Net result of month one' },
    { value: [{ n: '42.5%' }], caption: 'Gross margin' },
  ],
  summaryParagraphs: [
    [
      'The project must raise monthly sales before it covers its costs. The break-even point ',
      'is reached in month ',
      { n: '7' },
      ' at monthly sales of about ',
      { n: '12,000' },
      ' JOD, and the capital is recovered gradually after that.',
    ],
    [
      'The lifetime value of a customer (LTV) is higher than the cost of acquiring one (CAC) in ',
      'the base scenario, but the margin is thin against the rent. The three changes below ',
      'improve the verdict.',
    ],
  ],
  analysis: 'Analysis and recommendations',
  analysisParagraphs: [
    [
      'A good product is not enough: revenue must cover the fixed costs. The table that follows ',
      'shows how revenue and costs split in the first month, and compares it with the target ',
      'at break-even.',
    ],
    [
      'Open ',
      { l: 'https://startupbrandname.com/report' },
      ' and compare the ',
      { l: 'LTV/CAC' },
      ' ratio in phase ',
      { l: 'M5' },
      ' before any financing decision.',
    ],
  ],
  glyphHeading: 'Arabic letters and joining test',
  glyphParagraph:
    'Arabic inside English text: لا، إلا، لأنّ، الأولويّات، المسؤولية، شيء، رئيس، إنشاء، الأَسئِلَةُ، الشَّرِكَةُ الْمُؤَسِّسَةُ، مُحَمَّدٌ.',
  points: [
    ['Cut the monthly rent to under ', { n: '2,500' }, ' JOD or negotiate a grace period.'],
    ['Raise the average order from ', { n: '250' }, ' JOD with a bundle or a companion product.'],
    ['Measure retention monthly before raising marketing spend.'],
  ],
  longHeading: 'Long lines without spaces',
  longLine:
    'Supercalifragilisticexpialidocious-and-then-some-more-letters-that-never-break-0123456789012345678901234567890123456789 ' +
    'https://startupbrandname.com/a/very/long/path/that/has/no/spaces/and/must/wrap/inside/the/page/margin/0123456789',
  numbers: 'Numbers and currencies',
  tableCaption: 'Revenue and costs in the first month',
  columns: ['Item', 'Amount', 'Currency', 'Share of sales'],
  rows: [
    { label: 'Sales', amount: '12,500.00', unit: 'JOD', share: '100.0%' },
    { label: 'Cost of goods', amount: '-7,187.50', unit: 'JOD', share: '57.5%' },
    { label: 'Gross profit', amount: '5,312.50', unit: 'JOD', share: '42.5%' },
    { label: 'Rent', amount: '-2,500.00', unit: 'JOD', share: '20.0%' },
    { label: 'Wages', amount: '-3,800.00', unit: 'JOD', share: '30.4%' },
    { label: 'Other expenses', amount: '-512.50', unit: 'JOD', share: '4.1%' },
    { label: 'Net result', amount: '-1,500.00', unit: 'JOD', share: '-12.0%' },
  ],
  otherCaption: 'Amounts in different currencies',
  otherRows: [
    { label: 'Average order value', amount: '250.00', unit: 'JOD', share: '' },
    { label: 'Net result of month one', amount: '-1,500.00', unit: 'JOD', share: '' },
    { label: 'Setup cost for an Algerian model', amount: '83,333.33', unit: 'DZD', share: '' },
  ],
  wide: ['The ', { n: '24' }, '-month forecast'],
  monthsCaption: 'Sales, costs and net by month (JOD)',
  monthLabel: 'Month',
  quarterLabel: 'Quarter',
  monthRows: [
    { label: 'Sales', values: MONTH_SALES },
    { label: 'Costs', values: MONTH_COSTS },
    { label: 'Net', values: MONTH_NET },
  ],
  quartersCaption: 'Sales, costs and net by quarter (JOD)',
  quarterRows: [
    { label: 'Sales', values: QUARTER_SALES },
    { label: 'Costs', values: QUARTER_COSTS },
    { label: 'Net', values: QUARTER_NET },
  ],
  userHeading: 'Text entered by the user',
  userIntro:
    'Free answers are shown as written, as plain text. No tag is run, no script is executed and no link is fetched.',
  userTexts: ["Café O'Brien & Sons «Neighbourhood» <new>", HOSTILE_TEXT],
  userOutro: 'End of the sample.',
  sampleNote: 'Sample data for print testing only, not market data.',
};

function dataRow(row: Row, withShare = true): string {
  return (
    `<tr><th scope="row">${text(row.label)}</th>` +
    `<td class="num">${isolatedNumber(row.amount)}</td><td>${text(row.unit)}</td>` +
    (withShare ? `<td class="num">${isolatedNumber(row.share)}</td>` : '') +
    '</tr>'
  );
}

function wideTable(
  caption: string,
  corner: string,
  headings: readonly string[],
  rows: readonly { label: string; values: readonly string[] }[],
  headingsAreLatin: boolean,
): string {
  const head = headings
    .map(
      (h) =>
        `<th class="num" scope="col">${headingsAreLatin ? isolatedLatin(h) : isolatedNumber(h)}</th>`,
    )
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr><th scope="row">${text(row.label)}</th>` +
        row.values.map((v) => `<td class="num">${isolatedNumber(v)}</td>`).join('') +
        '</tr>',
    )
    .join('');
  return (
    `<table class="tbl dense"><caption>${text(caption)}</caption>` +
    `<thead><tr><th scope="col">${text(corner)}</th>${head}</tr></thead><tbody>${body}</tbody></table>`
  );
}

function body(t: SpikeText): string {
  const [itemColumn, amountColumn, currencyColumn, shareColumn] = t.columns;
  return [
    // 1. Cover
    `<section class="page cover"><div class="brand">${isolatedLatin(t.brandLine)}</div>` +
      `<div><h1>${text(t.title)}</h1><p class="subtitle">${text(t.subtitle)}</p></div>` +
      `<div class="meta">${inline(t.issued)}<br>${text(t.sampleNote)}</div></section>`,
    // 2. Executive summary
    `<section class="page"><h1>${text(t.summary)}</h1>` +
      `<div class="slab"><div class="label">${text(t.verdictLabel)}</div>` +
      `<div class="verdict">${text(t.verdict)}</div><p class="reason">${text(t.verdictReason)}</p></div>` +
      `<div class="kpis">${t.keyNumbers
        .map(
          (k) =>
            `<div class="kpi"><div class="value">${inline(k.value)}</div><div class="caption">${text(k.caption)}</div></div>`,
        )
        .join('')}</div>` +
      t.summaryParagraphs.map((p) => `<p>${inline(p)}</p>`).join('') +
      '</section>',
    // 3. Analysis: terms, mixed fragments, glyphs, a list, long lines
    `<section class="page"><h1>${text(t.analysis)}</h1>` +
      t.analysisParagraphs.map((p) => `<p>${inline(p)}</p>`).join('') +
      `<h2>${text(t.glyphHeading)}</h2><p>${text(t.glyphParagraph)}</p>` +
      `<ul class="points">${t.points.map((p) => `<li>${inline(p)}</li>`).join('')}</ul>` +
      `<h2>${text(t.longHeading)}</h2><p class="long">${text(t.longLine)}</p></section>`,
    // 4. Numbers: two tables
    `<section class="page"><h1>${text(t.numbers)}</h1>` +
      `<table class="tbl"><caption>${text(t.tableCaption)}</caption><thead><tr>` +
      `<th scope="col">${text(itemColumn)}</th><th class="num" scope="col">${text(amountColumn)}</th>` +
      `<th scope="col">${text(currencyColumn)}</th><th class="num" scope="col">${text(shareColumn)}</th>` +
      `</tr></thead><tbody>${t.rows.map((r) => dataRow(r)).join('')}</tbody></table>` +
      `<table class="tbl"><caption>${text(t.otherCaption)}</caption><thead><tr>` +
      `<th scope="col">${text(itemColumn)}</th><th class="num" scope="col">${text(amountColumn)}</th>` +
      `<th scope="col">${text(currencyColumn)}</th></tr></thead>` +
      `<tbody>${t.otherRows.map((r) => dataRow(r, false)).join('')}</tbody></table></section>`,
    // 5. Landscape: 12 months and 8 quarters
    `<section class="page wide"><h1>${inline(t.wide)}</h1>` +
      wideTable(t.monthsCaption, t.monthLabel, MONTHS, t.monthRows, false) +
      wideTable(t.quartersCaption, t.quarterLabel, QUARTERS, t.quarterRows, true) +
      '</section>',
    // 6. User text
    `<section class="page"><h1>${text(t.userHeading)}</h1><p>${text(t.userIntro)}</p>` +
      t.userTexts
        .map(
          (value) =>
            `<div class="user-text"><div class="plain" dir="auto">${text(value)}</div></div>`,
        )
        .join('') +
      `<p class="note">${text(t.userOutro)}</p></section>`,
  ].join('\n');
}

export interface SpikeFixture {
  locale: PrintLocale;
  headerTitle: string;
  html: string;
  /** What the rendered PDF must satisfy; the tests read these and nothing else. */
  expected: {
    pages: number;
    /** 1-based numbers of the pages that are landscape. */
    landscapePages: readonly number[];
    /** Phrases that must be in the extracted text, in logical order, with spaces ignored. */
    phrases: readonly string[];
    /** Requests a well-formed document makes that are not data: URLs. */
    hostileResources: number;
  };
}

/** Phrases that only appear in the right order if the shaping and the bidi are right. */
const PHRASES: Record<PrintLocale, readonly string[]> = {
  ar: [
    'الملخّص التنفيذي',
    'نقطة التعادل (Break-even)',
    'لا، إلا، لأنّ',
    'الشَّرِكَةُ الْمُؤَسِّسَةُ',
    '250 د.أ',
    '-1,500 د.أ',
    '83,333.33',
    'DZD',
    '42.5%',
    'LTV/CAC',
    'https://startupbrandname.com/report',
    '<script>',
    'example.invalid/x',
  ],
  en: [
    'Executive summary',
    'The break-even point',
    '250 JOD',
    '-1,500 JOD',
    '83,333.33',
    'DZD',
    '42.5%',
    'LTV/CAC',
    'https://startupbrandname.com/report',
    'لا، إلا، لأنّ',
    '<script>',
    'example.invalid/x',
  ],
};

/** The spike document for one language: Arabic is right-to-left, English left-to-right. */
export async function buildSpikeFixture(
  locale: PrintLocale,
  options: { fontCss?: string } = {},
): Promise<SpikeFixture> {
  const t = locale === 'ar' ? AR : EN;
  const html = await buildPrintDocument({
    locale,
    title: t.title,
    body: body(t),
    ...(options.fontCss === undefined ? {} : { fontCss: options.fontCss }),
  });
  return {
    locale,
    headerTitle: t.headerTitle,
    html,
    expected: {
      pages: 6,
      landscapePages: [5],
      phrases: PHRASES[locale],
      hostileResources: 0,
    },
  };
}
