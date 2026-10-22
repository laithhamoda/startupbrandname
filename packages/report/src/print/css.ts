import type { PrintLocale } from './locale';

/**
 * The brand tokens of CLAUDE.md §6 for paper. Gold #D4A537 and teal #1FA3C7 are the brand colours;
 * on white paper they are too light for text, so numbers and links use the darker inks (contrast
 * with white: 5.3:1 and 5.8:1). Gold stays reserved for the verdict, key numbers and primary
 * actions; teal is functional only.
 */
export const PRINT_TOKENS = {
  black: '#000000',
  gold: '#D4A537',
  teal: '#1FA3C7',
  goldInk: '#8C6A12',
  tealInk: '#0B6E8A',
  ink: '#141414',
  muted: '#4D4D4D',
  rule: '#D6D6D6',
  paper: '#FFFFFF',
  wash: '#F4F2EC',
} as const;

/** The named page of wide tables (A4 landscape): an element with `page: wide` starts one. */
export const WIDE_PAGE_NAME = 'wide';

export interface PrintCssOptions {
  /**
   * Draws the page number in the bottom margin of every page but the first with an `@page` margin
   * box, in Western digits (D-284). Off for a document whose number comes from the footer template
   * of the PDF renderer, so a page never carries two.
   */
  pageNumbers?: boolean;
}

/**
 * The stylesheet of a print document. Logical properties only (margin-inline, padding-block,
 * text-align: start/end, inset-inline), as in the rest of the product; no left or right. The
 * direction comes from the dir attribute of the html element, never from the CSS.
 */
export function buildPrintCss(locale: PrintLocale, options: PrintCssOptions = {}): string {
  const t = PRINT_TOKENS;
  // Arabic script needs more air between lines than Latin script (CLAUDE.md §6).
  const lineHeight = locale === 'ar' ? '1.9' : '1.6';
  return `
:root{
  --black:${t.black};--gold:${t.gold};--teal:${t.teal};
  --gold-ink:${t.goldInk};--teal-ink:${t.tealInk};
  --ink:${t.ink};--muted:${t.muted};--rule:${t.rule};--paper:${t.paper};--wash:${t.wash};
}
@page{size:A4 portrait;margin:24mm 18mm 22mm}
@page ${WIDE_PAGE_NAME}{size:A4 landscape;margin:22mm 18mm 20mm}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-kerning:normal;text-rendering:geometricPrecision}
body{margin:0;background:var(--paper);color:var(--ink);font-family:'Tajawal','Cairo',sans-serif;font-weight:400;font-size:11pt;line-height:${lineHeight};overflow-wrap:anywhere;text-align:start}
h1,h2,h3{font-family:'Cairo','Tajawal',sans-serif;margin-block:0;break-after:avoid;line-height:1.5}
h1{font-weight:700;font-size:21pt;margin-block-end:8pt}
h2{font-weight:700;font-size:14pt;margin-block:14pt 4pt}
h3{font-weight:600;font-size:11.5pt;margin-block:10pt 2pt}
p{margin-block:0 7pt;orphans:3;widows:3}
strong,b{font-weight:700}
bdi{unicode-bidi:isolate}
a{color:var(--teal-ink);text-decoration:none}
section.page{break-after:page;break-inside:auto}
section.page:last-of-type{break-after:auto}
section.${WIDE_PAGE_NAME}{page:${WIDE_PAGE_NAME}}

.cover{display:flex;flex-direction:column;justify-content:space-between;block-size:238mm;border-block-start:3pt solid var(--gold);padding-block-start:14mm}
.cover .brand{font-family:'Cairo','Tajawal',sans-serif;font-weight:600;font-size:12pt}
.cover h1{font-size:34pt;line-height:1.35;margin-block:18mm 6mm}
.cover .subtitle{font-size:15pt;color:var(--muted);max-inline-size:120mm}
.cover .meta{border-block-start:1pt solid var(--rule);padding-block-start:6pt;color:var(--muted);font-size:10pt}

.slab{background:var(--black);color:var(--gold);padding:16pt 20pt;margin-block:10pt 14pt;break-inside:avoid}
.slab .label{font-size:10pt;color:var(--paper);margin-block-end:2pt}
.slab .verdict{font-family:'Cairo','Tajawal',sans-serif;font-weight:700;font-size:26pt;line-height:1.4}
.slab .reason{color:var(--paper);font-size:11pt;margin-block-start:4pt;margin-block-end:0}

.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10pt;margin-block:6pt 14pt}
.kpi{border-block-start:1pt solid var(--rule);padding-block:6pt 0;break-inside:avoid}
.kpi .value{font-family:'Cairo','Tajawal',sans-serif;font-weight:700;font-size:19pt;color:var(--gold-ink);line-height:1.4}
.kpi .caption{font-size:10pt;color:var(--muted)}

.tbl{inline-size:100%;border-collapse:collapse;font-size:10pt;margin-block:6pt 12pt}
.tbl caption{caption-side:top;text-align:start;font-weight:700;padding-block-end:4pt}
.tbl th,.tbl td{padding:4pt 7pt;border-block-end:0.5pt solid var(--rule);vertical-align:baseline}
.tbl th{font-weight:700;text-align:start;border-block-end:1pt solid var(--ink);background:var(--wash)}
.tbl tbody th{font-weight:400;background:none;border-block-end:0.5pt solid var(--rule)}
.tbl thead{display:table-header-group}
.tbl tr{break-inside:avoid}
.tbl .num{direction:ltr;text-align:end;font-variant-numeric:tabular-nums lining-nums;white-space:nowrap}
.tbl tfoot td{font-weight:700;border-block-start:1pt solid var(--ink)}
.tbl.dense{font-size:8.5pt}
.tbl.dense th,.tbl.dense td{padding:3pt 4pt}
.tbl.dense tbody th{font-weight:700}

ul.points{margin-block:0 8pt;padding-inline-start:16pt}
ul.points li{margin-block-end:3pt}
.callout{border-inline-start:3pt solid var(--teal);padding-inline-start:10pt;margin-block:8pt;color:var(--ink)}
.user-text{border-inline-start:2pt solid var(--rule);padding-inline-start:10pt;margin-block:6pt 10pt;white-space:pre-wrap;color:var(--ink)}
.plain{unicode-bidi:plaintext}
.note{font-size:9.5pt;color:var(--muted)}
.long{overflow-wrap:anywhere;word-break:break-all}
.nowrap{white-space:nowrap}
${pageNumbers(options, t)}
${REPORT_CSS}
`.trim();
}

/** The page number: digits only, so no founder's text and no new font ever reaches a margin box. */
function pageNumbers(options: PrintCssOptions, t: typeof PRINT_TOKENS): string {
  if (options.pageNumbers !== true) return '';
  return (
    `@page{@bottom-center{content:counter(page) " / " counter(pages);direction:ltr;` +
    `font-family:'Tajawal',sans-serif;font-size:8pt;color:${t.muted}}}
` +
    '@page :first{@bottom-center{content:none}}'
  );
}

/**
 * The rules of the report template (M5 step 6, D-279), from the approved print mock
 * (docs/design/report-print-mock.html, its .sheet stylesheet). Scoped by class: the spike document
 * of step 0 does not use them.
 */
const REPORT_CSS = `
.cover-sec{break-after:page}
.cover .kind{font-family:'Cairo','Tajawal',sans-serif;font-weight:600;font-size:13pt;color:var(--muted);margin-block:0 6mm}
.cover h1{max-inline-size:170mm;text-wrap:balance}
.cover .bottom{padding-block-end:6mm}
.facts{display:grid;grid-template-columns:repeat(3,1fr);margin:0;border-block-start:1pt solid var(--ink)}
.facts div{padding-block:7pt 0;padding-inline-end:10pt;break-inside:avoid}
.facts dt{font-size:9pt;color:var(--muted);line-height:1.6}
.facts dd{margin:0;font-family:'Cairo','Tajawal',sans-serif;font-weight:600;font-size:11pt;line-height:1.6}
.cover .promise{font-size:9.5pt;color:var(--muted);margin-block:16pt 0;max-inline-size:125mm;line-height:1.7}

.sec{margin-block-end:10pt}
.sec.newpage{break-before:page}
.sec>h2.st{font-size:20pt;margin-block:0 8pt}
.sec.locked{break-inside:avoid}
.sec.locked>h2.st{font-size:13pt;color:var(--muted);margin-block:10pt 0}
.sec.locked p{margin-block:0}
.lead{max-inline-size:150mm}

.slab .stop{font-family:'Cairo','Tajawal',sans-serif;font-weight:700;font-size:12pt;color:var(--paper);margin-block:0 2pt}
.meter{position:relative;margin-block-start:10pt}
.meter .cells{display:flex;gap:3pt}
.meter i{flex:1;block-size:6pt;border:0.75pt solid rgba(255,255,255,0.55)}
.meter i.on{background:var(--paper);border-color:var(--paper)}
.meter .tick{position:absolute;inset-block:-4pt;inline-size:1.5pt;background:var(--gold)}
.slab .mcap{color:var(--paper);font-size:9pt;margin-block:7pt 0;line-height:1.5}

.kpi .klabel{font-size:9pt;color:var(--muted);line-height:1.5}
.kpi .value{line-height:1.4}
sup.lc{font-size:0.6em;line-height:0;vertical-align:super;margin-inline-start:1pt}
.callout.lcnote{border-inline-start-color:var(--gold-ink);font-size:9.5pt;color:var(--muted)}
.callout{break-inside:avoid;font-size:10pt}

.tbl th,.tbl td{overflow-wrap:break-word}
.tbl{break-inside:auto}
.tbl.keep{break-inside:avoid}
.tbl .hc{text-align:center}
.tbl .ta-end{text-align:end}
.tbl .sub{display:block;font-size:8.5pt;color:var(--muted);line-height:1.5}
.tbl tr.tot th,.tbl tr.tot td{font-weight:700;border-block-start:1pt solid var(--ink)}
.tbl td.lcf{font-weight:700}
.tbl.dense{font-size:8pt;margin-block:2pt 6pt}
.tbl.dense th,.tbl.dense td{padding:2pt 3pt;line-height:1.5}
.tbl.dense .num{white-space:normal}
.tbl.dense .num bdi{white-space:nowrap}
.tbl.dense thead th.be{border-block-start:2.5pt solid var(--gold)}
.tbl.dense td.be{border-block-start:2.5pt solid var(--gold)}
.tbl.dense td.low{background:var(--wash);color:var(--gold-ink);font-weight:700;outline:1pt solid var(--gold-ink);outline-offset:-1pt}
.tbl.dense tbody th{inline-size:34mm}
.note.legend{display:block}
.note.legend::before{content:"";display:inline-block;inline-size:9pt;block-size:9pt;vertical-align:-1pt;margin-inline-end:4pt}
.note.legend.low::before{background:var(--wash);outline:1pt solid var(--gold-ink);outline-offset:-1pt}
.note.legend.be::before{background:var(--wash);border-block-start:2.5pt solid var(--gold)}

.taxbox{border-block:1pt solid var(--ink);padding-block:5pt;margin-block:8pt 0;font-size:9pt;line-height:1.65;break-inside:avoid}
.chip{display:inline-block;border:0.75pt solid var(--ink);padding:0 5pt;font-size:8pt;font-weight:700;margin-inline-start:4pt;line-height:1.5}
.defs{margin-block:4pt 10pt}
.defs dl{margin:0}
.defs .def{display:grid;grid-template-columns:44mm 1fr;column-gap:6mm;padding-block:3pt;border-block-end:0.5pt solid var(--rule);break-inside:avoid}
.defs dt{font-weight:700;font-size:10pt}
.defs dd{margin:0;font-size:10pt}
.defs .url{display:block;font-size:9pt;color:var(--teal-ink);overflow-wrap:anywhere}

.canvas{break-inside:avoid;margin-block:6pt 12pt}
.board{display:grid;grid-template-columns:repeat(10,1fr);gap:0.5pt;background:var(--rule);border:0.5pt solid var(--rule)}
.cvc{background:var(--paper);padding:5pt 6pt;min-inline-size:0;font-size:8.5pt;line-height:1.55}
.cvc h4{font-family:'Cairo','Tajawal',sans-serif;font-weight:700;font-size:9pt;margin:0 0 3pt}
.cvc ul{list-style:none;margin:0;padding:0}
.cvc li{border-inline-start:1.5pt solid var(--rule);padding-inline-start:5pt;margin-block-end:3pt;white-space:pre-wrap}
.cvc .clabel{display:inline;font-weight:700;font-size:8pt;color:var(--muted);margin-inline-end:4pt}
.cvc .empty{color:var(--muted);margin:0}
.cvc dl{margin:4pt 0 0;border-block-start:0.5pt solid var(--rule);padding-block-start:3pt;display:grid;grid-template-columns:repeat(3,1fr);gap:3pt 8pt}
.cvc dl div{break-inside:avoid}
.cvc dt{font-size:8pt;color:var(--muted)}
.cvc dd{margin:0;font-weight:700;color:var(--gold-ink)}
.cv-costStructure ul{columns:2;column-gap:10pt}
.cv-costStructure li{break-inside:avoid}
.cv-keyPartners{grid-column:1/span 2;grid-row:1/span 2}
.cv-keyActivities{grid-column:3/span 2;grid-row:1}
.cv-keyResources{grid-column:3/span 2;grid-row:2}
.cv-valuePropositions{grid-column:5/span 2;grid-row:1/span 2}
.cv-customerRelationships{grid-column:7/span 2;grid-row:1}
.cv-channels{grid-column:7/span 2;grid-row:2}
.cv-customerSegments{grid-column:9/span 2;grid-row:1/span 2}
.cv-costStructure{grid-column:1/span 5;grid-row:3}
.cv-revenueStreams{grid-column:6/span 5;grid-row:3}
.cv-problem{grid-column:1/span 2;grid-row:1/span 2}
.cv-solution{grid-column:3/span 2;grid-row:1}
.cv-keyMetrics{grid-column:3/span 2;grid-row:2}
.cv-uniqueValueProposition{grid-column:5/span 2;grid-row:1/span 2}
.cv-unfairAdvantage{grid-column:7/span 2;grid-row:1}

.exp{display:grid;grid-template-columns:40mm 1fr;column-gap:8mm;padding-block:7pt 3pt;border-block-start:1pt solid var(--ink);break-inside:avoid}
.exp .who h3{margin:0 0 3pt;font-size:12pt}
.exp .who .cost{display:block;font-size:8.5pt;color:var(--muted);line-height:1.5}
.exp .what p{margin:0 0 3pt;font-size:10pt;line-height:1.75;max-inline-size:122mm}
.exp .what .why{color:var(--muted)}
.exp .user-text{font-size:11.5pt;line-height:1.7;max-inline-size:122mm;margin:0 0 5pt}
.fills{display:grid;grid-template-columns:1fr 1fr;column-gap:12pt;margin-block-start:3pt}
.fill{display:flex;align-items:baseline;gap:6pt;font-size:9pt;color:var(--muted);margin-block-start:3pt}
.fill i{flex:1;border-block-end:0.75pt dotted var(--muted);block-size:1.1em;min-inline-size:10mm}
.fill.dec{grid-column:1/-1}
.fill.dec span.opt{color:var(--ink);margin-inline-end:10pt}
.fill .box{display:inline-block;inline-size:8pt;block-size:8pt;border:0.75pt solid var(--ink);margin-inline-end:4pt;vertical-align:-1pt;flex:none}

.url{overflow-wrap:anywhere}
p.link{font-size:10pt;margin-block:2pt 6pt}
`;
