import { describe, expect, it } from 'vitest';
import { ar, en } from '../messages';
import { drop, goldenProject, goldenReportInput } from '../testing/report-inputs';
import { modelOf, sectionOf, tablesOf } from '../testing/model-helpers';
import { modelText } from '../testing/model-text';
import { buildReportModel } from './build';
import { inlineText } from './inline';
import { ReportModelError, type Block } from './types';

const answered = (value: unknown) => ({ status: 'answered' as const, value });
const money = (amount: number, currency = 'JOD') => ({ amount, currency });

const textOf = (blocks: readonly Block[]): string =>
  modelText({
    version: 1,
    locale: 'ar',
    kind: 'full',
    lockReason: null,
    audience: 'self',
    meta: {
      title: '',
      countryCode: '',
      currencyLabel: '',
      issuedOn: '',
      engineVersion: null,
      inputHash: null,
      completeness: { percent: 0, gate: 'full' },
      confidence: null,
    },
    sections: [{ id: 'cover', title: '', locked: false, blocks }],
  });

describe('a margin that is not positive', () => {
  const change = (a: Record<string, unknown>) => {
    a.F1 = answered(money(5));
  };

  it('stops the project and says why in every place it matters', () => {
    const model = modelOf('jo-service-subscription', 'ar', { change });
    const text = modelText(model);
    expect(text).toContain('VERDICT توقّف');
    expect(text).toContain(
      inlineText(
        ar.risks.blockers.margin_not_positive({
          margin: [{ n: '−1.000' }, ' د.أ'],
          window: [],
          need: [],
          capital: [],
          multiple: [],
        }),
      ),
    );
    expect(textOf(sectionOf(model, 'pricing_unit_economics').blocks)).toContain('ليس موجبًا');
    const keyNumbers = sectionOf(model, 'executive_summary').blocks.find(
      (block) => block.type === 'keyNumbers',
    );
    expect(JSON.stringify(keyNumbers)).toContain(ar.executive.keyNumbers.breakEvenNone);
  });

  it('tells the summary reader there is no break-even', () => {
    const model = modelOf('jo-service-subscription', 'en', { change, kind: 'summary' });
    expect(textOf(sectionOf(model, 'break_even').blocks)).toContain('There is no Break-even');
  });
});

describe('a break-even the horizon never reaches', () => {
  const change = (a: Record<string, unknown>) => {
    a.F1 = answered(money(7));
  };

  it('says there is no break-even in the report and in the summary', () => {
    const full = modelOf('jo-service-subscription', 'ar', { change });
    expect(modelText(full)).toContain('لا تعادل خلال 36 شهرًا');
    const summary = modelOf('jo-service-subscription', 'ar', { change, kind: 'summary' });
    expect(textOf(sectionOf(summary, 'break_even').blocks)).toContain('لا يبلغ المشروع');
  });
});

describe('answers the engine cannot calculate yet', () => {
  const reasons = [
    { code: 'missing_answer', questionId: 'F3' },
    { code: 'unknown_answer', questionId: 'F4' },
    { code: 'currency_mismatch', questionId: 'F5', currency: 'USD' },
    { code: 'invalid_value', questionId: 'F6' },
    { code: 'no_price', questionId: null },
    { code: 'invalid_project', questionId: null },
  ] as const;

  it('builds a summary with no run: the card shows, the risks are the pivotal answers, the estimate waits', () => {
    const model = modelOf('jo-service-subscription', 'ar', {
      kind: 'summary',
      withoutRun: reasons,
      change: (a) => {
        delete a.F3;
        a.F4 = { status: 'unknown' };
        a.F6 = { status: 'answered', value: { month1: 1, month6: 2, month12: 3 } };
      },
    });
    expect(model.meta.engineVersion).toBeNull();
    expect(model.meta.confidence).toBeNull();
    expect(sectionOf(model, 'project_card').blocks[0]?.type).toBe('definitionList');
    const risks = sectionOf(model, 'top_risks').blocks[0];
    expect(risks?.type).toBe('list');
    const riskText = textOf(sectionOf(model, 'top_risks').blocks);
    expect(riskText).toContain('لم تُجب بعد عن التكلفة المتغيرة للوحدة');
    expect(riskText).toContain('لم تُجب بعد عن التكاليف الثابتة');
    const estimate = textOf(sectionOf(model, 'break_even').blocks);
    expect(estimate).toContain(
      inlineText(ar.breakEven.notEnough({ term: ['نقطة التعادل (Break-even)'] })),
    );
    expect(estimate).toContain('ينقص: التكلفة المتغيرة للوحدة');
    expect(estimate).toContain('أجبتَ «لا أعرف» عن: التكاليف الثابتة');
    expect(estimate).toContain('عملة تكاليف التأسيس (USD)');
    expect(estimate).toContain('قيمة توقّعات المبيعات غير صالحة');
    expect(estimate).toContain(
      ar.notCalculable.no_price({ question: [], item: [], currency: [] })[0],
    );
    expect(estimate).toContain(
      ar.notCalculable.invalid_project({ question: [], item: [], currency: [] })[0],
    );
  });

  it('falls back to the missing pivotal answers when the engine gave no reason', () => {
    const model = modelOf('jo-service-subscription', 'en', {
      kind: 'summary',
      withoutRun: [],
      change: (a, p) => {
        delete a.F5;
        delete a.H6;
        p.F1 = { source: 'user', confidence: 'low', validated: false };
      },
    });
    const estimate = textOf(sectionOf(model, 'break_even').blocks);
    expect(estimate).toContain('the set-up costs');
    const risks = textOf(sectionOf(model, 'top_risks').blocks);
    expect(risks).toContain('You have not answered about the set-up costs yet');
    expect(risks).toContain('the selling price is an unconfirmed assumption');
    expect(risks).not.toContain('Your own worry');
  });

  it('says there is no major risk when nothing is missing and nothing is a guess', () => {
    const model = modelOf('jo-service-subscription', 'ar', {
      kind: 'summary',
      withoutRun: [],
      change: (a) => {
        delete a.H6;
      },
    });
    expect(textOf(sectionOf(model, 'top_risks').blocks)).toContain(ar.risks.none);
  });

  it('shows the founder’s worry as the last fallback', () => {
    const model = modelOf('jo-service-subscription', 'ar', { kind: 'summary', withoutRun: [] });
    expect(textOf(sectionOf(model, 'top_risks').blocks)).toContain('هل سيقبل العملاء');
  });
});

describe('a missing answer in a calculable run', () => {
  it('leaves the cash flow uncalculated when the set-up costs are missing', () => {
    const model = modelOf('jo-service-subscription', 'ar', {
      change: (a, p) => {
        delete a.F5;
        delete p.F5;
      },
    });
    const projection = textOf(sectionOf(model, 'projection').blocks);
    expect(projection).toContain(ar.projection.cashNotCalculated);
    expect(projection).not.toContain('صافي النقد');
    const legal = textOf(sectionOf(model, 'legal_path_financing').blocks);
    expect(legal).toContain(ar.legal.fundingNotCalculated);
    const key = sectionOf(model, 'executive_summary').blocks.find(
      (block) => block.type === 'keyNumbers',
    );
    expect(JSON.stringify(key)).toContain(ar.executive.keyNumbers.fundingNeedNone);
    // The pivotal figure is missing, so it is a risk and counts against the confidence.
    expect(modelText(model)).toContain('لم تُجب بعد عن تكاليف التأسيس');
  });

  it('explains the subscription measures that cannot be calculated, and a missing market', () => {
    const model = modelOf('jo-service-subscription', 'ar', {
      change: (a) => {
        delete a['F2.1'];
        delete a.D4;
      },
    });
    const pricing = textOf(sectionOf(model, 'pricing_unit_economics').blocks);
    expect(pricing).toContain(ar.pricing.subscriptionGaps.churn_unset);
    expect(pricing).toContain(ar.pricing.marketGaps.no_competitor_prices);
  });

  it('compares the break-even units with the capacity the founder gave', () => {
    const above = modelOf('jo-service-subscription', 'ar', {
      change: (a) => {
        a.E7 = answered(100);
      },
    });
    expect(textOf(sectionOf(above, 'pricing_unit_economics').blocks)).toContain(
      'أكثر من طاقتك القصوى',
    );
    const within = modelOf('jo-service-subscription', 'en', {
      change: (a) => {
        a.E7 = answered(1000);
      },
    });
    expect(textOf(sectionOf(within, 'pricing_unit_economics').blocks)).toContain(
      'are within your maximum',
    );
  });

  it('leaves the validation plan without a worry when the founder named none', () => {
    const model = modelOf('jo-service-subscription', 'ar', {
      change: (a) => {
        delete a.H6;
      },
    });
    const callouts = sectionOf(model, 'validation_plan').blocks.filter(
      (block) => block.type === 'callout' && block.tone === 'worry',
    );
    expect(callouts).toHaveLength(0);
    const lists = sectionOf(model, 'validation_plan').blocks.filter(
      (block) => block.type === 'definitionList',
    );
    expect(lists).toHaveLength(3);
  });

  it('ranks the other assumptions when their confidence is low', () => {
    const model = modelOf('dz-auto-entrepreneur', 'en', {
      change: (_a, p) => {
        p.F3 = { source: 'user', confidence: 'low', validated: false };
        p.F6 = { source: 'user', confidence: 'low', validated: false };
        p.F4 = { source: 'user', confidence: 'low', validated: false };
      },
    });
    const text = textOf(sectionOf(model, 'validation_plan').blocks);
    expect(text).toContain('Your variable cost per unit');
  });
});

describe('the project card', () => {
  it('writes an amount in another currency with its own code, never the project label', () => {
    const model = modelOf('jo-service-subscription', 'ar', {
      change: (a) => {
        a.A5 = answered({ min: 1000, max: 5000, currency: 'USD' });
      },
    });
    const card = JSON.stringify(sectionOf(model, 'project_card').blocks);
    expect(card).toContain('{"l":"USD"}');
    expect(card).not.toContain('5,000.000');
  });

  it('keeps markup in the founder’s title and words as plain text', () => {
    const title = '<b onclick="x()">Cafe & <script>alert(1)</script></b>';
    const input = goldenReportInput('jo-service-subscription', {
      locale: 'en',
      change: (a) => {
        a.B1 = answered(title);
      },
    });
    const model = buildReportModel({ ...input, project: { ...input.project, title } });
    const text = JSON.stringify(model);
    expect(text).toContain(JSON.stringify(title).slice(1, -1));
    const card = sectionOf(model, 'project_card').blocks[0];
    const idea =
      card?.type === 'definitionList'
        ? card.items.find((item) => inlineText(item.term) === en.card.rows.idea)
        : undefined;
    expect(idea?.definition.text).toEqual([title]);
    const cover = sectionOf(model, 'cover').blocks[1];
    const project =
      cover?.type === 'definitionList'
        ? cover.items.find((item) => inlineText(item.term) === en.cover.facts.project)
        : undefined;
    expect(project?.definition.text).toEqual([title]);
  });

  it('says so when no identifying question is answered', () => {
    const model = modelOf('jo-service-subscription', 'ar', {
      kind: 'summary',
      change: (a) => {
        drop(a, 'A1', 'A4', 'A5', 'A8', 'B1', 'B7', 'C1', 'D2', 'E6', 'F1', 'F2');
        a.F1 = { status: 'unknown' };
      },
      withoutRun: [],
    });
    expect(textOf(sectionOf(model, 'project_card').blocks)).toContain(ar.card.empty);
  });

  it('writes the place with the country alone when no city was given', () => {
    const model = modelOf('jo-service-subscription', 'en', {
      change: (a) => {
        a.A1 = answered({ country: 'JO', city: ' ' });
      },
    });
    expect(textOf(sectionOf(model, 'project_card').blocks)).toContain('Location: Jordan');
  });
});

describe('the legal path and the sources', () => {
  it('shows a no-pack note for a country the pack does not cover', () => {
    const input = goldenReportInput('jo-service-subscription', { locale: 'ar' });
    const model = buildReportModel({ ...input, project: { ...input.project, countryCode: 'DE' } });
    const legal = sectionOf(model, 'legal_path_financing').blocks;
    expect(legal[0]).toMatchObject({ type: 'callout', tone: 'verify' });
    expect(textOf(legal)).toContain('ألمانيا');
    expect(textOf(legal)).toContain(ar.legal.noOfficialLink);
    expect(textOf(sectionOf(model, 'appendix_sources').blocks)).toContain(ar.appendix.sourcesNone);
  });

  it('shows the steps of the pack with the label on the old and the unverified ones', () => {
    const model = modelOf('jo-service-subscription', 'ar');
    const guide = sectionOf(model, 'legal_path_financing').blocks[0];
    expect(guide?.type).toBe('definitionList');
    const items = guide?.type === 'definitionList' ? guide.items : [];
    const byName = new Map(items.map((item) => [inlineText(item.term), item]));
    expect(byName.get('تسجيل مؤسسة فردية')?.label).toBeNull();
    // The company item was verified more than ninety days before the report (rule 8).
    expect(byName.get('تسجيل شركة')?.label).toEqual({
      code: 'verify_official_source',
      text: 'تحقّق من المصدر الرسمي',
    });
    expect(byName.get('تسجيل شركة')?.tag).toBe(ar.legal.roles.comparison);
    expect(byName.get('التسجيل الضريبي')?.label?.code).toBe('verify_official_source');
    expect(byName.get('التسجيل الضريبي')?.definition.provenance).toEqual({
      source: 'external',
      confidence: 'low',
      validated: true,
    });
    expect(byName.get('تسجيل مؤسسة فردية')?.url).toBe(
      'https://example.invalid/jo/registration-sole-body',
    );
  });

  it('lists the sources used with their dates and labels, and the tax authority link', () => {
    const model = modelOf('jo-service-subscription', 'en');
    const sources = tablesOf(sectionOf(model, 'appendix_sources').blocks)[0];
    expect(sources?.rows.map((row) => inlineText(row.head ?? []))).toEqual([
      'Sole proprietorship registration',
      'Company registration',
      'Chamber membership',
      'Tax registration',
      'Income and Sales Tax Department',
    ]);
    const text = textOf(sectionOf(model, 'appendix_sources').blocks);
    expect(text).toContain('Never verified');
    expect(text).toContain('2026-01-01');
    expect(text).toContain('Check the official source');
  });

  it('shows the Algerian steps, the ceiling figure and a tax authority without a link', () => {
    const model = modelOf('dz-auto-entrepreneur', 'ar');
    const legal = sectionOf(model, 'legal_path_financing').blocks;
    const text = textOf(legal);
    expect(text).toContain('مسار المقاول الذاتي');
    expect(text).toContain('5,000,000 DA');
    expect(text).toContain(ar.legal.noOfficialLink);
    expect(legal.some((block) => block.type === 'link')).toBe(false);
    // The tax authority item exists but holds no link, so it is not a source either.
    expect(tablesOf(sectionOf(model, 'appendix_sources').blocks)[0]?.rows.length).toBeGreaterThan(
      0,
    );
  });

  it('never uses the word «فائدة» in the financing text when the founder prefers Sharia-compliant finance', () => {
    const model = modelOf('jo-home-ecommerce', 'ar');
    const financing = sectionOf(model, 'legal_path_financing').blocks.at(-1);
    expect(financing).toMatchObject({ type: 'list', title: [ar.legal.financingTitle] });
    const text = JSON.stringify(financing);
    expect(text).not.toContain('فائدة');
    expect(text).toContain(ar.legal.shariaYes);
    const other = modelOf('jo-service-subscription', 'ar');
    expect(JSON.stringify(sectionOf(other, 'legal_path_financing').blocks.at(-1))).not.toContain(
      ar.legal.shariaYes,
    );
  });

  it('compares the funding need with the capital in each of its cases', () => {
    const within = modelOf('jo-service-subscription', 'en', {
      change: (a) => {
        a.A5 = answered({ min: 8000, max: 40000, currency: 'JOD' });
      },
    });
    expect(textOf(sectionOf(within, 'legal_path_financing').blocks)).toContain(
      'does not exceed the largest capital',
    );
    const none = modelOf('jo-service-subscription', 'en', {
      change: (a) => {
        delete a.A5;
      },
    });
    expect(textOf(sectionOf(none, 'legal_path_financing').blocks)).toContain(
      'you gave no available capital',
    );
    const noOutside = modelOf('jo-service-subscription', 'en', {
      change: (a) => {
        a.H3 = answered({ values: ['self'] });
      },
    });
    expect(textOf(sectionOf(noOutside, 'legal_path_financing').blocks)).toContain(
      en.legal.noOutsideSources,
    );
  });
});

describe('the tax', () => {
  const project = goldenProject('jo-service-subscription');

  it('shows the tax line, the reason and the adviser line when the tax was not calculated', () => {
    const model = modelOf('jo-service-subscription', 'ar', { tax: { rules: [] } });
    const projection = sectionOf(model, 'projection').blocks;
    const notice = projection.find((block) => block.type === 'callout' && block.tone === 'tax');
    expect(inlineText(notice?.type === 'callout' ? notice.text : [])).toContain(
      ar.projection.taxNotIncluded,
    );
    expect(inlineText(notice?.type === 'callout' ? notice.text : [])).toContain(
      ar.taxGaps.no_rule({ regimes: [], currency: [] })[0],
    );
    expect(projection.some((block) => block.type === 'callout' && block.tone === 'adviser')).toBe(
      true,
    );
    expect(projection.some((block) => block.type === 'link')).toBe(true);
    const legal = sectionOf(model, 'legal_path_financing').blocks;
    expect(legal.filter((block) => block.type === 'callout' && block.tone === 'tax')).toHaveLength(
      1,
    );
    expect(legal.some((block) => block.type === 'callout' && block.tone === 'adviser')).toBe(true);
    expect(JSON.stringify(sectionOf(model, 'executive_summary').blocks)).toContain(
      ar.executive.beforeTax,
    );
    expect(tablesOf(projection)[0]?.rows.at(-1)?.head).toEqual([
      ar.projection.rows.cumulativeCashBeforeTax,
    ]);
  });

  it('names the regimes when more than one applies, and the currency of a rule in another currency', () => {
    const rule = project.tax.rules[0];
    if (rule === undefined) throw new Error('the project has a tax rule');
    const ambiguous = modelOf('jo-service-subscription', 'en', {
      tax: {
        rules: [
          { ...rule, id: 'a', regime: 'regime_a' },
          { ...rule, id: 'b', regime: 'regime_b' },
        ],
      },
      change: (a) => {
        a.G1 = answered('sole');
      },
    });
    expect(textOf(sectionOf(ambiguous, 'projection').blocks)).toContain('regime_a, regime_b');
    const foreign = modelOf('jo-service-subscription', 'en', {
      tax: { rules: [{ ...rule, currency: 'USD' }] },
      change: (a) => {
        a.G1 = answered('sole');
      },
    });
    expect(textOf(sectionOf(foreign, 'projection').blocks)).toContain('in another currency (USD)');
  });

  it('shows the calculated tax per year when there is a rule', () => {
    const model = modelOf('jo-service-subscription', 'en');
    const legal = sectionOf(model, 'legal_path_financing').blocks;
    expect(tablesOf(legal)[0]?.rows).toHaveLength(3);
    expect(textOf(legal)).toContain('under the “');
  });

  it('reports a turnover above the regime ceiling as a risk in the executive summary', () => {
    const model = modelOf('dz-auto-entrepreneur', 'en');
    expect(textOf(sectionOf(model, 'executive_summary').blocks)).toContain(
      'exceeds the ceiling of the',
    );
  });
});

describe('a model that cannot be built', () => {
  const input = goldenReportInput('jo-service-subscription', { locale: 'ar' });
  const codeOf = (build: () => unknown): string | null => {
    try {
      build();
      return null;
    } catch (error) {
      return error instanceof ReportModelError ? error.code : 'other';
    }
  };

  it('refuses the full report without a run, with a lock reason, with a bad date or a wrong currency', () => {
    expect(codeOf(() => buildReportModel({ ...input, run: null }))).toBe('run_required');
    expect(codeOf(() => buildReportModel({ ...input, lockReason: 'plan' }))).toBe(
      'lock_reason_unexpected',
    );
    expect(codeOf(() => buildReportModel({ ...input, today: '12/10/2026' }))).toBe('invalid_date');
    expect(
      codeOf(() => buildReportModel({ ...input, project: { ...input.project, currency: 'USD' } })),
    ).toBe('currency_mismatch');
  });

  it('refuses a summary that does not say why it is locked', () => {
    expect(codeOf(() => buildReportModel({ ...input, kind: 'summary', lockReason: null }))).toBe(
      'lock_reason_required',
    );
  });

  it('carries its code and name', () => {
    const error = new ReportModelError('run_required', 'x');
    expect(error).toMatchObject({ name: 'ReportModelError', code: 'run_required', message: 'x' });
  });
});
