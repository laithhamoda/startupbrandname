import { describe, expect, it } from 'vitest';
import type { Alert } from './alerts';
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
  goldenReviewEntries,
  h,
  monthsPhrase,
  renderReviewPage,
  type ReviewEntry,
} from './review-page';
import type { TaxAlert } from './tax';

/** The page without its number isolation, to look for words that hold digits. */
const plainOf = (html: string): string => html.replace(/<\/?bdi[^>]*>/g, '');

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
    expect(said.H5).toBe('خلال 12 شهرًا');
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

  it('lists the 19 questions in a fixed order with their IDs in the labels', () => {
    const [project] = GOLDEN_PROJECTS;
    if (project === undefined) throw new Error('no project');
    const all = describeAnswers(project);
    expect(all).toHaveLength(19);
    expect(all[0]).toMatchObject({ id: 'F1', label: 'سعر البيع للوحدة (F1)' });
    expect(all.at(-1)).toMatchObject({ id: 'H5' });
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
    const text = page
      .replace(/<style>[\s\S]*<\/style>/, '')
      .replace(/<code>[\s\S]*?<\/code>/g, '')
      .replace(/<bdi dir="ltr">[^<]*<\/bdi>/g, '')
      .replace(/<[^>]*>/g, '');
    expect(text).not.toMatch(/\d/);
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
    const text = renderReviewPage([{ project: { ...shop.project, rows: [] }, run, variants: [] }]);
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
