import {
  type EngineNote,
  type EngineRun,
  type Figure,
  type MonthLimit,
  type Provenance as EngineProvenance,
  type Rate,
} from '@sbn/engine';
import { PACK_KEYS, type PackItem } from '../../legal-path';
import type { ParamLabelKey } from '../../messages/types';
import { PARAM_LABEL_KEYS } from '../../messages/types';
import { paramOf, type Ctx } from '../context';
import { formatDate } from '../format';
import { concat, ltr, num, plain } from '../inline';
import type { Block, Cell, Inline, Row } from '../types';
import { adviserBlocks } from './tax-notice';
import { bulletList, column, note, paragraph, row, table } from './shared';

type Registered = EngineProvenance & { readonly confidence: Figure<unknown>['confidence'] };

function flagged(figure: EngineProvenance): boolean {
  return figure.source === 'assumption' || figure.confidence === 'low';
}

function limitText(ctx: Ctx, limit: MonthLimit): Inline {
  switch (limit.kind) {
    case 'within':
      return ctx.monthsPhrase(limit.months);
    case 'unbounded':
      return plain(ctx.m.appendix.limitUnbounded);
    case 'unset':
      return plain(ctx.m.words.dash);
  }
}

function provenanceCells(ctx: Ctx, figure: Registered): Cell[] {
  return [
    ctx.cell(plain(ctx.m.words.source[figure.source])),
    ctx.cell(plain(ctx.m.words.confidence[figure.confidence])),
    ctx.cell(plain(figure.validated ? ctx.m.words.validated : ctx.m.words.unvalidated)),
  ];
}

function registerRow(
  ctx: Ctx,
  label: string,
  text: Inline,
  figure: EngineProvenance,
  pivotal = false,
): Row | null {
  if (!flagged(figure)) return null;
  return row(plain(label), [
    ctx.figureCell(text, figure, { pivotal }),
    ...provenanceCells(ctx, figure),
  ]);
}

function registerRows(ctx: Ctx, run: EngineRun): Row[] {
  const names = ctx.m.appendix.registerItems;
  const { input } = run;
  const sales = input.sales.value;
  const capital = input.capital.value;
  const unit = run.unitEconomics;
  const candidates: (Row | null)[] = [
    registerRow(ctx, names.price, ctx.money(input.price.value), input.price, true),
    registerRow(
      ctx,
      names.variableCost,
      ctx.money(input.variableCost.value),
      input.variableCost,
      true,
    ),
    registerRow(ctx, names.fixedCosts, ctx.money(input.fixedCosts.value), input.fixedCosts, true),
    registerRow(ctx, names.marketing, ctx.money(input.marketing.value), input.marketing),
    input.setupCosts === null
      ? null
      : registerRow(
          ctx,
          names.setupCosts,
          ctx.money(input.setupCosts.value),
          input.setupCosts,
          true,
        ),
    registerRow(
      ctx,
      names.staff,
      ctx.m.appendix.staffCount({ count: ctx.integer(input.staff.value.length) }),
      input.staff,
    ),
    registerRow(
      ctx,
      names.sales,
      ctx.m.appendix.sales({
        month1: ctx.ratio(sales.month1),
        month6: ctx.ratio(sales.month6),
        month12: ctx.ratio(sales.month12),
      }),
      input.sales,
      true,
    ),
    registerRow(
      ctx,
      names.capacity,
      input.capacity.value === null ? plain(ctx.m.words.dash) : ctx.integer(input.capacity.value),
      input.capacity,
    ),
    registerRow(
      ctx,
      names.churn,
      input.churn.value === null ? plain(ctx.m.words.dash) : ctx.percent(input.churn.value),
      input.churn,
    ),
    registerRow(
      ctx,
      names.capital,
      capital === null
        ? plain(ctx.m.words.dash)
        : ctx.m.appendix.capital({ min: ctx.money(capital.min), max: ctx.money(capital.max) }),
      input.capital,
    ),
    registerRow(ctx, names.runway, limitText(ctx, input.runway.value), input.runway),
    registerRow(
      ctx,
      names.breakEvenTarget,
      limitText(ctx, input.breakEvenTarget.value),
      input.breakEvenTarget,
    ),
    registerRow(
      ctx,
      names.legalForm,
      plain(ctx.m.appendix.legalForms[input.legalForm.value]),
      input.legalForm,
    ),
    run.cash.cashFlow.status === 'ok'
      ? registerRow(
          ctx,
          names.fundingNeed,
          ctx.money(run.cash.cashFlow.fundingNeed.value),
          run.cash.cashFlow.fundingNeed,
        )
      : null,
    unit.status === 'ok'
      ? registerRow(
          ctx,
          names.breakEvenMonth,
          ctx.monthOrNone(unit.breakEvenMonth.value, run.projection.calendar.horizonMonths),
          unit.breakEvenMonth,
        )
      : null,
    registerRow(
      ctx,
      names.firstYearProfit,
      ctx.money(run.scenarios.base.firstYearOperatingProfit.value),
      run.scenarios.base.firstYearOperatingProfit,
    ),
  ];
  return candidates.filter((entry): entry is Row => entry !== null);
}

function engineNotes(run: EngineRun): EngineNote['code'][] {
  const codes: EngineNote['code'][] = [];
  for (const entry of [...run.input.notes, ...run.projection.notes]) {
    if (!codes.includes(entry.code)) codes.push(entry.code);
  }
  return codes;
}

function isRateList(value: unknown): value is readonly Rate[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'object' && entry !== null)
  );
}

type ParamFormat = 'months' | 'percent' | 'ratio' | 'percentList' | 'percentOrNone';

const PARAM_FORMAT: Readonly<Record<ParamLabelKey, ParamFormat>> = {
  'engine.horizon_months': 'months',
  'growth.upper_bound_yearly': 'percent',
  'growth.founder_share': 'percent',
  'growth.year3_share_of_year2': 'percent',
  'seasonality.peak_factor': 'ratio',
  'inflation.yearly': 'percentOrNone',
  'scenario.conservative.sales_factor': 'ratio',
  'scenario.optimistic.sales_factor': 'ratio',
  'scenario.conservative.vc_factor': 'ratio',
  'scenario.optimistic.vc_factor': 'ratio',
  'scenario.conservative.launch_delay_months': 'months',
  'pricing.penetration_floor_factor': 'ratio',
  'unit_economics.ltv_cac_minimum': 'ratio',
  'fx.cogs_shocks': 'percentList',
  'scenario.tornado_swing': 'percent',
  'feasibility.window_months': 'months',
  'verdict.go_score_line': 'percent',
  'verdict.funding_multiple': 'ratio',
  'confidence.high_line': 'percent',
  'confidence.medium_line': 'percent',
};

function isRate(value: unknown): value is Rate {
  return typeof value === 'object' && value !== null && 'num' in value && 'den' in value;
}

function parameterText(ctx: Ctx, format: ParamFormat, value: unknown): Inline {
  const dash = plain(ctx.m.words.dash);
  switch (format) {
    case 'months':
      return typeof value === 'number' ? ctx.monthsPhrase(value) : dash;
    case 'percent':
      return isRate(value) ? ctx.percent(value) : dash;
    case 'ratio':
      return isRate(value) ? ctx.ratio(value) : dash;
    case 'percentOrNone':
      return isRate(value) ? ctx.percent(value) : plain(ctx.m.appendix.inflationNone);
    case 'percentList':
      return isRateList(value)
        ? concat(
            ...value.flatMap((rate, index) => [
              index === 0 ? [] : plain(ctx.m.words.listSeparator),
              ctx.signedPercent(rate),
            ]),
          )
        : dash;
  }
}

function parameterRows(ctx: Ctx, run: EngineRun): Row[] {
  const rows: Row[] = [];
  for (const key of PARAM_LABEL_KEYS) {
    const figure = paramOf(run, key);
    if (figure === undefined) continue;
    rows.push(
      row(plain(ctx.m.appendix.parameters[key]), [
        ctx.figureCell(parameterText(ctx, PARAM_FORMAT[key], figure.value), figure),
        ...provenanceCells(ctx, figure),
      ]),
    );
  }
  return rows;
}

/** Appendix A: every figure that is an assumption or a low-confidence number, and the engine's own. */
export function buildAssumptions(ctx: Ctx, run: EngineRun): Block[] {
  const words = ctx.m.appendix;
  const registerColumns = [
    column(plain(words.registerColumns.value), { numeric: true }),
    column(plain(words.registerColumns.source)),
    column(plain(words.registerColumns.confidence)),
    column(plain(words.registerColumns.validated)),
  ];
  const rows = registerRows(ctx, run);
  const blocks: Block[] = [paragraph(plain(words.assumptionsIntro))];
  blocks.push(
    rows.length === 0
      ? paragraph(plain(words.registerNone))
      : table({
          caption: plain(words.registerCaption),
          headHeader: plain(words.registerColumns.item),
          columns: registerColumns,
          rows,
        }),
  );
  const notes = engineNotes(run);
  if (notes.length > 0) {
    blocks.push(
      bulletList(
        plain(words.notesTitle),
        notes.map((code) => plain(words.notes[code])),
      ),
    );
  }
  blocks.push(
    table({
      caption: plain(words.parametersCaption),
      headHeader: plain(words.parameterColumns.parameter),
      columns: [
        column(plain(words.parameterColumns.value), { numeric: true }),
        column(plain(words.parameterColumns.source)),
        column(plain(words.parameterColumns.confidence)),
        column(plain(words.parameterColumns.validated)),
      ],
      rows: parameterRows(ctx, run),
    }),
  );
  return blocks;
}

function sourceRow(ctx: Ctx, item: PackItem, label: string | null): Row {
  const words = ctx.m.appendix;
  const verified =
    item.lastVerified === null ? plain(words.neverVerified) : num(formatDate(item.lastVerified));
  return row(plain(item.value.name[ctx.locale]), [
    ctx.cell(ltr(item.sourceUrl)),
    ctx.cell(verified),
    ctx.cell(plain(label ?? ctx.m.words.dash)),
  ]);
}

/** Appendix B: the pack items the report used, with their source and the date they were verified. */
export function buildSources(ctx: Ctx): Block[] {
  const words = ctx.m.appendix;
  const { guide, link } = ctx.legal();
  const used = new Map<string, { item: PackItem; label: string | null }>();
  for (const step of guide.steps) {
    used.set(step.item.key, {
      item: step.item,
      label: step.label === null ? null : ctx.m.verifyOfficialSource,
    });
  }
  if (link !== null) {
    const tax = ctx.input.packItems.find(
      (candidate) =>
        candidate.countryCode === ctx.input.project.countryCode.toUpperCase() &&
        candidate.key === PACK_KEYS.taxAuthority,
    );
    if (tax !== undefined && !used.has(tax.key)) {
      used.set(tax.key, {
        item: tax,
        label: link.label === null ? null : ctx.m.verifyOfficialSource,
      });
    }
  }
  const blocks: Block[] = [paragraph(plain(words.sourcesIntro))];
  if (used.size === 0) {
    blocks.push(paragraph(plain(words.sourcesNone)));
    return blocks;
  }
  blocks.push(
    table({
      caption: plain(words.sourcesCaption),
      headHeader: plain(words.sourcesColumns.item),
      columns: [
        column(plain(words.sourcesColumns.source)),
        column(plain(words.sourcesColumns.verified), { numeric: true }),
        column(plain(words.sourcesColumns.status)),
      ],
      rows: [...used.values()].map(({ item, label }) => sourceRow(ctx, item, label)),
    }),
  );
  return blocks;
}

/** Appendix C: a planning tool, not legal, tax or financial advice. */
export function buildDisclaimer(ctx: Ctx): Block[] {
  const words = ctx.m.appendix;
  return [
    ...words.disclaimer.map((text) => paragraph(plain(text))),
    note(plain(words.notAProbability)),
    ...adviserBlocks(ctx),
  ];
}
