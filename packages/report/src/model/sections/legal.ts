import { compareMoney, type EngineRun } from '@sbn/engine';
import { getQuestion, valueOf } from '@sbn/question-bank';
import type { GuideStep } from '../../legal-path';
import type { Ctx } from '../context';
import { join, ltr, plain } from '../inline';
import type { Block, DefinitionItem, Inline } from '../types';
import { adviserBlocks, taxNoticeBlocks } from './tax-notice';
import { bulletList, callout, column, note, paragraph, row, table } from './shared';

/** The financing sources that bring money from outside the founder's circle (H3, D-227). */
const OUTSIDE_SOURCES: readonly string[] = ['loan', 'investor', 'grant', 'competition'];

function stepItem(ctx: Ctx, step: GuideStep): DefinitionItem {
  const { item } = step;
  const value = item.value;
  const text: string[] = [value.description[ctx.locale]];
  if (value.note !== undefined) text.push(value.note[ctx.locale]);
  for (const figure of value.figures ?? []) text.push(figure.text);
  const verified = item.status === 'verified';
  return {
    term: plain(value.name[ctx.locale]),
    definition: {
      text: plain(text.join(' ')),
      provenance: {
        source: 'external',
        confidence: verified && step.label === null ? 'high' : 'low',
        validated: verified,
      },
      lowConfidence: false,
      mark: null,
    },
    tag: ctx.m.legal.roles[step.role],
    label: step.label === null ? null : { code: step.label, text: ctx.m.verifyOfficialSource },
    url: item.sourceUrl,
  };
}

function guideBlocks(ctx: Ctx): Block[] {
  const { guide } = ctx.legal();
  if (!guide.hasPack) {
    return [
      callout(
        'verify',
        ctx.m.legal.noPack({ country: plain(ctx.countryName(ctx.input.project.countryCode)) }),
      ),
    ];
  }
  const blocks: Block[] = [
    {
      type: 'definitionList',
      title: plain(ctx.m.legal.guideTitle),
      items: guide.steps.map((step) => stepItem(ctx, step)),
    },
  ];
  if (guide.missing.length > 0) {
    blocks.push(note(ctx.m.legal.missingItems({ count: ctx.integer(guide.missing.length) })));
  }
  return blocks;
}

function taxBlocks(ctx: Ctx, run: EngineRun): Block[] {
  const tax = run.cash.tax;
  const words = ctx.m.legal;
  if (tax.status !== 'calculated') return taxNoticeBlocks(ctx, run);
  return [
    paragraph(words.taxCalculated({ regime: ltr(tax.regime) })),
    table({
      caption: plain(words.taxCaption),
      headHeader: plain(words.taxColumns.year),
      columns: [
        column(plain(words.taxColumns.turnover), { numeric: true }),
        column(plain(words.taxColumns.profit), { numeric: true }),
        column(plain(words.taxColumns.tax), { numeric: true }),
      ],
      rows: tax.years.map((year) =>
        row(ctx.m.yearLabel({ n: ctx.integer(year.year) }), [
          ctx.cell(ctx.money(year.turnover)),
          ctx.cell(ctx.money(year.profit)),
          ctx.moneyCell(year.total),
        ]),
      ),
    }),
    ...adviserBlocks(ctx),
  ];
}

function financingItems(ctx: Ctx, run: EngineRun): Inline[] {
  const words = ctx.m.legal;
  const flow = run.cash.cashFlow;
  const capital = run.input.capital.value;
  const items: Inline[] = [];
  if (flow.status !== 'ok') {
    items.push(plain(words.fundingNotCalculated));
  } else {
    const need = ctx.money(flow.fundingNeed.value);
    if (capital === null) {
      items.push(words.fundingNoCapital({ need }));
    } else if (compareMoney(flow.fundingNeed.value, capital.max) <= 0) {
      items.push(
        words.fundingVsCapitalWithin({
          need,
          min: ctx.money(capital.min),
          max: ctx.money(capital.max),
        }),
      );
    } else {
      items.push(words.fundingVsCapitalAbove({ need, max: ctx.money(capital.max) }));
    }
  }
  const field = getQuestion('H3').field;
  const options = field.kind === 'multi' ? field.options : [];
  const chosen = valueOf(ctx.input.answers, 'H3', 'multi')?.values ?? [];
  const outside = options
    .filter((option) => chosen.includes(option.value) && OUTSIDE_SOURCES.includes(option.value))
    .map((option) => plain(option.label[ctx.locale]));
  items.push(
    outside.length > 0
      ? words.outsideSources({ sources: join(outside, ctx.m.words.listSeparator) })
      : plain(words.noOutsideSources),
  );
  if (valueOf(ctx.input.answers, 'G7', 'single') === 'yes') items.push(plain(words.shariaYes));
  return items;
}

/** T17 and the tax and financing paragraphs: the legal path, the tax line and the funding need. */
export function buildLegalPath(ctx: Ctx, run: EngineRun): Block[] {
  return [
    ...guideBlocks(ctx),
    ...taxBlocks(ctx, run),
    bulletList(plain(ctx.m.legal.financingTitle), financingItems(ctx, run)),
  ];
}
