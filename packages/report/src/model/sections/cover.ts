import type { EngineRun } from '@sbn/engine';
import type { Ctx } from '../context';
import { formatDate } from '../format';
import { ltr, num, plain } from '../inline';
import type { Block, DefinitionItem, Inline } from '../types';
import { paragraph } from './shared';

function fact(ctx: Ctx, term: string, text: Inline): DefinitionItem {
  return { term: plain(term), definition: ctx.cell(text), tag: null, label: null, url: null };
}

/** The cover: the title, the country and currency, the day, the engine version and the confidence. */
export function buildCover(ctx: Ctx, run: EngineRun): Block[] {
  const { input, m } = ctx;
  const { project } = input;
  const confidence = run.confidence;
  const facts = m.cover.facts;
  return [
    paragraph(plain(m.cover.promise)),
    {
      type: 'definitionList',
      title: null,
      items: [
        fact(ctx, facts.project, plain(project.title)),
        fact(ctx, facts.country, plain(ctx.countryName(project.countryCode))),
        fact(
          ctx,
          facts.currency,
          m.cover.currencyValue({
            name: plain(ctx.currencyName(project.currency)),
            code: ltr(project.currency),
          }),
        ),
        fact(ctx, facts.issuedOn, num(formatDate(input.today))),
        fact(ctx, facts.engineVersion, num(run.engineVersion)),
        fact(ctx, facts.completeness, ctx.wholePercent(input.completeness.percent)),
        fact(
          ctx,
          facts.confidence,
          m.cover.confidenceValue({
            level: plain(m.words.confidence[confidence.level.value]),
            sound: ctx.integer(confidence.sound),
            total: ctx.integer(confidence.pivotal.length),
          }),
        ),
      ],
    },
  ];
}
