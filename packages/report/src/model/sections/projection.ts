import {
  addMoney,
  negateMoney,
  zeroMoney,
  type EngineRun,
  type Money,
  type OkCashFlow,
  type ProjectionLine,
} from '@sbn/engine';
import type { Ctx } from '../context';
import { plain } from '../inline';
import type { Block, Column, Row } from '../types';
import { column, note, paragraph, row, table } from './shared';
import { taxNoticeBlocks } from './tax-notice';

/** The cash flow when it was calculable, else null (set-up costs missing). */
function okFlow(run: EngineRun): OkCashFlow | null {
  return run.cash.cashFlow.status === 'ok' ? run.cash.cashFlow : null;
}

function sum(currency: string, values: readonly Money[]): Money {
  return values.reduce(addMoney, zeroMoney(currency));
}

function yearOneTable(ctx: Ctx, run: EngineRun, flow: OkCashFlow | null): Block {
  const { projection } = run;
  const words = ctx.m.projection;
  const currency = projection.currency;
  const breakEven =
    run.unitEconomics.status === 'ok' ? run.unitEconomics.breakEvenMonth.value : null;
  const lowest = flow === null ? null : flow.lowest.value.month;
  const monthColumns: Column[] = Array.from({ length: 12 }, (_, index) =>
    column(ctx.integer(index + 1), {
      numeric: true,
      mark: breakEven === index + 1 ? 'break_even' : null,
    }),
  );
  const columns = [...monthColumns, column(plain(ctx.m.yearTotal), { numeric: true })];

  const moneyRow = (label: string, line: ProjectionLine<Money>): Row => {
    const months = line.monthly.slice(0, 12);
    return row(plain(label), [
      ...months.map((value) => ctx.figureCell(ctx.money(value), line.provenance)),
      ctx.figureCell(ctx.money(sum(currency, months)), line.provenance),
    ]);
  };

  const unitMonths = projection.units.monthly.slice(0, 12);
  const rows: Row[] = [
    row(plain(words.rows.units), [
      ...unitMonths.map((units) => ctx.figureCell(ctx.integer(units), projection.units.provenance)),
      ctx.figureCell(
        ctx.integer(unitMonths.reduce((a, b) => a + b, 0n)),
        projection.units.provenance,
      ),
    ]),
    moneyRow(words.rows.revenue, projection.revenue),
    moneyRow(words.rows.cogs, projection.cogs),
    moneyRow(words.rows.grossProfit, projection.grossProfit),
    moneyRow(words.rows.operatingCosts, projection.operatingCosts),
    moneyRow(words.rows.operatingProfit, projection.operatingProfit),
  ];
  if (flow !== null) {
    rows.push(moneyRow(words.rows.netCash, flow.netCash));
    // The engine's cumulative cash starts at month 0 (the set-up costs), so month k is index k.
    const cumulative = flow.cumulative.value.slice(1, 13);
    rows.push(
      row(
        plain(flow.taxIncluded ? words.rows.cumulativeCash : words.rows.cumulativeCashBeforeTax),
        [
          ...cumulative.map((value, index) =>
            ctx.figureCell(ctx.money(value), flow.cumulative, {
              mark: lowest === index + 1 ? 'lowest_cash' : null,
            }),
          ),
          ctx.figureCell(
            ctx.money(cumulative[cumulative.length - 1] ?? zeroMoney(currency)),
            flow.cumulative,
          ),
        ],
      ),
    );
  }
  return table({
    caption: plain(words.yearOneCaption),
    headHeader: plain(words.monthHeader),
    columns,
    rows,
  });
}

function laterYearTables(ctx: Ctx, run: EngineRun, flow: OkCashFlow | null): Block[] {
  const { projection } = run;
  const words = ctx.m.projection;
  const currency = projection.currency;
  const years = projection.calendar.horizonMonths / 12;
  const tables: Block[] = [];
  for (let year = 2; year <= years; year += 1) {
    const indexes = projection.calendar.periods
      .map((period, index) => ({ period, index }))
      .filter(({ period }) => period.year === year);
    const quarterColumns: Column[] = indexes.map((_, position) =>
      column(ctx.m.quarter({ n: ctx.integer(position + 1) }), { numeric: true }),
    );
    const columns = [...quarterColumns, column(plain(ctx.m.yearTotal), { numeric: true })];
    const moneyRow = (label: string, line: ProjectionLine<Money>): Row => {
      const values = indexes.map(({ index }) => line.byPeriod[index] ?? zeroMoney(currency));
      return row(plain(label), [
        ...values.map((value) => ctx.figureCell(ctx.money(value), line.provenance)),
        ctx.figureCell(ctx.money(sum(currency, values)), line.provenance),
      ]);
    };
    const rows: Row[] = [
      moneyRow(words.rows.revenue, projection.revenue),
      moneyRow(words.rows.cogs, projection.cogs),
      moneyRow(words.rows.operatingCosts, projection.operatingCosts),
      moneyRow(words.rows.operatingProfit, projection.operatingProfit),
    ];
    if (flow !== null) {
      rows.push(moneyRow(words.rows.netCash, flow.netCash));
      rows.push(
        row(
          plain(flow.taxIncluded ? words.rows.cumulativeCash : words.rows.cumulativeCashBeforeTax),
          [
            ...indexes.map(({ period }) =>
              ctx.figureCell(
                ctx.money(flow.cumulative.value[period.lastMonth] ?? zeroMoney(currency)),
                flow.cumulative,
              ),
            ),
            ctx.cell(plain(ctx.m.words.dash)),
          ],
        ),
      );
    }
    tables.push(
      table({
        caption: words.laterYearCaption({ year: ctx.integer(year) }),
        headHeader: plain(words.monthHeader),
        columns,
        rows,
      }),
    );
  }
  return tables;
}

/** T9: the operating projection and the cash flow, before tax unless the tax was calculated. */
export function buildProjection(ctx: Ctx, run: EngineRun): Block[] {
  const words = ctx.m.projection;
  const flow = okFlow(run);
  const option = run.input.paymentOption?.value;
  const blocks: Block[] = [
    paragraph(words.intro({ timing: plain(words.timingWords[option ?? 'assumed']) })),
    yearOneTable(ctx, run, flow),
  ];
  if (flow === null) {
    blocks.push(paragraph(plain(words.cashNotCalculated)));
  } else {
    blocks.push(
      note(words.startsFrom({ setup: ctx.money(negateMoney(flow.setupCosts.value)) })),
      note(words.legendLowest({ month: ctx.monthLabel(flow.lowest.value.month) })),
    );
    const unit = run.unitEconomics;
    const breakEven = unit.status === 'ok' ? unit.breakEvenMonth.value : null;
    if (breakEven !== null) {
      blocks.push(
        note(
          words.legendBreakEven({ term: ctx.term('break_even'), month: ctx.monthLabel(breakEven) }),
        ),
      );
    }
    const payback = flow.payback.value;
    blocks.push(
      note(
        payback === null
          ? words.paybackNone({
              term: ctx.term('payback'),
              horizon: ctx.monthsPhrase(run.projection.calendar.horizonMonths),
            })
          : words.paybackLine({ term: ctx.term('payback'), month: ctx.monthLabel(payback) }),
      ),
    );
  }
  blocks.push(...laterYearTables(ctx, run, flow));
  blocks.push(...taxNoticeBlocks(ctx, run));
  return blocks;
}
