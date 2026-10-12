import { PIVOTAL_IDS, type EngineRun } from '@sbn/engine';
import type { Ctx } from '../context';
import { plain } from '../inline';
import type { Block, Inline } from '../types';
import { bulletList, note, paragraph } from './shared';
import { questionTitle, topRisks } from './risks';

/** The risks section of the free summary (SPEC section 6): up to three template sentences. */
export function buildTopRisks(ctx: Ctx): Block[] {
  const risks = topRisks(ctx);
  if (risks.length === 0) return [paragraph(plain(ctx.m.risks.none))];
  return [bulletList(null, risks)];
}

function estimateBlocks(ctx: Ctx, run: EngineRun): Block[] {
  const unit = run.unitEconomics;
  const horizon = run.projection.calendar.horizonMonths;
  const term = ctx.term('break_even');
  if (unit.status === 'blocked') {
    return [
      paragraph(
        ctx.m.breakEven.blocked({ term, margin: ctx.money(unit.contributionMargin.value) }),
      ),
    ];
  }
  const month = unit.breakEvenMonth.value;
  if (month === null) {
    return [paragraph(ctx.m.breakEven.notReached({ term, horizon: ctx.monthsPhrase(horizon) }))];
  }
  return [
    paragraph(
      ctx.m.breakEven.estimate({
        term,
        month: ctx.monthLabel(month),
        revenue: ctx.money(unit.breakEvenRevenue.value),
        units: ctx.integer(unit.breakEvenUnits.value),
      }),
    ),
  ];
}

/** What the answers still lack: the reasons the engine gave, or else the pivotal answers missing. */
function missingTitles(ctx: Ctx): Inline[] {
  const reasons = ctx.input.notCalculable ?? [];
  if (reasons.length > 0) {
    return reasons.map((reason) =>
      ctx.m.notCalculable[reason.code]({
        question: questionTitle(ctx, reason.questionId),
        item: plain(reason.item ?? ''),
        currency: plain(reason.currency ?? ''),
      }),
    );
  }
  return PIVOTAL_IDS.filter((id) => ctx.input.answers[id]?.status !== 'answered').map((id) =>
    plain(ctx.m.risks.figures[id]),
  );
}

/** The break-even estimate of the free summary, or the sentence that the answers are not enough yet. */
export function buildBreakEven(ctx: Ctx): Block[] {
  const { run } = ctx.input;
  if (run === null) {
    const blocks: Block[] = [
      paragraph(ctx.m.breakEven.notEnough({ term: ctx.term('break_even') })),
    ];
    const missing = missingTitles(ctx);
    if (missing.length > 0) blocks.push(bulletList(plain(ctx.m.breakEven.missingIntro), missing));
    return blocks;
  }
  return [...estimateBlocks(ctx, run), note(plain(ctx.m.breakEven.caveat))];
}
