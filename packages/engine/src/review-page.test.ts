import { describe, expect, it } from 'vitest';
import type { Alert } from './alerts';
import { suggestChanges } from './changes';
import { defaultFigure } from './figure';
import { flatProvenance } from './flat-vector';
import {
  GOLDEN_PROJECTS,
  runGolden,
  type GoldenProject,
  type HeadlineRow,
} from './golden-projects';
import { makeMoney } from './money';
import { makeRate } from './rate';
import type { RunAlert } from './run';
import {
  alertSentence,
  describeAnswers,
  describeExpected,
  esc,
  formatMoney,
  formatPercent,
  formatPlain,
  formatRatio,
  caseReviewEntries,
  goldenReviewEntries,
  h,
  monthsPhrase,
  renderReviewPage,
  type ReviewEntry,
} from './review-page';
import type { TaxAlert } from './tax';

/** The page without its number isolation, to look for words that hold digits. */
const plainOf = (html: string): string =>
  html.split('<bdi dir="ltr">').join('').split('</bdi>').join('');

/**
 * The text of the page that is outside every tag and outside the `style`, `code` and `bdi`
 * elements, where digits are allowed. It walks the pieces between tags instead of stripping tags
 * with a pattern, so an unclosed element cannot hide text: it throws when they do not balance.
 */
function textOutsideIsolates(html: string): string {
  const skipped = new Set(['style', 'code', 'bdi']);
  let open = 0;
  let text = '';
  for (const piece of html.split(/(<[^>]*>)/)) {
    if (piece.startsWith('<')) {
      const name = /^<\/?([a-z][a-z0-9]*)/i.exec(piece)?.[1]?.toLowerCase() ?? '';
      if (skipped.has(name)) open += piece.startsWith('</') ? -1 : 1;
      if (open < 0) throw new Error('A closing tag has no opening tag: ' + piece);
    } else if (open === 0) {
      text += piece;
    }
  }
  if (open !== 0) throw new Error('An element that holds digits is not closed');
  return text;
}

const jod = { currency: 'JOD', label: 'د.أ' };
const dzd = { currency: 'DZD', label: 'DZD' };

describe('writing numbers', () => {
  it('groups thousands and drops trailing zeros', () => {
    expect(formatPlain('54000.000')).toBe('54,000');
    expect(formatPlain('-12345.600')).toBe('-12,345.6');
    expect(formatPlain('83333.33')).toBe('83,333.33');
    expect(formatPlain('0.005')).toBe('0.005');
    expect(formatPlain('250')).toBe('250');
    expect(formatPlain('1234567')).toBe('1,234,567');
  });

  it('puts the currency label after the number', () => {
    expect(formatMoney(makeMoney(54_000_000n, 'JOD'), 'د.أ')).toBe('54,000 د.أ');
    expect(formatMoney(makeMoney(-1_500_000n, 'JOD'), 'د.أ')).toBe('-1,500 د.أ');
    expect(formatMoney(makeMoney(8_333_333n, 'DZD'), 'DZD')).toBe('83,333.33 DZD');
    expect(formatMoney(makeMoney(30_833n, 'JOD'), 'د.أ')).toBe('30.833 د.أ');
  });

  it('writes rates as a percentage or a ratio, exactly', () => {
    expect(formatPercent(makeRate(3n, 8n))).toBe('37.5%');
    expect(formatPercent(makeRate(4n, 5n))).toBe('80%');
    expect(formatPercent(makeRate(-1n, 5n))).toBe('-20%');
    expect(formatPercent(makeRate(1n, 3n))).toBe('33.33%');
    expect(formatRatio(makeRate(8n, 1n))).toBe('8');
    expect(formatRatio(makeRate(3n, 5n))).toBe('0.6');
    expect(formatRatio(makeRate(11n, 10n))).toBe('1.1');
  });

  it('counts months in Arabic grammar', () => {
    expect(monthsPhrase(1)).toBe('شهر واحد');
    expect(monthsPhrase(2)).toBe('شهران');
    expect(monthsPhrase(3)).toBe('3 أشهر');
    expect(monthsPhrase(10)).toBe('10 أشهر');
    expect(monthsPhrase(11)).toBe('11 شهرًا');
    expect(monthsPhrase(34)).toBe('34 شهرًا');
  });

  it('escapes HTML with named entities only, and isolates numbers and IDs', () => {
    expect(esc(`<b a="1" b='2'>&</b>`)).toBe(
      '&lt;b a=&quot;1&quot; b=&apos;2&apos;&gt;&amp;&lt;/b&gt;',
    );
    expect(h('1,800 × 30 = 54,000 د.أ')).toBe('<bdi dir="ltr">1,800 × 30 = 54,000</bdi> د.أ');
    expect(h('الشهر 6')).toBe('الشهر <bdi dir="ltr">6</bdi>');
    expect(h('السؤال F6.2 والأداة T7')).toBe(
      'السؤال <bdi dir="ltr">F6.2</bdi> والأداة <bdi dir="ltr">T7</bdi>',
    );
    expect(h('الربح −1,500 د.أ، أي خسارة')).toBe('الربح <bdi dir="ltr">−1,500</bdi> د.أ، أي خسارة');
    expect(h('(1,800 × 6 = 10,800) و20% × 8,400')).toBe(
      '<bdi dir="ltr">(1,800 × 6 = 10,800)</bdi> و<bdi dir="ltr">20% × 8,400</bdi>',
    );
    expect(h('بلا أرقام')).toBe('بلا أرقام');
    // A bracket without its partner inside the run stays in the surrounding text (balanced pairs).
    expect(h('التعادل (6 أشهر)')).toBe('التعادل (<bdi dir="ltr">6</bdi> أشهر)');
    expect(h('3 (7,126,000 DZD)')).toBe(
      '<bdi dir="ltr">3</bdi> (<bdi dir="ltr">7,126,000</bdi> DZD)',
    );
    expect(h('(نمو 100%)')).toBe('(نمو <bdi dir="ltr">100%</bdi>)');
    expect(h('2026-10-05')).toBe('<bdi dir="ltr">2026-10-05</bdi>');
  });
});

describe('the inputs in words', () => {
  const lines = (project: GoldenProject) =>
    Object.fromEntries(describeAnswers(project).map((line) => [line.id, line.text]));

  it('writes every answer of the subscription service', () => {
    const [project] = GOLDEN_PROJECTS;
    if (project === undefined) throw new Error('no project');
    const said = lines(project);
    expect(said.F1).toBe('30 د.أ');
    expect(said.F2).toBe('اشتراك');
    expect(said['F2.1']).toBe('5%');
    expect(said.F3).toBe('الاستضافة والخدمات السحابية: 4 د.أ، دعم العملاء: 2 د.أ. المجموع 6 د.أ');
    expect(said.F4).toContain('المجموع 2,000 د.أ');
    expect(said.E8).toBe('مطوّر برمجيات: 1,500 د.أ شهريًا من الشهر 4');
    expect(said.F6).toBe('الشهر 1: 0، الشهر 6: 200، الشهر 12: 200 وحدة');
    expect(said.D7).toBe('غير موسمي');
    expect(said.E7).toBe('لم يُجَب');
    expect(said.F7).toBe('نقدًا عند الشراء');
    expect(said.D4).toBe('منافس أ: 35 د.أ، منافس ب: 28 د.أ، منافس ج: 32 د.أ، منافس د: غير معروف');
    expect(said.D6).toBe('لا');
    expect(said.G1).toBe('شركة');
    expect(said.A5).toBe('من 8,000 د.أ إلى 15,000 د.أ');
    expect(said.A7).toBe('أقل من 3 أشهر');
    expect(said.H3).toBe('مدخراته الشخصية ومستثمر');
    expect(said.H5).toBe('خلال 12 شهرًا');
    expect(said.H6).toBe('هل سيقبل العملاء دفع اشتراك شهري بهذا السعر؟');
  });

  it('writes a season, a foreign share, an unknown answer and the dinar with two decimals', () => {
    const [, shop, algeria] = GOLDEN_PROJECTS;
    if (shop === undefined || algeria === undefined) throw new Error('no project');
    expect(lines(shop).D7).toBe('موسمي، وذروته في نوفمبر وديسمبر');
    expect(lines(shop).D6).toBe('نعم، 60% من التكاليف');
    expect(lines(shop).G1).toBe('لم أقرّر بعد');
    expect(lines(shop).E8).toBe('لم يُجَب');
    expect(lines(algeria).D7).toBe('لا أعرف');
    expect(lines(algeria).F1).toBe('2,000 DZD');
    expect(lines(algeria)['F6.2']).toBe('100%');
  });

  it('writes the staff plan when nobody is hired, and an option it has no words for as it is', () => {
    const [project] = GOLDEN_PROJECTS;
    if (project === undefined) throw new Error('no project');
    const odd: GoldenProject = {
      ...project,
      answers: {
        ...project.answers,
        E8: { status: 'answered', value: { items: [] } },
        F7: { status: 'answered', value: 'barter' },
        F1: { status: 'answered', value: { amount: 12.5, currency: 'JOD' } },
      },
    };
    expect(lines(odd).E8).toBe('لا موظفين');
    expect(lines(odd).F7).toBe('barter');
    expect(lines(odd).F1).toBe('12.5 د.أ');
  });

  it('lists the 21 questions in a fixed order with their IDs in the labels', () => {
    const [project] = GOLDEN_PROJECTS;
    if (project === undefined) throw new Error('no project');
    const all = describeAnswers(project);
    expect(all).toHaveLength(21);
    expect(all[0]).toMatchObject({ id: 'F1', label: 'سعر البيع للوحدة (F1)' });
    expect(all.at(-1)).toMatchObject({ id: 'H6' });
  });

  it('can leave out the questions that were not answered', () => {
    const [shop] = caseReviewEntries();
    if (shop === undefined) throw new Error('no case');
    const answered = describeAnswers(shop.project, true).map((line) => line.id);
    expect(answered).toEqual(['F1', 'F3', 'F4', 'F5', 'F6', 'E7', 'A5', 'A7', 'H3', 'H5', 'H6']);
    expect(describeAnswers(shop.project)).toHaveLength(21);
  });
});

describe('describing a value', () => {
  it('writes each kind of headline value', () => {
    expect(describeExpected('cm', { kind: 'money', minor: 24_000n }, jod)).toBe('24 د.أ');
    expect(describeExpected('be_units', { kind: 'units', units: 171n }, jod)).toBe('171 وحدة');
    expect(describeExpected('be_month', { kind: 'month', month: 6 }, jod)).toBe('الشهر 6');
    expect(describeExpected('be_month', { kind: 'month', month: null }, jod)).toBe(
      'لا تعادل خلال 36 شهرًا',
    );
    expect(describeExpected('payback', { kind: 'month', month: 34 }, jod)).toBe('34 شهرًا');
    expect(describeExpected('payback', { kind: 'month', month: 0 }, jod)).toBe(
      'لم ينزل الرصيد تحت الصفر',
    );
    expect(describeExpected('payback', { kind: 'month', month: null }, jod)).toBe(
      'لا يُسترد خلال 36 شهرًا',
    );
    expect(describeExpected('cm_rate', { kind: 'rate', rate: makeRate(3n, 5n) }, jod)).toBe('60%');
    expect(describeExpected('ltv_cac', { kind: 'rate', rate: makeRate(8n, 1n) }, jod)).toBe('8');
    expect(describeExpected('be_rev', { kind: 'money', minor: 8_333_333n }, dzd)).toBe(
      '83,333.33 DZD',
    );
  });
});

describe('the sentences of the alerts', () => {
  const provenance = {
    source: 'user',
    confidence: 'high',
    validated: true,
    inputs: [],
  } as const;
  const money = (minor: bigint) => ({ kind: 'money', money: makeMoney(minor, 'JOD') }) as const;
  const economics = (
    alert: Pick<Alert, 'code' | 'severity' | 'measured' | 'limit'> & Partial<Alert>,
  ) => ({ ...provenance, origin: 'economics', ...alert }) as RunAlert;
  const taxed = (alert: Partial<TaxAlert> & Pick<TaxAlert, 'code'>) =>
    ({
      ...provenance,
      severity: 'warning',
      year: null,
      regime: null,
      measured: null,
      limit: null,
      gap: null,
      origin: 'tax',
      ...alert,
    }) as RunAlert;

  it.each([
    [
      'cm_not_positive',
      'block',
      money(0n),
      money(0n),
      'هامش المساهمة (0 د.أ) ليس موجبًا، فكل وحدة تُباع تخسر أو تتعادل.',
    ],
    [
      'break_even_units_above_capacity',
      'warning',
      { kind: 'units', units: 80n },
      { kind: 'units', units: 50n },
      'نقطة التعادل (80 وحدة) أعلى من الطاقة القصوى الشهرية (50 وحدة).',
    ],
    [
      'break_even_month_above_target',
      'warning',
      { kind: 'months', months: 8 },
      { kind: 'months', months: 6 },
      'التعادل (8 أشهر) بعد أطول مدة قبلها المؤسس (6 أشهر).',
    ],
    [
      'break_even_month_above_runway',
      'warning',
      { kind: 'months_after', months: 36 },
      { kind: 'months', months: 3 },
      'التعادل (بعد الشهر 36) بعد المدة التي يتحمّلها المؤسس بلا دخل (3 أشهر).',
    ],
    [
      'setup_costs_above_capital',
      'warning',
      money(9_000_000n),
      money(6_000_000n),
      'تكاليف التأسيس (9,000 د.أ) أعلى من أقصى رأس مال متاح (6,000 د.أ).',
    ],
    [
      'price_below_floor',
      'warning',
      money(30_000n),
      money(30_833n),
      'السعر (30 د.أ) أقل من سعر الحدّ الأدنى (30.833 د.أ).',
    ],
    [
      'ltv_to_cac_below_minimum',
      'warning',
      { kind: 'ratio', ratio: makeRate(2n, 1n) },
      { kind: 'ratio', ratio: makeRate(3n, 1n) },
      'نسبة LTV إلى CAC (2) أقل من الحدّ الأدنى (3).',
    ],
  ] as const)('%s', (code, severity, measured, limit, sentence) => {
    expect(alertSentence(economics({ code, severity, measured, limit }), jod)).toBe(sentence);
  });

  it('writes the range alert with its lower limit', () => {
    const alert = economics({
      code: 'setup_costs_within_capital_range',
      severity: 'note',
      measured: money(12_000_000n),
      limit: money(15_000_000n),
      lowerLimit: money(8_000_000n),
    });
    expect(alertSentence(alert, jod)).toBe(
      'تكاليف التأسيس (12,000 د.أ) فوق أدنى رأس مال متاح (8,000 د.أ) وتحت أقصاه (15,000 د.أ).',
    );
  });

  it('writes the alerts of the tax engine', () => {
    const ceiling = taxed({
      code: 'turnover_above_regime_ceiling',
      year: 3,
      regime: 'fixture_auto_entrepreneur',
      measured: { kind: 'money', money: makeMoney(712_600_000n, 'DZD') },
      limit: { kind: 'money', money: makeMoney(500_000_000n, 'DZD') },
    });
    expect(alertSentence(ceiling, dzd)).toBe(
      'مبيعات السنة 3 (7,126,000 DZD) تتجاوز سقف نظام fixture_auto_entrepreneur (5,000,000 DZD).',
    );
    const vat = taxed({
      code: 'turnover_above_vat_threshold',
      year: 2,
      measured: money(50_000_000n),
      limit: money(30_000_000n),
    });
    expect(alertSentence(vat, jod)).toBe(
      'مبيعات السنة 2 (50,000 د.أ) تتجاوز حدّ التسجيل في ضريبة القيمة المضافة (30,000 د.أ).',
    );
    expect(
      alertSentence(taxed({ code: 'tax_regime_not_calculated', gap: { code: 'no_rule' } }), jod),
    ).toContain('لا توجد قاعدة');
    expect(
      alertSentence(
        taxed({
          code: 'tax_regime_not_calculated',
          gap: { code: 'ambiguous_regime', regimes: ['a', 'b'] },
        }),
        jod,
      ),
    ).toContain('لا يختار');
    expect(
      alertSentence(
        taxed({
          code: 'tax_regime_not_calculated',
          gap: { code: 'rule_other_currency', currency: 'USD' },
        }),
        jod,
      ),
    ).toContain('USD');
  });
});

describe('the review page', () => {
  const entries = goldenReviewEntries();
  const page = renderReviewPage(entries);

  it('is built from the three golden projects', () => {
    expect(entries.map((entry) => entry.project.name)).toEqual([
      'jo-service-subscription',
      'jo-home-ecommerce',
      'dz-auto-entrepreneur',
    ]);
    expect(entries[1]?.variants).toHaveLength(4);
    for (const entry of entries) expect(entry.run).toEqual(runGolden(entry.project));
  });

  it('is a self-contained Arabic right-to-left document', () => {
    expect(page.startsWith('<!doctype html>\n<html lang="ar" dir="rtl">')).toBe(true);
    expect(page.endsWith('</html>\n')).toBe(true);
    expect(page).toContain('<meta charset="utf-8">');
    expect(page).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(page).toContain('<meta name="color-scheme" content="light dark">');
    expect(page.match(/<h1>/g)).toHaveLength(1);
    expect(page).toContain('<title>مراجعة المحرّك الحسابي</title>');
  });

  it('has no script, no event handler and no request to anywhere', () => {
    expect(page).not.toMatch(/<script/i);
    expect(page).not.toMatch(/\son[a-z]+=/i);
    expect(page).not.toMatch(/<(link|img|iframe|object|embed|video|audio|source)\b/i);
    expect(page).not.toMatch(/\b(src|href|action)="(?!#)/);
    expect(page).not.toMatch(/url\(|@import|https?:\/\//);
  });

  it('says in a banner that the projects are samples with unverified fixture tax rules', () => {
    expect(page).toContain('<p class="banner" role="note">');
    expect(page).toContain('مشاريع نموذجية وليست حقيقية');
    expect(page).toContain('تجريبية غير موثّقة');
    expect(page).toContain('ولا نصيحة مالية أو ضريبية');
  });

  it('has a section with a title for each project and for the assumptions, in the navigation', () => {
    for (const entry of entries) {
      const id = entry.project.name;
      expect(page).toContain(`<section id="${id}" aria-labelledby="${id}-title">`);
      expect(page).toContain(`<a href="#${id}">`);
    }
    expect(page).toContain('<section id="assumptions"');
    expect(page).toContain('<nav aria-label="المشاريع">');
    expect(page).toContain('<main id="main">');
    expect(page).toContain('<a class="skip" href="#main">');
  });

  it('puts every headline number next to its hand computation, with a mark that the engine agrees', () => {
    const rows = entries.reduce((sum, entry) => sum + entry.project.rows.length, 0);
    expect(page.match(/✓ مطابق/g)?.length).toBeGreaterThanOrEqual(rows);
    expect(page).not.toContain('غير مطابق');
    expect(page).toContain('<bdi dir="ltr">1,800 × 30 = 54,000</bdi> د.أ');
    expect(page).toContain('<strong class="key"><bdi dir="ltr">54,000</bdi> د.أ</strong>');
    expect(page).toContain('<strong class="key"><bdi dir="ltr">83,333.33</bdi> DZD</strong>');
  });

  it('marks a hand computation the engine does not match', () => {
    const [first, ...rest] = entries;
    if (first === undefined) throw new Error('no entry');
    const wrong: HeadlineRow = {
      id: 'cm',
      label: 'هامش المساهمة',
      hand: '30 − 6 = 99',
      expected: { kind: 'money', minor: 99_000n },
    };
    const changed: ReviewEntry = { ...first, project: { ...first.project, rows: [wrong] } };
    const broken = renderReviewPage([changed, ...rest]);
    expect(broken).toContain('<span class="mark bad">✕ غير مطابق</span>');
    const variantWrong: ReviewEntry = {
      ...first,
      variants: [
        {
          row: {
            option: 'cash',
            hand: 'x',
            fundingNeed: 1n,
            fundingMonth: 0,
            payback: null,
          },
          fundingNeed: 2n,
          fundingMonth: 0,
          payback: null,
        },
      ],
    };
    expect(renderReviewPage([variantWrong])).toContain('✕ غير مطابق');
  });

  it('shows the scenarios, the ranked tornado with its top variable, the FX table and the four F7 options', () => {
    expect(page.match(/متحفّظ \(Conservative\)/g)).toHaveLength(3);
    expect(page).toContain('(أول تجربة مقترحة)');
    expect(page.match(/<h3>اختبار العملة الأجنبية \(FX test\)<\/h3>/g)).toHaveLength(1);
    expect(page.match(/<h3>طرق الدفع الأربع على المتجر نفسه<\/h3>/g)).toHaveLength(1);
    for (const word of ['نقدًا عند الشراء', 'بالآجل (بعد شهر)', 'بالتقسيط (ثلاث دفعات)']) {
      expect(page).toContain(word);
    }
    expect(page).toContain('الصدمة');
    expect(plainOf(page)).toContain('لا يُسترد خلال 36 شهرًا');
  });

  it('shows the alerts that fired, with their provenance', () => {
    expect(page).toContain('<strong class="sev sev-warning">تحذير</strong>');
    expect(page).toContain('<strong class="sev sev-note">ملاحظة</strong>');
    expect(page).toContain('تتجاوز سقف نظام fixture_auto_entrepreneur');
    expect(page).toContain('تكاليف التأسيس');
    expect(page).toContain('افتراض، الثقة منخفضة، غير مؤكَّد');
  });

  it('lists what the engine read differently from the answers, and its assumptions', () => {
    expect(plainOf(page)).toContain(
      'الشكل القانوني (G1) غير محسوم فافترض المحرّك صاحب منشأة فردية',
    );
    expect(page).toContain('افتراضات المحرّك');
    expect(plainOf(page)).toContain('× 0.6');
    expect(page).toContain('غير مطبّق: لا نسبة موثّقة');
    expect(plainOf(page)).toContain('جزء من النقد يصل بعد الشهر 36 فلم يدخل في الحساب');
  });

  it('writes only Western digits, each isolated in a bdi, and the currency after the number', () => {
    expect(page).not.toMatch(/[٠-٩۰-۹]/);
    expect(textOutsideIsolates(page)).not.toMatch(/\d/);
  });

  it('never splits a pair of brackets between an isolate and the text around it', () => {
    const isolates = [...page.matchAll(/<bdi dir="ltr">([^<]*)<\/bdi>/g)].map(
      (match) => match[1] ?? '',
    );
    expect(isolates.length).toBeGreaterThan(0);
    for (const run of isolates) {
      expect(run.split('(').length, run).toBe(run.split(')').length);
    }
  });

  it('is deterministic and ends with one newline', () => {
    expect(renderReviewPage(goldenReviewEntries())).toBe(page);
    expect(page.endsWith('\n\n')).toBe(false);
  });

  it('builds without projects', () => {
    const empty = renderReviewPage([]);
    expect(empty).toContain('<h1>');
    expect(empty).not.toContain('id="assumptions"');
  });

  it('leaves out an assumption the run does not hold, and one without a key', () => {
    const [first, ...rest] = entries;
    if (first === undefined) throw new Error('no entry');
    const odd: ReviewEntry = {
      ...first,
      run: {
        ...first.run,
        parameters: [
          ...first.run.parameters.slice(1),
          { value: 1, source: 'assumption', confidence: 'low', validated: false, inputs: [] },
        ],
      },
    };
    const text = renderReviewPage([odd, ...rest]);
    expect(text).not.toContain('أفق الإسقاط');
    expect(text).toContain('معامل شهر الذروة');
  });

  it('shows the cash flow notes and a project without a cash flow', () => {
    const [, shop] = entries;
    if (shop === undefined) throw new Error('no entry');
    const noSetup: GoldenProject = {
      ...shop.project,
      answers: Object.fromEntries(
        Object.entries(shop.project.answers).filter(([id]) => id !== 'F5'),
      ),
    };
    const run = runGolden(noSetup);
    const text = renderReviewPage([
      {
        project: { ...shop.project, rows: [] },
        run,
        variants: [],
        changes: suggestChanges(run, shop.project.tax),
      },
    ]);
    expect(plainOf(text)).toContain('تكاليف التأسيس (F5) لم تُحدَّد');
    expect(plainOf(text)).toContain('غير محسوب: تكاليف التأسيس (F5) ناقصة');
  });

  it('shows a project without alerts or notes', () => {
    const [first] = entries;
    if (first === undefined) throw new Error('no entry');
    const quiet: ReviewEntry = {
      ...first,
      project: { ...first.project, rows: [] },
      run: {
        ...first.run,
        alerts: [],
        projection: { ...first.run.projection, notes: [] },
        cash: {
          ...first.run.cash,
          cashFlow: {
            status: 'not_calculable',
            reason: { code: 'setup_costs_unset', questionId: 'F5', state: 'missing' },
          },
        },
      },
    };
    const text = renderReviewPage([quiet]);
    expect(text).toContain('<p>لا تنبيهات.</p>');
    expect(text).toContain('<p>لا ملاحظات.</p>');
  });

  it('shows a tornado with no top variable and an unreached break-even', () => {
    const [first] = entries;
    if (first === undefined) throw new Error('no entry');
    const run = {
      ...first.run,
      tornado: { ...first.run.tornado, top: null },
      scenarios: {
        ...first.run.scenarios,
        base: {
          ...first.run.scenarios.base,
          breakEvenMonth: { ...first.run.scenarios.base.breakEvenMonth, value: null },
        },
      },
    };
    const text = renderReviewPage([{ ...first, run }]);
    expect(text).not.toContain('(أول تجربة مقترحة)');
    expect(plainOf(text)).toContain('لا تعادل خلال 36 شهرًا');
  });

  it('shows an FX shock without a funding need or a break-even', () => {
    const [, shop] = entries;
    const fx = shop?.run.cash.fxTest;
    if (shop === undefined || !fx) throw new Error('no fx');
    const first = fx.shocks[0];
    if (first === undefined) throw new Error('no shock');
    const run = {
      ...shop.run,
      cash: {
        ...shop.run.cash,
        fxTest: {
          ...fx,
          shocks: [
            {
              ...first,
              fundingNeed: null,
              breakEvenMonth: { ...first.breakEvenMonth, value: null },
            },
          ],
        },
      },
    };
    const text = renderReviewPage([{ ...shop, run }]);
    expect(text).toContain('غير محسوب');
    expect(text).toContain('لا تعادل');
  });
});

describe('the style of the page', () => {
  const page = renderReviewPage(goldenReviewEntries());
  const css = /<style>([\s\S]*)<\/style>/.exec(page)?.[1] ?? '';

  /** WCAG relative luminance and contrast ratio of two #rrggbb colours. */
  const luminance = (hex: string): number => {
    const channel = (start: number) => {
      const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const contrast = (a: string, b: string): number => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
  };

  const tokens = (block: string): Record<string, string> =>
    Object.fromEntries(
      [...block.matchAll(/--([a-z]+):(#[0-9a-f]{6})/g)].map((m): [string, string] => [
        m[1] ?? '',
        m[2] ?? '',
      ]),
    );
  const light = tokens(/:root\{([^}]*)\}/.exec(css)?.[1] ?? '');
  const dark = {
    ...light,
    ...tokens(/prefers-color-scheme:dark\)\{:root\{([^}]*)\}/.exec(css)?.[1] ?? ''),
  };

  it('uses only the brand colours and neutrals as tokens', () => {
    expect(light.gold).toBe('#d4a537');
    expect(light.teal).toBe('#1fa3c7');
    expect(light.chip).toBe('#000000');
    expect(dark.bg).toBe('#000000');
    expect(light.bg).toBe('#ffffff');
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ] as const)('meets WCAG 2.2 AA contrast in the %s theme', (_name, theme) => {
    const text = (colour: string | undefined, background: string | undefined) =>
      contrast(colour ?? '', background ?? '');
    expect(text(theme.fg, theme.bg)).toBeGreaterThanOrEqual(7);
    expect(text(theme.muted, theme.bg)).toBeGreaterThanOrEqual(4.5);
    expect(text(theme.fg, theme.soft)).toBeGreaterThanOrEqual(4.5);
    expect(text(theme.link, theme.bg)).toBeGreaterThanOrEqual(4.5);
    // The key numbers: gold on black, in both themes.
    expect(text(theme.gold, theme.chip)).toBeGreaterThanOrEqual(7);
    // The focus indicator: the teal ring, or the black ring around it, shows at 3:1.
    expect(Math.max(text(theme.teal, theme.bg), text(theme.ring, theme.bg))).toBeGreaterThanOrEqual(
      3,
    );
    // The rules between rows are decoration; the text on them is checked above.
  });

  it('uses logical properties only, with no gradient, blurred shadow or capitals', () => {
    expect(css).not.toMatch(/\b(left|right)\b/);
    expect(css).not.toMatch(/\b(margin|padding|border)-(top|bottom)\b/);
    expect(css).not.toMatch(/gradient|text-transform|filter|blur/);
    const shadows = css.match(/box-shadow:[^;}]*/g) ?? [];
    expect(shadows).toEqual(['box-shadow:0 0 0 2px var(--ring)']);
  });

  it('stacks the tables on a narrow screen and shows a visible focus', () => {
    expect(css).toContain('@media (max-width:42em)');
    expect(css).toContain('table.stack tr{display:block');
    expect(css).toContain(':focus-visible{outline:3px solid var(--teal)');
    expect(css).toContain('td::before{content:attr(data-label)');
  });
});

describe('the score, the verdict, confidence and the plan on the page', () => {
  const entries = goldenReviewEntries();
  const cases = caseReviewEntries();
  const page = renderReviewPage(entries, cases);

  it('builds the four synthetic cases from the engine fixtures, in order', () => {
    expect(cases.map((entry) => entry.project.name)).toEqual([
      'case-good',
      'case-borderline',
      'case-negative-margin',
      'case-funding-gap',
    ]);
    for (const entry of cases) {
      expect(entry.run).toEqual(runGolden(entry.project));
      expect(entry.variants).toEqual([]);
    }
  });

  it('has a block of the score and the verdict in each of the three projects', () => {
    expect(page.match(/<h3>الجدوى والقرار<\/h3>/g)).toHaveLength(3);
    expect(page.match(/<h4>معايير الجدوى<\/h4>/g)).toHaveLength(7);
    expect(page.match(/<h4>الثقة الإجمالية<\/h4>/g)).toHaveLength(7);
    expect(page.match(/<h4>خطة التحقّق<\/h4>/g)).toHaveLength(7);
  });

  it('shows the eleven criteria of each project with their status and hand reason', () => {
    expect(page).toContain('هامش المساهمة للوحدة أكبر من صفر');
    expect(plainOf(page)).toContain('وحدات التعادل ضمن الطاقة القصوى (E7)');
    expect(page.match(/<strong>خارج العدّ<\/strong>/g)?.length).toBeGreaterThanOrEqual(7);
    expect(page.match(/<strong>يتحقق<\/strong>/g)?.length).toBeGreaterThan(20);
    expect(page.match(/<strong>لا يتحقق<\/strong>/g)?.length).toBeGreaterThan(10);
    expect(plainOf(page)).toContain(
      'التعادل في الشهر 4 (ربح الشهر 3 = 40 × 1,200 − 50,000 = −2,000',
    );
  });

  it('writes the verdict word, and with a stop the fixed sentence of CLAUDE.md section 3', () => {
    for (const word of ['امضِ', 'عدّل', 'توقّف']) {
      expect(page).toContain(`<strong class="key">${word}</strong>`);
    }
    expect(page).toContain('غير قابل للتنفيذ بصيغته الحالية');
    expect(page.match(/القرار توقّف: غير قابل للتنفيذ بصيغته الحالية/g)).toHaveLength(3);
    expect(page).not.toContain('(2b)');
    expect(page).not.toContain('تأتي في الخطوة التالية');
  });

  it('says on every score that it is not a probability of success', () => {
    expect(page.match(/الدرجة ليست احتمال نجاح/g)).toHaveLength(7);
  });

  it('shows the score as passed of evaluated with its percentage', () => {
    expect(plainOf(page)).toContain('<strong class="key">6 من 10 = 60%</strong>');
    expect(plainOf(page)).toContain('8 من 9 = 88.89%');
    expect(plainOf(page)).toContain('7 من 10 = 70%');
    expect(plainOf(page)).toContain('1 من 10 = 10%');
  });

  it('shows what held a go back, the blockers, the confidence figures and the plan', () => {
    expect(plainOf(page)).toContain('ما يمنع «امضِ»: الدرجة دون الخط');
    expect(plainOf(page)).toContain('احتياج التمويل فوق ضعف أقصى رأس مال ولا مصدر خارجي في H3');
    expect(page).toContain('هامش المساهمة صفر أو أقل');
    expect(page).toContain('لا حاجب');
    expect(plainOf(page)).toContain('سعر البيع (F1)');
    expect(plainOf(page)).toContain('تكاليف التأسيس (F5)');
    expect(page).toContain('<code>price.willingness_to_pay</code>');
    expect(page).toContain('<code>variable_cost.supplier_quotes</code>');
    expect(page).toContain('عرض سعر من مورّد');
    expect(plainOf(page)).toContain('قلق المؤسس (H6)');
    expect(page).toContain('—');
    expect(page).toContain('«هل سيقبل العملاء دفع اشتراك شهري بهذا السعر؟»');
  });

  it('has a section of the four cases, in the navigation, each with its inputs and its blocks', () => {
    expect(page).toContain('<section id="verdict-cases" aria-labelledby="verdict-cases-title">');
    expect(page).toContain('<a href="#verdict-cases">');
    for (const entry of cases) {
      const id = entry.project.name;
      expect(page).toContain(`<article id="${id}" aria-labelledby="${id}-title">`);
    }
    expect(page.match(/<h4>المدخلات بالكلمات<\/h4>/g)).toHaveLength(4);
    expect(page).toContain('مشروع اصطناعي مبني على أرقام الاختبار المسطّحة');
  });

  it('agrees with every hand computation of the verdicts', () => {
    expect(page).not.toContain('غير مطابق');
    expect(page.match(/✓ مطابق/g)?.length).toBeGreaterThan(100);
  });

  it('writes only Western digits, each isolated, with brackets that stay together', () => {
    expect(page).not.toMatch(/[٠-٩۰-۹]/);
    expect(textOutsideIsolates(page)).not.toMatch(/\d/);
    for (const match of page.matchAll(/<bdi dir="ltr">([^<]*)<\/bdi>/g)) {
      const run = match[1] ?? '';
      expect(run.split('(').length, run).toBe(run.split(')').length);
    }
  });

  it('keeps the page free of script and of any request, and deterministic', () => {
    expect(page).not.toMatch(/<script/i);
    expect(page).not.toMatch(/url\(|@import|https?:\/\//);
    expect(renderReviewPage(goldenReviewEntries(), caseReviewEntries())).toBe(page);
    expect(page.endsWith('</html>\n')).toBe(true);
  });

  it('lists the new thresholds among the assumptions', () => {
    const text = plainOf(page);
    expect(text).toContain('نافذة الجدوى للتعادل والاسترداد');
    expect(text).toContain('خط الدرجة للقرار «امضِ»');
    expect(text).toContain('× 2');
    expect(text).toContain('خط الثقة الإجمالية العالية');
    expect(text).toContain('خط الثقة الإجمالية المتوسطة');
  });

  it('builds the cases without projects, and a page without cases has no cases section', () => {
    const only = renderReviewPage([], cases);
    expect(only).toContain('id="verdict-cases"');
    expect(only).not.toContain('id="assumptions"');
    expect(renderReviewPage(entries)).not.toContain('verdict-cases');
  });

  it('marks a hand computation of the verdict that the engine does not match', () => {
    const [first] = cases;
    if (first === undefined) throw new Error('no case');
    const decision = first.project.decision;
    const wrong: ReviewEntry = {
      ...first,
      project: {
        ...first.project,
        decision: {
          ...decision,
          criteria: decision.criteria.map((row, index) =>
            index === 0 ? { ...row, status: 'fail' } : row,
          ),
          passed: 3,
          blockers: ['margin_not_positive'],
          verdict: 'stop',
          confidence: 'low',
          sound: 1,
          plan: ['price'],
        },
      },
    };
    const broken = renderReviewPage([], [wrong]);
    expect(broken.match(/✕ غير مطابق/g)).toHaveLength(6);
  });

  it('shows a run with no score, a missing figure, no worry and several blockers', () => {
    const [first] = cases;
    const shop = entries[1];
    if (first === undefined || shop === undefined) throw new Error('no entry');
    const noScore: ReviewEntry = {
      ...first,
      run: { ...first.run, feasibility: { ...first.run.feasibility, score: null } },
    };
    expect(plainOf(renderReviewPage([], [noScore]))).toContain('لا درجة: لا معيار مقيَّم');
    // Without headline rows: the rows of the shop need the cash flow and a price floor.
    const bare = { ...shop.project, rows: [], paymentVariants: [] };
    const unknownSetup = runGolden({
      ...bare,
      answers: { ...bare.answers, F5: { status: 'unknown' } },
    });
    const missing: ReviewEntry = {
      project: bare,
      run: unknownSetup,
      variants: [],
      changes: suggestChanges(unknownSetup, bare.tax),
    };
    const text = plainOf(renderReviewPage([missing]));
    expect(text).toContain('غير موجود');
    const stopped = runGolden({
      ...bare,
      answers: {
        ...shop.project.answers,
        F6: { status: 'answered', value: { month1: 0, month6: 0, month12: 0 } },
      },
    });
    const sentence = plainOf(
      renderReviewPage([
        { project: bare, run: stopped, variants: [], changes: suggestChanges(stopped, bare.tax) },
      ]),
    );
    expect(sentence).toContain(
      'لا تعادل ضمن نافذة الجدوى في الحالة الأساسية، احتياج التمويل فوق ضعف أقصى رأس مال ولا مصدر خارجي في H3',
    );
  });

  it('shows the hold backs of a project that is not stopped and not go', () => {
    const [first] = cases;
    if (first === undefined) throw new Error('no case');
    const held: ReviewEntry = {
      ...first,
      run: {
        ...first.run,
        verdict: { ...first.run.verdict, holdBacks: ['confidence_low', 'no_score'] },
      },
    };
    expect(plainOf(renderReviewPage([], [held]))).toContain(
      'ما يمنع «امضِ»: الثقة الإجمالية منخفضة، لا معيار مقيَّم',
    );
  });
});

describe('the changes that would change the verdict on the page (D-262)', () => {
  const entries = goldenReviewEntries();
  const cases = caseReviewEntries();
  const page = renderReviewPage(entries, cases);

  it('has a table of changes for each project that is not a go, and none for a go', () => {
    // The subscription service and the shop, the borderline, negative margin and funding gap cases.
    expect(page.match(/<h4>التغييرات التي قد تغيّر القرار<\/h4>/g)).toHaveLength(5);
    const rows = page.match(/<td data-label="التغيير">/g) ?? [];
    expect(rows).toHaveLength(3 + 3 + 3 + 3 + 1);
  });

  it('marks every hand computed change as matching the engine', () => {
    expect(page).not.toContain('✕ غير مطابق');
  });

  it('writes the founder value, the suggested one, the relative change and the result', () => {
    const text = plainOf(page).replace(/<[^>]*>/g, '');
    expect(text).toContain('تكاليف التأسيس (F5): من 9,000 د.أ إلى 6,000 د.أ');
    expect(text).toContain(
      'التكاليف الثابتة الكاملة (F4 مع رواتب من بدأ وF4.1): تُضرب في 0.738 (73.8% من قيمتها)',
    );
    expect(text).toContain('التكلفة المتغيرة (F3): تخفيض 37.5%');
    expect(text).toContain('سعر البيع (F1): زيادة 7.09%');
    expect(text).toContain('الجهد (مجموع النسبتين): 42%');
    expect(text).toContain('الدرجة 9 من 10 = 90%');
    expect(text).toContain('يبلغ خط «امضِ»');
  });

  it('says that a price above the market is a premium and needs a measurable difference', () => {
    const text = plainOf(page);
    // The subscription price 38.5, the shop price 46 and the negative margin price 14.5.
    expect(text.match(/سعر مميَّز \(Premium\): أعلى من أعلى سعر منافس معروف/g)).toHaveLength(3);
    expect(text.match(/يحتاج فرقًا في العرض يمكن قياسه \(القاعدة R5\)/g)).toHaveLength(3);
    expect(text).toContain('أعلى من أعلى سعر منافس معروف (35 د.أ)');
    expect(text).toContain('أعلى من أعلى سعر منافس معروف (45 د.أ)');
    expect(text).toContain('أعلى من أعلى سعر منافس معروف (14 د.أ)');
  });

  it('lists the levers to rethink when fewer than three changes work', () => {
    const text = plainOf(page);
    expect(text).toContain('لم يكفِ أي تغيير في الأرقام لملء الأماكن الثلاثة');
    expect(text).toContain(
      'سعر البيع (F1): الترتيب 1 في الحساسية، وتأرجح ربح السنة الأولى 19,200 د.أ',
    );
    expect(text).toContain(
      'المبيعات المتوقعة (F6): الترتيب 2 في الحساسية، وتأرجح ربح السنة الأولى 11,520 د.أ',
    );
    expect(text.match(/لم يكفِ أي تغيير/g)).toHaveLength(1);
  });

  it('says how many times the search ran, and that it finished', () => {
    const text = plainOf(page);
    expect(text.match(/شغّل البحث المحرّك \d+ مرة، واكتمل داخل ميزانيته/g)).toHaveLength(5);
    expect(text).not.toContain('وانتهت ميزانيته');
  });

  it('explains the search in the section on how to read the page', () => {
    const text = plainOf(page);
    expect(text).toContain('يبحث المحرّك في خمسة أرقام للمؤسس');
    expect(text).toContain('المبيعات تُجرَّب خطوة خطوة بنسبة 5%');
  });

  it('marks a change whose hand computation differs from the engine', () => {
    const [shop] = entries.slice(1);
    if (shop === undefined) throw new Error('no entry');
    const decision = shop.project.decision;
    const wrong: ReviewEntry = {
      ...shop,
      project: {
        ...shop.project,
        decision: {
          ...decision,
          changes: decision.changes.map((row, index) =>
            index === 0 ? { ...row, passed: 1 } : row,
          ),
        },
      },
    };
    const broken = renderReviewPage([wrong]);
    expect(broken.match(/✕ غير مطابق/g)).toHaveLength(1);
    // A change with no hand row shows a dash and does not match.
    const bare: ReviewEntry = {
      ...shop,
      project: { ...shop.project, decision: { ...decision, changes: [] } },
    };
    const bareText = renderReviewPage([bare]);
    expect(bareText.match(/✕ غير مطابق/g)).toHaveLength(4);
  });

  it('says what a low confidence does: a stop only loses its blocker, and neither has a way to go', () => {
    const stopCase = cases.find((entry) => entry.project.name === 'case-negative-margin');
    const reviseCase = cases.find((entry) => entry.project.name === 'case-borderline');
    if (stopCase === undefined || reviseCase === undefined) throw new Error('no case');
    const low = flatProvenance({ F1: 'low', F3: 'low', F5: 'low' });
    const lowRun = (entry: ReviewEntry): ReviewEntry => {
      const run = runGolden({ ...entry.project, provenance: low });
      return { ...entry, run, changes: suggestChanges(run, entry.project.tax) };
    };
    const stopped = plainOf(renderReviewPage([], [lowRun(stopCase)]));
    expect(stopped).toContain('يزيل الحاجب ولا يبلغ خط «امضِ»');
    expect(stopped).toContain('الثقة الإجمالية منخفضة، وهي تأتي من جودة الإجابات لا من قيمها');
    const revised = plainOf(renderReviewPage([], [lowRun(reviseCase)]));
    expect(revised).toContain('الثقة الإجمالية منخفضة، وهي تأتي من جودة الإجابات لا من قيمها');
    expect(revised).not.toContain('الدرجة 8 من 10');
  });

  it('says when the budget of the search ran out', () => {
    const stopCase = cases.find((entry) => entry.project.name === 'case-negative-margin');
    if (stopCase === undefined) throw new Error('no case');
    const short: ReviewEntry = {
      ...stopCase,
      changes: suggestChanges(stopCase.run, stopCase.project.tax, {
        changeSearchBudget: defaultFigure('test', 5),
      }),
    };
    const text = plainOf(renderReviewPage([], [short]));
    expect(text).toContain('شغّل البحث المحرّك 5 مرة، وانتهت ميزانيته قبل أن يكتمل');
  });

  it('shows a score of nothing evaluated and a stop without a market ceiling', () => {
    const stopCase = cases.find((entry) => entry.project.name === 'case-negative-margin');
    if (stopCase === undefined) throw new Error('no case');
    const [change] = stopCase.changes.changes;
    if (change === undefined) throw new Error('no change');
    const entry: ReviewEntry = {
      ...stopCase,
      changes: {
        ...stopCase.changes,
        marketCeiling: null,
        changes: [{ ...change, premium: true, outcome: { ...change.outcome, score: null } }],
      },
    };
    const text = plainOf(renderReviewPage([], [entry]));
    expect(text).toContain('لا درجة: لا معيار مقيَّم');
    expect(text).not.toContain('سعر مميَّز (Premium)');
  });
});
