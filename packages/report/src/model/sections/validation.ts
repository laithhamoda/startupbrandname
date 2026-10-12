import type { EngineRun, FigureConfidence, TornadoVariable, ValidationEntry } from '@sbn/engine';
import { EXPERIMENT_CODES, type ExperimentCode } from '../../messages/types';
import { CONFIDENCE_SCORES, PRIORITY_CONFIDENCE_CEILING, VALIDATION_PLAN_DAYS } from '../constants';
import type { Ctx } from '../context';
import { concat, plain } from '../inline';
import type { Block, Cell, DefinitionItem, Inline } from '../types';
import { callout, column, note, paragraph, row, table } from './shared';

function isExperimentCode(code: string): code is ExperimentCode {
  return (EXPERIMENT_CODES as readonly string[]).includes(code);
}

function codeText(ctx: Ctx, code: string): string {
  return isExperimentCode(code) ? ctx.m.validation.codes[code] : code;
}

const level = (score: number): FigureConfidence =>
  score >= CONFIDENCE_SCORES.high ? 'high' : score >= CONFIDENCE_SCORES.medium ? 'medium' : 'low';

/** The founder's number the experiment tests, written for the sentence that gives the reason. */
function testedValue(ctx: Ctx, run: EngineRun, variable: TornadoVariable): Cell {
  const { input } = run;
  switch (variable) {
    case 'price':
      return ctx.moneyCell(input.price, { pivotal: true });
    case 'vc':
      return ctx.moneyCell(input.variableCost, { pivotal: true });
    case 'fixed_costs':
      return ctx.moneyCell(input.fixedCosts, { pivotal: true });
    case 'sales':
      return ctx.figureCell(ctx.ratio(input.sales.value.month12), input.sales, { pivotal: true });
  }
}

function item(ctx: Ctx, term: string, text: Inline): DefinitionItem {
  return { term: plain(term), definition: ctx.cell(text), tag: null, label: null, url: null };
}

function entryBlocks(ctx: Ctx, run: EngineRun, entry: ValidationEntry, position: number): Block[] {
  const words = ctx.m.validation;
  const blocks: Block[] = [];
  const items: DefinitionItem[] = [];
  const title =
    entry.variable === 'worry'
      ? plain(words.worryTitle)
      : words.entryTitle({ n: ctx.integer(position) });
  if (entry.variable === 'worry') {
    blocks.push(callout('worry', words.worryQuote({ worry: plain(entry.worry?.value ?? '') })));
  } else {
    const tested = testedValue(ctx, run, entry.variable);
    const swingRow = run.tornado.rows.find((candidate) => candidate.variable === entry.variable);
    items.push({
      term: plain(words.labels.why),
      definition: {
        ...tested,
        text: words.why[entry.variable]({
          value: tested.text,
          change: ctx.percent(run.tornado.change.value),
          swing: swingRow === undefined ? [] : ctx.money(swingRow.swing.value),
          confidence: plain(ctx.m.words.confidence[tested.provenance?.confidence ?? 'low']),
        }),
      },
      tag: null,
      label: null,
      url: null,
    });
  }
  items.push(
    item(ctx, words.labels.test, plain(codeText(ctx, entry.metric))),
    item(
      ctx,
      words.labels.success,
      concat(plain(codeText(ctx, entry.threshold)), [' '], plain(words.successDefault)),
    ),
    item(ctx, words.labels.fallback, plain(codeText(ctx, entry.fallback))),
    item(ctx, words.labels.cost, plain(words.costClasses[entry.costClass])),
  );
  blocks.push({ type: 'definitionList', title, items });
  return blocks;
}

function rankTable(ctx: Ctx, run: EngineRun): Block[] {
  const words = ctx.m.validation;
  const rows = run.validationPlan.candidates.map((candidate) =>
    row(plain(ctx.m.scenarios.variables[candidate.variable]), [
      ctx.figureCell(
        plain(ctx.m.words.confidence[level(candidate.confidence.value)]),
        candidate.confidence,
      ),
      ctx.figureCell(ctx.integer(candidate.rank.value), candidate.rank),
      ctx.figureCell(ctx.integer(candidate.score.value), candidate.score),
    ]),
  );
  return [
    table({
      caption: plain(words.rankCaption),
      headHeader: plain(words.rankColumns.assumption),
      columns: [
        column(plain(words.rankColumns.confidence)),
        column(plain(words.rankColumns.rank), { numeric: true }),
        column(plain(words.rankColumns.priority), { numeric: true }),
      ],
      rows,
    }),
    note(
      words.priorityFormula({
        ceiling: ctx.integer(PRIORITY_CONFIDENCE_CEILING),
        rankCeiling: ctx.integer(run.tornado.rows.length + 1),
        high: ctx.integer(CONFIDENCE_SCORES.high),
        medium: ctx.integer(CONFIDENCE_SCORES.medium),
        low: ctx.integer(CONFIDENCE_SCORES.low),
      }),
    ),
    note(plain(words.worryFirst)),
  ];
}

/** T18: the experiments to run first, the founder's own worry before the rest (D-230). */
export function buildValidationPlan(ctx: Ctx, run: EngineRun): Block[] {
  const words = ctx.m.validation;
  const blocks: Block[] = [paragraph(words.intro({ days: ctx.integer(VALIDATION_PLAN_DAYS) }))];
  run.validationPlan.entries.forEach((entry, index) => {
    blocks.push(...entryBlocks(ctx, run, entry, index + 1));
  });
  blocks.push(...rankTable(ctx, run));
  return blocks;
}
