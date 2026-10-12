import type { EngineRun, ScenarioKind, ScenarioResult } from '@sbn/engine';
import type { Ctx } from '../context';
import { plain } from '../inline';
import type { Block, Cell, Inline } from '../types';
import { column, note, row, table } from './shared';

const ORDER: readonly ScenarioKind[] = ['conservative', 'base', 'optimistic'];

function assumptionsText(ctx: Ctx, scenario: ScenarioResult): Inline {
  const words = ctx.m.scenarios;
  if (scenario.kind === 'base') return plain(words.baseAssumptions);
  const slots = {
    sales: ctx.ratio(scenario.salesMultiplier),
    cost: ctx.ratio(scenario.vcMultiplier),
  };
  return scenario.launchDelayMonths > 0
    ? words.assumptionsDelay({ ...slots, delay: ctx.monthsPhrase(scenario.launchDelayMonths) })
    : words.assumptions(slots);
}

function scenarioTable(ctx: Ctx, run: EngineRun): Block {
  const words = ctx.m.scenarios;
  const horizon = run.projection.calendar.horizonMonths;
  const results = ORDER.map((kind) => run.scenarios[kind]);
  const fundingCell = (scenario: ScenarioResult): Cell =>
    scenario.funding.status === 'ok'
      ? ctx.moneyCell(scenario.funding.need)
      : ctx.cell(plain(words.fundingNotCalculated));
  return table({
    caption: plain(words.caption),
    headHeader: null,
    columns: ORDER.map((kind) => column(plain(words.names[kind]), { numeric: true })),
    rows: [
      row(
        plain(words.rows.assumptions),
        results.map((scenario) =>
          ctx.figureCell(assumptionsText(ctx, scenario), scenario.breakEvenMonth),
        ),
      ),
      row(
        plain(words.rows.breakEvenMonth),
        results.map((scenario) =>
          ctx.figureCell(
            ctx.monthOrNone(scenario.breakEvenMonth.value, horizon),
            scenario.breakEvenMonth,
          ),
        ),
      ),
      row(plain(words.rows.fundingNeed), results.map(fundingCell)),
      row(
        plain(words.rows.firstYearProfit),
        results.map((scenario) => ctx.moneyCell(scenario.firstYearOperatingProfit)),
      ),
    ],
  });
}

function tornadoTable(ctx: Ctx, run: EngineRun): Block {
  const words = ctx.m.scenarios;
  const { tornado } = run;
  return table({
    caption: words.tornadoCaption({
      term: ctx.term('sensitivity'),
      change: ctx.percent(tornado.change.value),
    }),
    headHeader: plain(words.tornadoColumns.variable),
    columns: [
      column(plain(words.tornadoColumns.low), { numeric: true }),
      column(plain(words.tornadoColumns.high), { numeric: true }),
      column(plain(words.tornadoColumns.swing), { numeric: true }),
    ],
    rows: tornado.rows.map((entry) =>
      row(plain(words.variables[entry.variable]), [
        ctx.moneyCell(entry.atLow),
        ctx.moneyCell(entry.atHigh),
        ctx.moneyCell(entry.swing),
      ]),
    ),
  });
}

/** T10: the three scenarios and the sensitivity ranking of the four variables. */
export function buildScenarios(ctx: Ctx, run: EngineRun): Block[] {
  return [
    scenarioTable(ctx, run),
    tornadoTable(ctx, run),
    note(plain(ctx.m.scenarios.tornadoNote)),
  ];
}
