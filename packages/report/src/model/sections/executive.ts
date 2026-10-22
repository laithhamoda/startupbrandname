import {
  PARAM_KEYS,
  type Change,
  type CriterionId,
  type EngineRun,
  type LeverShift,
  type SuggestedChanges,
} from '@sbn/engine';
import { feasibilityMonths, paramRate, type Ctx } from '../context';
import { join, plain } from '../inline';
import type { Audience, Block, Cell, Inline, KeyNumber, Meter, Row } from '../types';
import { topRisks } from './risks';
import { column, note, paragraph, row, table, bulletList } from './shared';

type KeyId = 'fundingNeed' | 'breakEven' | 'firstYearProfit';

/** The order of the three numbers by audience (D-236, D-269): the one the reader asks first goes first. */
export const KEY_NUMBER_ORDER: Readonly<Record<Audience, readonly KeyId[]>> = {
  bank: ['fundingNeed', 'breakEven', 'firstYearProfit'],
  investor: ['firstYearProfit', 'breakEven', 'fundingNeed'],
  grant: ['breakEven', 'fundingNeed', 'firstYearProfit'],
  course: ['fundingNeed', 'breakEven', 'firstYearProfit'],
  self: ['fundingNeed', 'breakEven', 'firstYearProfit'],
};

function keyNumber(ctx: Ctx, run: EngineRun, id: KeyId): KeyNumber {
  const { m } = ctx;
  const words = m.executive.keyNumbers;
  const unit = run.unitEconomics;
  switch (id) {
    case 'fundingNeed': {
      const flow = run.cash.cashFlow;
      if (flow.status !== 'ok') {
        return {
          label: plain(words.fundingNeed),
          value: ctx.cell(plain(m.words.notCalculated)),
          caption: plain(words.fundingNeedNone),
        };
      }
      return {
        label: plain(words.fundingNeed),
        value: ctx.moneyCell(flow.fundingNeed),
        caption: words.fundingNeedCaption({ month: ctx.monthLabel(flow.lowest.value.month) }),
      };
    }
    case 'breakEven': {
      if (unit.status === 'blocked') {
        return {
          label: plain(words.breakEven),
          value: ctx.cell(plain(m.words.notCalculated)),
          caption: plain(words.breakEvenNone),
        };
      }
      return {
        label: plain(words.breakEven),
        value: ctx.figureCell(
          ctx.monthOrNone(unit.breakEvenMonth.value, run.projection.calendar.horizonMonths),
          unit.breakEvenMonth,
        ),
        caption: words.breakEvenCaption({ term: ctx.term('break_even') }),
      };
    }
    case 'firstYearProfit':
      return {
        label: plain(words.firstYearProfit),
        value: ctx.moneyCell(run.scenarios.base.firstYearOperatingProfit),
        caption: plain(words.firstYearProfitCaption),
      };
  }
}

function meterOf(ctx: Ctx, run: EngineRun): Meter | null {
  const { feasibility } = run;
  const line = paramRate(run, PARAM_KEYS.goScoreLine);
  if (feasibility.score === null || line === null) return null;
  // Rounded to the nearest whole percent (exact integer arithmetic); the caption keeps the exact value.
  const linePercent = Number((line.value.num * 200n + line.value.den) / (line.value.den * 2n));
  return {
    passed: feasibility.passed,
    evaluated: feasibility.evaluated,
    linePercent,
    caption: ctx.m.executive.meterCaption({
      passed: ctx.integer(feasibility.passed),
      evaluated: ctx.integer(feasibility.evaluated),
      line: ctx.percent(line.value),
    }),
  };
}

function verdictReason(ctx: Ctx, run: EngineRun, changes: SuggestedChanges | null): Inline {
  const reason = ctx.m.executive.reason;
  const { feasibility, verdict, confidence } = run;
  const line = paramRate(run, PARAM_KEYS.goScoreLine);
  const slots = {
    passed: ctx.integer(feasibility.passed),
    evaluated: ctx.integer(feasibility.evaluated),
    score: feasibility.score === null ? [] : ctx.percent(feasibility.score.value),
    line: line === null ? [] : ctx.percent(line.value),
  };
  const sentences: Inline[] = [];
  if (verdict.verdict.value === 'go') {
    sentences.push(reason.go(slots));
  } else {
    sentences.push(
      verdict.blockers.length > 0
        ? reason.blockers({ count: ctx.integer(verdict.blockers.length) })
        : plain(reason.noBlocker),
    );
    const belowLine = verdict.holdBacks.includes('score_below_line');
    if (verdict.blockers.length > 0 && feasibility.score !== null && !belowLine) {
      sentences.push(reason.score(slots));
    }
    for (const holdBack of verdict.holdBacks) {
      sentences.push(
        ctx.m.executive.holdBacks[holdBack]({
          ...slots,
          sound: ctx.integer(confidence.sound),
          total: ctx.integer(confidence.pivotal.length),
        }),
      );
    }
    if (changes !== null && changes.changes.length > 0) {
      const reaching = changes.changes.filter((change) => change.reachesThreshold).length;
      sentences.push(
        reaching > 0
          ? reason.changesReach({ changes: ctx.changesPhrase(reaching) })
          : reason.changesImprove({ changes: ctx.changesPhrase(changes.changes.length) }),
      );
    }
    if (changes?.goBlockedBy === 'confidence_low') sentences.push(plain(reason.goNeedsConfidence));
  }
  sentences.push(plain(reason.notProbability));
  return join(sentences, ' ');
}

// ----- What blocks Go --------------------------------------------------------------------------

/** The measured value and the limit of a failing criterion, with the provenance of the criterion. */
function criterionValues(
  ctx: Ctx,
  run: EngineRun,
  id: CriterionId,
): { measured: Inline; limit: Inline } {
  const { input, unitEconomics: unit, cash, scenarios, pricing } = run;
  const none = plain(ctx.m.words.dash);
  const window = feasibilityMonths(run);
  const horizon = run.projection.calendar.horizonMonths;
  const within = (months: number) => ctx.m.within({ months: ctx.monthsPhrase(months) });
  const month = unit.status === 'ok' ? unit.breakEvenMonth.value : null;
  const monthText = unit.status === 'ok' ? ctx.monthOrNone(month, horizon) : none;
  const limitOf = (figure: typeof input.runway): Inline =>
    figure.value.kind === 'within' ? within(figure.value.months) : none;
  const flow = cash.cashFlow;
  const capitalMax = input.capital.value?.max ?? null;
  switch (id) {
    case 'margin_positive':
      return {
        measured: ctx.money(unit.contributionMargin.value),
        limit: ctx.money({ minor: 0n, currency: input.currency }),
      };
    case 'break_even_within_window':
      return { measured: monthText, limit: within(window) };
    case 'break_even_within_target':
      return { measured: monthText, limit: limitOf(input.breakEvenTarget) };
    case 'break_even_within_runway':
      return { measured: monthText, limit: limitOf(input.runway) };
    case 'funding_within_capital':
      return {
        measured: flow.status === 'ok' ? ctx.money(flow.fundingNeed.value) : none,
        limit: capitalMax === null ? none : ctx.money(capitalMax),
      };
    case 'setup_within_capital':
      return {
        measured: input.setupCosts === null ? none : ctx.money(input.setupCosts.value),
        limit: capitalMax === null ? none : ctx.money(capitalMax),
      };
    case 'price_above_floor':
      return {
        measured: ctx.money(input.price.value),
        limit: pricing.floor === null ? none : ctx.money(pricing.floor.value),
      };
    case 'ltv_cac_at_minimum': {
      const ratio = unit.status === 'ok' ? (unit.subscription?.ltvToCac ?? null) : null;
      const minimum = paramRate(run, PARAM_KEYS.ltvCacMinimum);
      return {
        measured: ratio === null ? none : ctx.ratio(ratio.value),
        limit: minimum === null ? none : ctx.ratio(minimum.value),
      };
    }
    case 'conservative_break_even':
      return {
        measured: ctx.monthOrNone(scenarios.conservative.breakEvenMonth.value, horizon),
        limit: within(window),
      };
    case 'payback_within_window':
      return {
        measured:
          flow.status !== 'ok'
            ? none
            : flow.payback.value === null
              ? ctx.m.noPaybackWithin({ months: ctx.monthsPhrase(horizon) })
              : ctx.monthLabel(flow.payback.value),
        limit: within(window),
      };
    case 'break_even_units_within_capacity': {
      const capacity = input.capacity.value;
      return {
        measured: unit.status === 'ok' ? ctx.integer(unit.breakEvenUnits.value) : none,
        limit: capacity === null ? none : ctx.integer(capacity),
      };
    }
  }
}

function blocksTable(ctx: Ctx, run: EngineRun): Block[] {
  const words = ctx.m.executive;
  const failing = run.feasibility.criteria.filter((criterion) => criterion.status === 'fail');
  const blocks: Block[] = [];
  if (failing.length > 0) {
    const rows: Row[] = failing.map((criterion) => {
      const { measured, limit } = criterionValues(ctx, run, criterion.id);
      return row(plain(words.criteria[criterion.id]), [
        ctx.figureCell(measured, criterion),
        ctx.figureCell(limit, criterion),
      ]);
    });
    blocks.push(
      table({
        caption: plain(words.blocksCaption),
        headHeader: plain(words.blocksColumns.criterion),
        columns: [
          column(plain(words.blocksColumns.measured), { numeric: true }),
          column(plain(words.blocksColumns.limit), { numeric: true }),
        ],
        rows,
      }),
    );
  }
  blocks.push(
    note(
      words.blocksNote({
        evaluated: ctx.integer(run.feasibility.evaluated),
        total: ctx.integer(run.feasibility.criteria.length),
      }),
    ),
  );
  return blocks;
}

// ----- The changes -----------------------------------------------------------------------------

function shiftValues(ctx: Ctx, shift: LeverShift): { from: Inline; to: Inline } {
  return shift.unit === 'money'
    ? { from: ctx.money(shift.from.value), to: ctx.money(shift.to.value) }
    : { from: ctx.percent(shift.from.value), to: ctx.percent(shift.to.value) };
}

function changeRow(ctx: Ctx, change: Change, changes: SuggestedChanges): Row {
  const words = ctx.m.executive;
  const sep = ctx.m.words.listSeparator;
  const first = change.shifts[0];
  const labels = change.shifts.map((shift) =>
    plain(words.changeLevers[shift.lever][shift.relativeChange.value.num < 0n ? 'down' : 'up']),
  );
  const notes: Inline[] = [];
  for (const shift of change.shifts) {
    if (shift.unit === 'factor') notes.push(plain(words.leverBasis[shift.lever]));
  }
  if (change.premium) {
    notes.push(
      changes.marketCeiling === null
        ? plain(words.premiumNoteNoCeiling)
        : words.premiumNote({ ceiling: ctx.money(changes.marketCeiling.value) }),
    );
  }
  const values = change.shifts.map((shift) => shiftValues(ctx, shift));
  const source = first === undefined ? change.effort : first.to;
  const cells: Cell[] = [
    ctx.figureCell(
      join(
        values.map((value) => value.from),
        sep,
      ),
      first?.from ?? change.effort,
    ),
    ctx.figureCell(
      join(
        values.map((value) => value.to),
        sep,
      ),
      source,
    ),
    ctx.figureCell(
      join(
        change.shifts.map((shift) => ctx.signedPercent(shift.relativeChange.value)),
        sep,
      ),
      change.effort,
    ),
    ctx.figureCell(
      words.changeResult({
        verdict: plain(ctx.m.verdictWords[change.outcome.verdict.value]),
        passed: ctx.integer(change.outcome.passed),
        evaluated: ctx.integer(change.outcome.evaluated),
      }),
      change.outcome.verdict,
    ),
  ];
  return row(join(labels, ' + '), cells, notes.length === 0 ? null : join(notes, ' '));
}

export function changeBlocks(ctx: Ctx, run: EngineRun, changes: SuggestedChanges | null): Block[] {
  const words = ctx.m.executive;
  const code = run.verdict.verdict.value;
  if (code === 'go') return [];
  if (changes === null) return [paragraph(plain(words.changesUnavailable))];
  const blocks: Block[] = [];
  if (changes.changes.length > 0) {
    blocks.push(
      table({
        caption: plain(words.changesCaption[code]),
        headHeader: plain(words.changesColumns.change),
        columns: [
          column(plain(words.changesColumns.now), { numeric: true }),
          column(plain(words.changesColumns.suggested), { numeric: true }),
          column(plain(words.changesColumns.delta), { numeric: true }),
          column(plain(words.changesColumns.result)),
        ],
        rows: changes.changes.map((change) => changeRow(ctx, change, changes)),
      }),
    );
  }
  if (changes.rethink.length > 0) {
    blocks.push(
      bulletList(
        plain(words.rethinkTitle),
        changes.rethink.map((item) =>
          words.rethinkItem({
            lever: plain(words.leverNames[item.lever]),
            swing: ctx.money(item.swing.value),
          }),
        ),
      ),
    );
  }
  return blocks;
}

/** The executive summary: the verdict, three numbers, three risks, what blocks Go and what to change. */
export function buildExecutiveSummary(
  ctx: Ctx,
  run: EngineRun,
  changes: SuggestedChanges | null,
): Block[] {
  const { m } = ctx;
  const code = run.verdict.verdict.value;
  const blocks: Block[] = [
    paragraph(plain(m.executive.opening[ctx.input.audience])),
    {
      type: 'verdict',
      code,
      word: m.verdictWords[code],
      reason: verdictReason(ctx, run, changes),
      stopSentence: code === 'stop' ? m.stopSentence : null,
      meter: meterOf(ctx, run),
    },
    {
      type: 'keyNumbers',
      items: KEY_NUMBER_ORDER[ctx.input.audience].map((id) => keyNumber(ctx, run, id)),
    },
  ];
  const risks = topRisks(ctx);
  blocks.push(
    risks.length === 0
      ? paragraph(plain(m.risks.none))
      : bulletList(plain(m.executive.risksTitle), risks),
  );
  if (code !== 'go') blocks.push(...blocksTable(ctx, run));
  blocks.push(...changeBlocks(ctx, run, changes));
  if (run.cash.tax.status === 'not_calculated') blocks.push(note(plain(m.executive.beforeTax)));
  blocks.push(
    note(
      m.executive.confidenceLine({
        level: plain(m.words.confidence[run.confidence.level.value]),
        sound: ctx.integer(run.confidence.sound),
        total: ctx.integer(run.confidence.pivotal.length),
      }),
    ),
  );
  return blocks;
}
