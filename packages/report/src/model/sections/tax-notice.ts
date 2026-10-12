import type { EngineRun } from '@sbn/engine';
import type { Ctx } from '../context';
import { concat, plain } from '../inline';
import type { Block, Inline } from '../types';
import { callout, note } from './shared';

/** Why the tax was not calculated, in words: no rule, an ambiguous regime, or a rule in another currency. */
export function taxGapText(ctx: Ctx, run: EngineRun): Inline {
  const tax = run.cash.tax;
  if (tax.status !== 'not_calculated') return [];
  const { gap } = tax;
  return ctx.m.taxGaps[gap.code]({
    regimes:
      gap.code === 'ambiguous_regime' ? plain(gap.regimes.join(ctx.m.words.listSeparator)) : [],
    currency: gap.code === 'rule_other_currency' ? plain(gap.currency) : [],
  });
}

/** The official tax authority link of the country, when the pack has one, as a block. */
export function officialLinkBlocks(ctx: Ctx): Block[] {
  const link = ctx.legal().link;
  if (link === null) return [];
  return [
    {
      type: 'link',
      label: plain(link.name[ctx.locale]),
      url: link.url,
      labelCode: link.label,
      labelText: link.label === null ? null : ctx.m.verifyOfficialSource,
    },
  ];
}

/** The line that recommends a tax adviser, always with the official link when there is one. */
export function adviserBlocks(ctx: Ctx): Block[] {
  const link = officialLinkBlocks(ctx);
  return [
    callout('adviser', plain(ctx.m.adviserLine)),
    ...(link.length > 0 ? link : [note(plain(ctx.m.legal.noOfficialLink))]),
  ];
}

/**
 * The notice that the numbers are before tax because the engine refuses to guess a rule (D-211,
 * D-233, D-266): the sentence, the reason, the official link and the adviser line. Nothing when the
 * tax was calculated.
 */
export function taxNoticeBlocks(ctx: Ctx, run: EngineRun): Block[] {
  if (run.cash.tax.status !== 'not_calculated') return [];
  return [
    callout('tax', concat(plain(ctx.m.projection.taxNotIncluded), [' '], taxGapText(ctx, run))),
    ...adviserBlocks(ctx),
  ];
}
