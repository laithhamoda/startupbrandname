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

/**
 * The stylesheet of a print document. Logical properties only (margin-inline, padding-block,
 * text-align: start/end, inset-inline), as in the rest of the product; no left or right. The
 * direction comes from the dir attribute of the html element, never from the CSS.
 */
export function buildPrintCss(locale: PrintLocale): string {
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
`.trim();
}
