import { messagesFor } from '../messages';
import { inlineText } from '../model/inline';
import type { Block, DefinitionItem, ReportModel, Section, SectionId } from '../model/types';
import { blocksHtml, inlineHtml, type PrintContext } from './blocks';
import { buildPrintDocument } from './document';
import { escapeHtml } from './escape';
import type { PrintLocale } from './locale';

/** The sections that start a new page. The cover and the sections that follow flow on. */
const NEW_PAGE: ReadonlySet<SectionId> = new Set([
  'executive_summary',
  'canvases',
  'projection',
  'legal_path_financing',
  'validation_plan',
  'appendix_assumptions',
]);

/** The sections set on the named landscape page: the twelve-month tables and the canvas boards. */
const LANDSCAPE: ReadonlySet<SectionId> = new Set(['projection', 'canvases']);

export interface ReportDocumentOptions {
  /** Defaults to the print set; a test passes its own to avoid reading the font files. */
  fontCss?: string;
}

/** The name of the report in the running header and in the title of the file: the project's title. */
export function reportTitle(model: ReportModel): string {
  return model.meta.title.trim() === '' ? messagesFor(model.locale).reportKind : model.meta.title;
}

type DefinitionBlock = Extract<Block, { type: 'definitionList' }>;

function factsOf(model: ReportModel, ctx: PrintContext): readonly DefinitionItem[] {
  const cover = model.sections.find((section) => section.id === 'cover' && !section.locked);
  const list = cover?.blocks.find(
    (block): block is DefinitionBlock => block.type === 'definitionList',
  );
  if (list !== undefined) {
    // The first fact is the project's name: the cover already shows it as its title.
    return list.items.filter((item) => inlineText(item.term) !== ctx.m.cover.facts.project);
  }
  const facts = ctx.m.cover.facts;
  const plain = (term: string, value: string): DefinitionItem => ({
    term: [term],
    definition: { text: [{ n: value }], provenance: null, lowConfidence: false, mark: null },
    tag: null,
    label: null,
    url: null,
  });
  return [
    plain(facts.issuedOn, model.meta.issuedOn),
    ...(model.meta.engineVersion === null
      ? []
      : [plain(facts.engineVersion, model.meta.engineVersion)]),
  ];
}

/**
 * The cover, alone on its page: the brand, the kind of report, the project's title, and the facts
 * of the report. The facts come from the cover section when it is open and from the metadata
 * otherwise (a summary keeps the cover locked), so a summary never prints more than the page shows.
 */
function coverHtml(model: ReportModel, ctx: PrintContext): string {
  const cover = model.sections.find((section) => section.id === 'cover' && !section.locked);
  const promise = cover?.blocks.find((block) => block.type === 'paragraph');
  const facts = factsOf(model, ctx)
    .map(
      (item) =>
        `<div><dt>${inlineHtml(item.term)}</dt><dd>${inlineHtml(item.definition.text)}</dd></div>`,
    )
    .join('');
  return (
    '<section class="cover-sec"><div class="cover">' +
    '<div class="brand"><bdi dir="ltr">Startup Brand Name</bdi></div>' +
    `<div><p class="kind">${escapeHtml(ctx.m.reportKind)}</p>` +
    `<h1 dir="auto">${escapeHtml(reportTitle(model))}</h1></div>` +
    `<div class="bottom"><dl class="facts">${facts}</dl>` +
    (promise?.type === 'paragraph' ? `<p class="promise">${inlineHtml(promise.text)}</p>` : '') +
    '</div></div></section>'
  );
}

function sectionHtml(section: Section, ctx: PrintContext): string {
  const title = `<h2 class="st">${escapeHtml(section.title)}</h2>`;
  if (section.locked) {
    return (
      `<section class="sec locked" id="s-${section.id}">${title}` +
      `<p class="note">${escapeHtml(ctx.m.print.locked)}</p></section>`
    );
  }
  const classes = [
    'sec',
    NEW_PAGE.has(section.id) ? 'newpage' : '',
    LANDSCAPE.has(section.id) ? 'wide' : '',
  ].filter((name) => name !== '');
  const body = blocksHtml(section.blocks, ctx, { experiments: section.id === 'validation_plan' });
  return `<section class="${classes.join(' ')}" id="s-${section.id}">${title}${body}</section>`;
}

/** The sections of the report after the cover, in the order of the model. */
export function reportBodyHtml(model: ReportModel): string {
  const locale: PrintLocale = model.locale;
  const ctx: PrintContext = { locale, m: messagesFor(model.locale) };
  return [
    coverHtml(model, ctx),
    ...model.sections.filter((section) => section.id !== 'cover').map((s) => sectionHtml(s, ctx)),
  ].join('\n');
}

/**
 * The whole print document of a report (M5 step 6, D-279): the same ReportModel the screen draws,
 * drawn on A4 pages from escaped text only. Arabic first, English with the same template; the
 * direction comes from the model's locale. The title of the document, and so of the PDF, is the
 * project's title and nothing else.
 */
export async function buildReportDocument(
  model: ReportModel,
  options: ReportDocumentOptions = {},
): Promise<string> {
  return buildPrintDocument({
    locale: model.locale,
    title: reportTitle(model),
    body: reportBodyHtml(model),
    pageNumbers: true,
    ...(options.fontCss === undefined ? {} : { fontCss: options.fontCss }),
  });
}
