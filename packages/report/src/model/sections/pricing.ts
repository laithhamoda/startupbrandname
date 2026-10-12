import type { EngineRun, OkUnitEconomics } from '@sbn/engine';
import type { Ctx } from '../context';
import { plain } from '../inline';
import type { Block, Cell, Row } from '../types';
import { column, note, paragraph, row, table } from './shared';

function unitTable(ctx: Ctx, run: EngineRun): Block {
  const words = ctx.m.pricing;
  const { input, unitEconomics: unit } = run;
  const rows: Row[] = [
    row(plain(words.rows.price), [ctx.moneyCell(input.price, { pivotal: true })]),
    row(plain(words.rows.variableCost), [ctx.moneyCell(input.variableCost, { pivotal: true })]),
    row(plain(words.rows.fixedEntered), [ctx.moneyCell(input.fixedCosts, { pivotal: true })]),
    row(words.rows.margin({ term: ctx.term('contribution_margin') }), [
      ctx.moneyCell(unit.contributionMargin),
    ]),
  ];
  if (unit.contributionMarginRate !== null) {
    rows.push(
      row(plain(words.rows.marginRate), [
        ctx.figureCell(ctx.percent(unit.contributionMarginRate.value), unit.contributionMarginRate),
      ]),
    );
  }
  if (unit.status === 'ok') rows.push(...breakEvenRows(ctx, run, unit));
  return table({
    caption: plain(words.unitCaption),
    headHeader: plain(words.columns.item),
    columns: [column(plain(words.columns.value), { numeric: true })],
    rows,
  });
}

function breakEvenRows(ctx: Ctx, run: EngineRun, unit: OkUnitEconomics): Row[] {
  const words = ctx.m.pricing;
  return [
    row(plain(words.rows.fixedTotal), [ctx.moneyCell(unit.fixedCost)]),
    row(plain(words.rows.breakEvenUnits), [
      ctx.figureCell(ctx.integer(unit.breakEvenUnits.value), unit.breakEvenUnits),
    ]),
    row(plain(words.rows.breakEvenRevenue), [ctx.moneyCell(unit.breakEvenRevenue)]),
    row(words.rows.breakEvenMonth({ term: ctx.term('break_even') }), [
      ctx.figureCell(
        ctx.monthOrNone(unit.breakEvenMonth.value, run.projection.calendar.horizonMonths),
        unit.breakEvenMonth,
      ),
    ]),
  ];
}

function capacityParagraph(ctx: Ctx, unit: OkUnitEconomics, capacity: bigint | null): Block {
  const words = ctx.m.pricing;
  if (capacity === null) return paragraph(plain(words.capacityUnlimited));
  const slots = { units: ctx.integer(unit.breakEvenUnits.value), capacity: ctx.integer(capacity) };
  return paragraph(
    unit.breakEvenUnits.value > capacity ? words.capacityAbove(slots) : words.capacityWithin(slots),
  );
}

function subscriptionBlocks(ctx: Ctx, unit: OkUnitEconomics): Block[] {
  const subscription = unit.subscription;
  if (subscription === null) return [];
  const words = ctx.m.pricing;
  const rows: Row[] = [row(plain(words.subscriptionRows.arpu), [ctx.moneyCell(subscription.arpu)])];
  const optional = (head: ReturnType<typeof plain>, cell: Cell | null) => {
    if (cell !== null) rows.push(row(head, [cell]));
  };
  const { churn, ltv, newCustomers, cac, ltvToCac } = subscription;
  optional(
    plain(words.subscriptionRows.churn),
    churn === null ? null : ctx.figureCell(ctx.percent(churn.value), churn),
  );
  optional(
    words.subscriptionRows.ltv({ term: ctx.term('ltv') }),
    ltv === null ? null : ctx.moneyCell(ltv),
  );
  optional(
    plain(words.subscriptionRows.newCustomers),
    newCustomers === null ? null : ctx.figureCell(ctx.ratio(newCustomers.value), newCustomers),
  );
  optional(
    words.subscriptionRows.cac({ term: ctx.term('cac') }),
    cac === null ? null : ctx.moneyCell(cac),
  );
  optional(
    plain(words.subscriptionRows.ltvToCac),
    ltvToCac === null ? null : ctx.figureCell(ctx.ratio(ltvToCac.value), ltvToCac),
  );
  const blocks: Block[] = [
    table({
      caption: plain(words.subscriptionCaption),
      headHeader: plain(words.columns.item),
      columns: [column(plain(words.columns.value), { numeric: true })],
      rows,
    }),
  ];
  for (const gap of subscription.gaps) blocks.push(note(plain(words.subscriptionGaps[gap])));
  return blocks;
}

function marketBlocks(ctx: Ctx, run: EngineRun): Block[] {
  const words = ctx.m.pricing;
  const { pricing } = run;
  const rows: Row[] = [];
  if (pricing.floor !== null) {
    rows.push(
      row(words.marketRows.floor({ term: ctx.term('price_floor') }), [
        ctx.moneyCell(pricing.floor),
      ]),
    );
  }
  const { band } = pricing;
  if (band !== null) {
    rows.push(
      row(plain(words.marketRows.bandMin), [ctx.figureCell(ctx.money(band.value.min), band)]),
      row(plain(words.marketRows.bandMedian), [ctx.figureCell(ctx.money(band.value.median), band)]),
      row(plain(words.marketRows.bandMax), [ctx.figureCell(ctx.money(band.value.max), band)]),
    );
  }
  if (pricing.penetration !== null) {
    rows.push(row(plain(words.marketRows.penetration), [ctx.moneyCell(pricing.penetration)]));
  }
  if (pricing.market !== null) {
    rows.push(row(plain(words.marketRows.market), [ctx.moneyCell(pricing.market)]));
  }
  if (pricing.premium !== null) {
    rows.push(row(plain(words.marketRows.premium), [ctx.moneyCell(pricing.premium)]));
  }
  const blocks: Block[] = [];
  if (rows.length > 0) {
    blocks.push(
      table({
        caption: plain(words.marketCaption),
        headHeader: plain(words.columns.item),
        columns: [column(plain(words.columns.value), { numeric: true })],
        rows,
      }),
    );
  }
  for (const gap of pricing.gaps) blocks.push(note(plain(words.marketGaps[gap])));
  blocks.push(
    paragraph(plain(pricing.premiumAllowed ? words.premiumAllowed : words.premiumNotAllowed)),
  );
  return blocks;
}

/** T8 and T7: the unit economics, the break-even, the subscription measures and the price positions. */
export function buildPricing(ctx: Ctx, run: EngineRun): Block[] {
  const blocks: Block[] = [unitTable(ctx, run)];
  const unit = run.unitEconomics;
  if (unit.status === 'blocked') {
    blocks.push(
      paragraph(ctx.m.pricing.blocked({ margin: ctx.money(unit.contributionMargin.value) })),
    );
  } else {
    blocks.push(capacityParagraph(ctx, unit, run.input.capacity.value));
    blocks.push(...subscriptionBlocks(ctx, unit));
  }
  blocks.push(...marketBlocks(ctx, run));
  return blocks;
}
