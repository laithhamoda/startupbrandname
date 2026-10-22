import { describe, expect, it } from 'vitest';
import { messagesFor } from '../messages';
import { buildReportModel } from '../model/build';
import { inlineText } from '../model/inline';
import type { Block, ReportModel } from '../model/types';
import { HOSTILE_TEXT } from '../fixtures/spike';
import { LOCALES, NAMES, modelOf, sectionOf } from '../testing/model-helpers';
import { goldenReportInput } from '../testing/report-inputs';
import { PRINT_CSP_META } from './csp';
import { buildReportDocument, reportBodyHtml, reportTitle } from './report';

// A stand-in for the font data keeps these tests fast; the fonts have their own tests.
const options = { fontCss: '/* fonts */' };

const answered = (value: unknown) => ({ status: 'answered' as const, value });

interface Case {
  readonly label: string;
  readonly model: ReportModel;
}

/** Every golden model, both languages, and the two kinds of summary. */
const CASES: readonly Case[] = [
  ...NAMES.flatMap((name) =>
    LOCALES.map((locale) => ({ label: `${name} ${locale}`, model: modelOf(name, locale) })),
  ),
  {
    label: 'summary locked by the plan',
    model: modelOf('jo-service-subscription', 'ar', { kind: 'summary', lockReason: 'plan' }),
  },
  {
    label: 'summary of a stop',
    model: modelOf('dz-auto-entrepreneur', 'en', { kind: 'summary', lockReason: 'completeness' }),
  },
];

const blocksOf = (model: ReportModel): Block[] =>
  model.sections.flatMap((section) => (section.locked ? [] : [...section.blocks]));

describe('the print document of a report', () => {
  for (const { label, model } of CASES) {
    describe(label, () => {
      it('sets the language and direction, and carries the policy tag', async () => {
        const html = await buildReportDocument(model, options);
        const direction = model.locale === 'ar' ? 'rtl' : 'ltr';
        expect(html).toContain(`<html lang="${model.locale}" dir="${direction}">`);
        expect(html).toContain(PRINT_CSP_META);
      });

      it('has no script, no frame, no image and no remote resource', async () => {
        const html = await buildReportDocument(model, options);
        expect(html).not.toMatch(/<(script|img|link|iframe|object|embed|base|form|video|audio)\b/i);
        expect(html).not.toMatch(/@import|url\(\s*['"]?https?:/i);
        expect(html).not.toMatch(/\ssrc\s*=/i);
        expect(html).not.toMatch(/<[a-z][^>]*\son[a-z]+\s*=/i);
        // The only address in an attribute is an https link: the sources of the legal path.
        const hrefs = [...html.matchAll(/\shref="([^"]*)"/g)].map((match) => match[1] ?? '');
        for (const href of hrefs) expect(href).toMatch(/^https:\/\//);
      });

      it('writes the title of the document as the project title and nothing else', async () => {
        const html = await buildReportDocument(model, options);
        expect(html).toContain(`<title>${model.meta.title}</title>`);
        expect(reportTitle(model)).toBe(model.meta.title);
      });

      it('draws every section in the order of the model, the cover first and alone', () => {
        const html = reportBodyHtml(model);
        expect(html.startsWith('<section class="cover-sec">')).toBe(true);
        const ids = [...html.matchAll(/<section class="sec[^"]*" id="s-([a-z_]+)"/g)].map(
          (match) => match[1],
        );
        expect(ids).toEqual(
          model.sections.filter((section) => section.id !== 'cover').map((section) => section.id),
        );
      });
    });
  }

  it('draws every block type of the model', () => {
    const types = new Set(CASES.flatMap(({ model }) => blocksOf(model).map((block) => block.type)));
    expect([...types].sort()).toEqual(
      [
        'callout',
        'canvas',
        'definitionList',
        'keyNumbers',
        'link',
        'list',
        'note',
        'paragraph',
        'table',
        'verdict',
      ].sort(),
    );
    const html = CASES.map(({ model }) => reportBodyHtml(model)).join('');
    for (const marker of [
      '<p>',
      'class="note"',
      'class="points"',
      'class="kpis"',
      'class="slab"',
      'class="tbl',
      'class="defs"',
      'class="board"',
      'class="taxbox"',
      'class="link"',
      'class="exp"',
    ]) {
      expect(html, marker).toContain(marker);
    }
  });

  it('puts a numeric part in a bidi isolate and a left-to-right part in a fixed one', () => {
    const model = modelOf('jo-service-subscription', 'ar');
    const html = reportBodyHtml(model);
    expect(html).toContain('<bdi>6</bdi>');
    expect(html).toContain('<bdi dir="ltr">JOD</bdi>');
  });

  it('puts the verdict in a black slab with the meter and the line of Go', () => {
    const html = reportBodyHtml(modelOf('jo-service-subscription', 'ar'));
    expect(html).toContain('<div class="slab" data-verdict="revise">');
    expect(html).toContain('<div class="verdict">عدّل</div>');
    expect(html).toMatch(/<div class="meter" role="img" aria-label="[^"]+">/);
    expect(html.match(/<i class="on"><\/i>/g)).toHaveLength(6);
    expect(html).toContain('style="inset-inline-start:75%"');
  });

  it('starts the sections where the mock starts them, and sets the projection on the wide page', () => {
    const html = reportBodyHtml(modelOf('jo-service-subscription', 'en'));
    const classes = new Map(
      [...html.matchAll(/<section class="(sec[^"]*)" id="s-([a-z_]+)"/g)].map(
        (match) => [match[2], match[1]] as const,
      ),
    );
    expect(classes.get('executive_summary')).toBe('sec newpage');
    expect(classes.get('projection')).toBe('sec newpage wide');
    expect(classes.get('canvases')).toBe('sec newpage wide');
    expect(classes.get('validation_plan')).toBe('sec newpage');
    expect(classes.get('project_card')).toBe('sec');
    expect(classes.get('pricing_unit_economics')).toBe('sec');
  });

  it('marks the break-even column and the lowest cash, and the lines that explain them', () => {
    for (const locale of LOCALES) {
      const html = reportBodyHtml(modelOf('jo-service-subscription', locale));
      expect(html).toContain('<th scope="col" class="num be">');
      expect(html).toContain('class="num low"');
      expect(html).toContain('class="note legend low"');
      expect(html).toContain('class="note legend be"');
      expect(html.match(/class="note legend low"/g)).toHaveLength(1);
      expect(html.match(/class="note legend be"/g)).toHaveLength(1);
    }
  });

  it('marks a figure of low confidence with an asterisk, and the legend of the model once', () => {
    const assumed = { source: 'assumption', confidence: 'low', validated: false };
    const model = modelOf('jo-service-subscription', 'en', {
      change: (_answers, provenance) => {
        provenance.F4 = assumed;
        provenance.F5 = assumed;
      },
    });
    const html = reportBodyHtml(model);
    const cells = JSON.stringify(model).match(/"lowConfidence":true/g)?.length ?? 0;
    expect(cells).toBeGreaterThan(0);
    expect(html.match(/<sup class="lc">\*<\/sup>/g)?.length ?? 0).toBeGreaterThanOrEqual(cells);
    expect(html).toContain('class="callout lcnote"');
    // Each section that holds such a figure carries the sentence once, in a callout.
    expect(html.split(messagesFor('en').lowConfidence).length - 1).toBe(
      html.match(/class="callout lcnote"/g)?.length,
    );
  });

  it('draws the validation plan as experiments with a strip to fill in under each', () => {
    for (const locale of LOCALES) {
      const model = modelOf('jo-service-subscription', locale);
      const plan = sectionOf(model, 'validation_plan');
      const experiments = plan.blocks.filter((block) => block.type === 'definitionList').length;
      expect(experiments).toBe(3);
      const html = reportBodyHtml(model);
      expect(html.match(/<div class="exp">/g)).toHaveLength(experiments);
      expect(html.match(/<div class="fills">/g)).toHaveLength(experiments);
      const words = messagesFor(locale).print.fill;
      for (const word of Object.values(words)) {
        expect(html.split(`>${word}<`).length - 1, word).toBeGreaterThanOrEqual(experiments);
      }
      expect(html.match(/<span class="box"><\/span>/g)).toHaveLength(experiments * 3);
      // The worry is the founder's words in a quote, inside the first experiment.
      expect(html).toMatch(/<div class="exp">[\s\S]*?<blockquote class="user-text plain">/);
    }
  });

  it('draws the canvases as boards that read left to right, with their words in the page direction', () => {
    const html = reportBodyHtml(modelOf('jo-service-subscription', 'ar'));
    expect(html.match(/<div class="board" dir="ltr">/g)).toHaveLength(2);
    expect(html).toContain('<section class="cvc cv-customerSegments" dir="rtl">');
    expect(html).toContain('cv-costStructure');
    expect(html).toContain('<dl><div><dt>');
    const english = reportBodyHtml(modelOf('jo-service-subscription', 'en'));
    expect(english).toContain('<section class="cvc cv-customerSegments" dir="ltr">');
  });

  it('shows the label «تحقّق من المصدر الرسمي» as the model gives it', () => {
    const model = modelOf('jo-service-subscription', 'ar');
    const html = reportBodyHtml(model);
    expect(html).toContain('<span class="chip">تحقّق من المصدر الرسمي</span>');
  });

  it('puts the tax line and the adviser line in a box', () => {
    const html = reportBodyHtml(modelOf('jo-service-subscription', 'en'));
    expect(html).toContain('<div class="taxbox" role="note">');
    expect(html).toContain(messagesFor('en').adviserLine);
  });

  describe('a summary', () => {
    const model = modelOf('jo-service-subscription', 'ar', { kind: 'summary', lockReason: 'plan' });
    const html = reportBodyHtml(model);

    it('prints the title of a locked section and one line, never what it holds', () => {
      const locked = model.sections.filter((section) => section.locked && section.id !== 'cover');
      expect(locked.length).toBeGreaterThan(5);
      for (const section of locked) {
        expect(html).toContain(`<section class="sec locked" id="s-${section.id}">`);
      }
      expect(html.match(/<p class="note">قسم مقفل في هذا الملخص\.<\/p>/g)).toHaveLength(
        locked.length,
      );
      expect(html).not.toContain('class="board"');
      expect(html).not.toContain('class="exp"');
      expect(html).not.toContain('class="tbl dense');
    });

    it('draws its cover from the metadata, with the day and the engine version only', () => {
      const cover = html.slice(0, html.indexOf('</section>'));
      expect(cover).toContain('<bdi>2026-10-12</bdi>');
      expect(cover).toContain(`<bdi>${model.meta.engineVersion ?? ''}</bdi>`);
      expect(cover.match(/<dt>/g)).toHaveLength(2);
      expect(cover).not.toContain('class="promise"');
    });
  });

  it('draws a summary without a run with a cover that holds the day only', () => {
    const input = goldenReportInput('jo-service-subscription', {
      locale: 'en',
      kind: 'summary',
      lockReason: 'completeness',
      withoutRun: [],
    });
    const model = buildReportModel({ ...input, run: null });
    expect(model.meta.engineVersion).toBeNull();
    const cover = reportBodyHtml(model).slice(0, reportBodyHtml(model).indexOf('</section>'));
    expect(cover.match(/<dt>/g)).toHaveLength(1);
  });
});

describe('a hostile project', () => {
  const input = goldenReportInput('jo-service-subscription', {
    locale: 'ar',
    change: (answers) => {
      answers.H6 = answered(HOSTILE_TEXT);
      answers.B1 = answered(HOSTILE_TEXT);
    },
  });

  for (const locale of LOCALES) {
    it(`comes out as plain text in the ${locale} report`, async () => {
      const model = buildReportModel({
        ...input,
        locale,
        project: { ...input.project, title: HOSTILE_TEXT },
      });
      const html = await buildReportDocument(model, options);
      expect(html).not.toMatch(/<(img|script)\b/i);
      expect(html).not.toMatch(/<[a-z][^>]*\sonerror\s*=/i);
      // The title, the worry and the idea are all on the page, escaped.
      expect(html).toContain('&lt;img src=&quot;http://example.invalid/x&quot; onerror=');
      expect(html).toContain('&lt;script&gt;');
      expect(html.match(/&lt;script&gt;/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(html).not.toContain('String.fromCharCode(80,87,78))</script>');
    });
  }
});

describe('the edges of the template', () => {
  const base = modelOf('jo-service-subscription', 'en');

  const withSection = (blocks: readonly Block[], locked = false): ReportModel => ({
    ...base,
    sections: [
      { id: 'cover', title: 'Cover', locked: true, blocks: [] },
      { id: 'project_card', title: 'Card', locked, blocks },
    ],
  });
  const html = (blocks: readonly Block[]): string => reportBodyHtml(withSection(blocks));
  const cell = (text: string, extra: { lowConfidence?: boolean } = {}) => ({
    text: [text],
    provenance: null,
    lowConfidence: false,
    mark: null,
    ...extra,
  });

  it('draws every tone of callout', () => {
    const out = html(
      (['low_confidence', 'tax', 'adviser', 'verify', 'worry', 'info'] as const).map((tone) => ({
        type: 'callout' as const,
        tone,
        text: [tone],
      })),
    );
    expect(out).toContain(
      '<p class="callout lcnote" role="note"><sup class="lc">*</sup> low_confidence</p>',
    );
    expect(out).toContain('<div class="taxbox" role="note">tax</div>');
    expect(out).toContain('<div class="taxbox" role="note">adviser</div>');
    expect(out).toContain('<p class="callout" role="note">verify</p>');
    expect(out).toContain('<blockquote class="user-text plain">worry</blockquote>');
    expect(out).toContain('<p class="callout" role="note">info</p>');
  });

  it('links only an https address, and shows every address as text', () => {
    const out = html([
      {
        type: 'link',
        label: ['Safe'],
        url: 'https://example.invalid/a?b=1&c="2"',
        labelCode: null,
        labelText: null,
      },
      {
        type: 'link',
        label: ['Script'],
        url: 'javascript:alert(1)',
        labelCode: null,
        labelText: 'Check',
      },
      {
        type: 'link',
        label: ['Plain'],
        url: 'http://example.invalid/x',
        labelCode: null,
        labelText: null,
      },
      { type: 'link', label: ['Broken'], url: 'not a url', labelCode: null, labelText: null },
    ]);
    expect(out).toContain('<a href="https://example.invalid/a?b=1&amp;c=%222%22">Safe</a>');
    expect(out).not.toContain('href="javascript');
    expect(out).not.toContain('href="http:');
    expect(out).toContain('<span class="chip">Check</span>');
    expect(out.match(/<a href=/g)).toHaveLength(2);
    expect(out).toContain('<bdi dir="ltr" class="url">javascript:alert(1)</bdi>');
  });

  it('draws a list, an ordered list, a definition with a tag, a label and an address', () => {
    const out = html([
      { type: 'list', title: ['Points'], ordered: false, items: [['one'], ['two']] },
      { type: 'list', title: null, ordered: true, items: [['first']] },
      {
        type: 'definitionList',
        title: null,
        items: [
          {
            term: ['Step'],
            definition: cell('Do it'),
            tag: 'Main',
            label: { code: 'verify_official_source', text: 'Check the source' },
            url: 'https://example.invalid/step',
          },
        ],
      },
    ]);
    expect(out).toContain('<h3>Points</h3><ul class="points"><li>one</li><li>two</li></ul>');
    expect(out).toContain('<ol class="points"><li>first</li></ol>');
    expect(out).toContain('<dt>Step<span class="chip">Main</span></dt>');
    expect(out).toContain('<span class="chip">Check the source</span>');
    expect(out).toContain('<a href="https://example.invalid/step">');
  });

  it('draws a table without a head column, a table with a total and a note under a row head', () => {
    const column = (header: string, extra = {}) => ({
      header: [header],
      align: 'start' as const,
      numeric: false,
      mark: null,
      ...extra,
    });
    const out = html([
      {
        type: 'table',
        caption: [],
        headHeader: null,
        columns: [column('A', { align: 'end' }), column('B', { align: 'center' })],
        rows: [{ head: null, note: null, cells: [cell('1'), cell('2', { lowConfidence: true })] }],
        total: null,
        numeric: false,
      },
      {
        type: 'table',
        caption: ['Caption'],
        headHeader: ['Item'],
        columns: [column('N', { numeric: true, align: 'end' })],
        rows: [{ head: ['Row'], note: ['why'], cells: [cell('3')] }],
        total: { head: ['Sum'], note: null, cells: [cell('3')] },
        numeric: true,
      },
    ]);
    expect(out).toContain(
      '<table class="tbl keep"><thead><tr><th scope="col" class="ta-end">A</th>',
    );
    expect(out).toContain('<th scope="col" class="hc">B</th>');
    expect(out).toContain('<td class="hc lcf">2<sup class="lc">*</sup></td>');
    expect(out).toContain('<caption>Caption</caption>');
    expect(out).toContain('<th scope="row">Row<span class="sub">why</span></th>');
    expect(out).toContain('<tr class="tot"><th scope="row">Sum</th>');
  });

  it('draws a verdict without a meter and a stop with its sentence', () => {
    const out = html([
      {
        type: 'verdict',
        code: 'stop',
        word: 'Stop',
        reason: ['Because'],
        stopSentence: 'Not viable in its current form',
        meter: null,
      },
    ]);
    expect(out).toContain('<p class="stop">Not viable in its current form</p>');
    expect(out).not.toContain('class="meter"');
  });

  it('keeps the position of a meter line inside the bar, whatever the model says', () => {
    const out = html([
      {
        type: 'verdict',
        code: 'go',
        word: 'Go',
        reason: [],
        stopSentence: null,
        meter: { passed: 3, evaluated: 4, linePercent: 250, caption: ['c'] },
      },
    ]);
    expect(out).toContain('style="inset-inline-start:100%"');
    expect(out.match(/<i class="on"><\/i>/g)).toHaveLength(3);
    const below = html([
      {
        type: 'verdict',
        code: 'go',
        word: 'Go',
        reason: [],
        stopSentence: null,
        meter: { passed: 0, evaluated: 1, linePercent: -5, caption: ['c'] },
      },
    ]);
    expect(below).toContain('style="inset-inline-start:0%"');
  });

  it('draws a canvas with a chip of low confidence, an empty block and a block without a place', () => {
    const out = html([
      {
        type: 'canvas',
        kind: 'lean',
        title: 'Canvas',
        blocks: [
          {
            id: 'problem',
            title: 'Problem',
            chips: [
              {
                key: 'k',
                questionId: 'B1',
                label: 'Label',
                text: 'Text\nmore',
                provenance: { source: 'user', confidence: 'low', validated: false },
                lowConfidence: true,
              },
              {
                key: 'k2',
                questionId: 'B1',
                label: null,
                text: 'Plain',
                provenance: { source: 'user', confidence: 'high', validated: true },
                lowConfidence: false,
              },
            ],
            empty: null,
            totals: [],
          },
          { id: 'solution', title: 'Solution', chips: [], empty: ['Not yet answered'], totals: [] },
          // Not one of the ids the board has a place for (never produced by the model).
          {
            id: 'unknown' as 'problem',
            title: 'Other',
            chips: [],
            empty: null,
            totals: [],
          },
        ],
      },
    ]);
    expect(out).toContain('<section class="cvc cv-problem" dir="ltr">');
    expect(out).toContain('<span class="clabel" dir="auto">Label</span>');
    expect(out).toContain('<span dir="auto">Text\nmore</span><sup class="lc">*</sup>');
    expect(out).toContain('<p class="empty">Not yet answered</p>');
    expect(out).toContain('<section class="cvc" dir="ltr"><h4>Other</h4></section>');
  });

  it('falls back to the kind of report when the project has no title', () => {
    const untitled: ReportModel = { ...base, meta: { ...base.meta, title: '  ' } };
    expect(reportTitle(untitled)).toBe(messagesFor('en').reportKind);
    expect(reportBodyHtml(untitled)).toContain(
      `<h1 dir="auto">${messagesFor('en').reportKind}</h1>`,
    );
  });

  it('draws nothing in a locked section but its title and the line', () => {
    const out = reportBodyHtml(withSection([{ type: 'paragraph', text: ['secret'] }], true));
    expect(out).not.toContain('secret');
    expect(out).toContain('<h2 class="st">Card</h2>');
  });

  it('reads the plain text of an inline back for the legends it matches on', () => {
    expect(inlineText(['a', { n: '1' }, { l: 'x' }])).toBe('a1x');
  });
});
