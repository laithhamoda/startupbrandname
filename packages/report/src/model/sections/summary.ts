import { PIVOTAL_IDS, type EngineRun, type SuggestedChanges } from '@sbn/engine';
import type { Ctx } from '../context';
import { plain } from '../inline';
import type { Block, Inline } from '../types';
import { bulletList, note, paragraph } from './shared';
import { changeBlocks } from './executive';
import { questionTitle, topRisks } from './risks';

/**
 * The verdict section of the free summary (D-278): the word and one generic sentence, no score, no
 * meter and no number. When tax was not calculated, the sentence that says so follows the word, so
 * a verdict is never read as after tax when it is not (D-292). A stop also holds the fixed stop
 * sentence and the three changes, so the locked phrasing of a stop is kept (CLAUDE.md section 3).
 */
export function buildSummaryVerdict(
  ctx: Ctx,
  run: EngineRun,
  changes: SuggestedChanges | null,
): Block[] {
  const code = run.verdict.verdict.value;
  const blocks: Block[] = [
    {
      type: 'verdict',
      code,
      word: ctx.m.verdictWords[code],
      reason: plain(ctx.m.summaryVerdict[code]),
      stopSentence: code === 'stop' ? ctx.m.stopSentence : null,
      meter: null,
    },
  ];
  if (run.cash.tax.status === 'not_calculated') blocks.push(note(plain(ctx.m.executive.beforeTax)));
  if (code === 'stop') blocks.push(...changeBlocks(ctx, run, changes));
  return blocks;
}

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
        units: ctx.unitsPhrase(unit.breakEvenUnits.value),
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
