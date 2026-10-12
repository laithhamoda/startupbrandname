import {
  PARAM_KEYS,
  PIVOTAL_IDS,
  type BlockerCode,
  type EngineRun,
  type RunAlert,
  type TornadoVariable,
} from '@sbn/engine';
import { findFollowUp, getQuestion, isQuestionId, valueOf, type StepId } from '@sbn/question-bank';
import type { AnyAlertCode } from '../../messages/types';
import {
  feasibilityMonths,
  isPivotalStep,
  paramRate,
  type Ctx,
  answerProvenance,
} from '../context';
import { plain } from '../inline';
import type { Inline } from '../types';

/** How many risks the executive summary and the free summary show (D-229). */
export const RISK_COUNT = 3;

/** The variable of the tornado an alert concerns, to rank warnings by how much it moves the profit. */
const ALERT_VARIABLE: Readonly<Record<AnyAlertCode, TornadoVariable | null>> = {
  cm_not_positive: 'price',
  break_even_units_above_capacity: 'sales',
  break_even_month_above_target: 'sales',
  break_even_month_above_runway: 'sales',
  setup_costs_above_capital: null,
  setup_costs_within_capital_range: null,
  price_below_floor: 'price',
  ltv_to_cac_below_minimum: 'price',
  turnover_above_regime_ceiling: null,
  turnover_above_vat_threshold: null,
  tax_regime_not_calculated: null,
};

const SEVERITY_ORDER = { block: 0, warning: 1, note: 2 } as const;

/** The title of a question for a sentence that names what is missing: the pivotal figures by name. */
export function questionTitle(ctx: Ctx, id: StepId | null): Inline {
  if (id === null) return [];
  if (isPivotalStep(id)) return plain(ctx.m.risks.figures[id]);
  if (isQuestionId(id)) return plain(getQuestion(id).label[ctx.locale]);
  const followUp = findFollowUp(id);
  return followUp === undefined ? plain(id) : plain(followUp.label[ctx.locale]);
}

/** The sentence of one alert, with the numbers it compared (D-229). */
export function alertSentence(ctx: Ctx, alert: RunAlert): Inline {
  const message = ctx.m.alerts[alert.code];
  return message({
    measured: ctx.alertValue(alert.measured),
    limit: ctx.alertValue(alert.limit),
    lowerLimit: alert.origin === 'economics' ? ctx.alertValue(alert.lowerLimit) : [],
    year: alert.origin === 'tax' && alert.year !== null ? ctx.integer(alert.year) : [],
    regime: alert.origin === 'tax' && alert.regime !== null ? plain(alert.regime) : [],
  });
}

/** The sentence of a blocker, from the figures the verdict compared. */
export function blockerSentence(ctx: Ctx, run: EngineRun, code: BlockerCode): Inline {
  const empty: Inline = [];
  const slots = { margin: empty, window: empty, need: empty, capital: empty, multiple: empty };
  switch (code) {
    case 'margin_not_positive':
      return ctx.m.risks.blockers[code]({
        ...slots,
        margin: ctx.money(run.unitEconomics.contributionMargin.value),
      });
    case 'no_break_even_in_window':
      return ctx.m.risks.blockers[code]({
        ...slots,
        window: ctx.monthsPhrase(feasibilityMonths(run)),
      });
    case 'funding_need_above_capital_multiple': {
      const flow = run.cash.cashFlow;
      const capital = run.input.capital.value;
      const multiple = paramRate(run, PARAM_KEYS.fundingBlockerMultiple);
      return ctx.m.risks.blockers[code]({
        ...slots,
        need: flow.status === 'ok' ? ctx.money(flow.fundingNeed.value) : empty,
        capital: capital === null ? empty : ctx.money(capital.max),
        multiple: multiple === null ? empty : ctx.ratio(multiple.value),
      });
    }
  }
}

function worrySentence(ctx: Ctx, worry: string | null): Inline[] {
  return worry === null || worry.trim() === ''
    ? []
    : [ctx.m.risks.worry({ worry: plain(worry.trim()) })];
}

/**
 * The risks of a calculable run, in the order of D-229: the blockers, then the warnings (by the
 * tornado rank of the variable they concern), then the notes, then the least confident pivotal
 * figures, then the founder's own worry. Each is a template sentence with the numbers of its alert.
 */
function runRisks(ctx: Ctx, run: EngineRun): Inline[] {
  const rank = (code: AnyAlertCode): number => {
    const variable = ALERT_VARIABLE[code];
    const index = run.tornado.rows.findIndex((row) => row.variable === variable);
    return variable === null || index < 0 ? run.tornado.rows.length : index;
  };
  const blockers = run.verdict.blockers.map((blocker) => blockerSentence(ctx, run, blocker.code));
  const alerts = run.alerts
    .filter(
      (alert) => alert.code !== 'cm_not_positive' && alert.code !== 'tax_regime_not_calculated',
    )
    .map((alert, index) => ({ alert, index }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.alert.severity] - SEVERITY_ORDER[b.alert.severity] ||
        rank(a.alert.code) - rank(b.alert.code) ||
        a.index - b.index,
    )
    .map(({ alert }) => alertSentence(ctx, alert));
  const pivotal = run.confidence.pivotal
    .filter((figure) => figure.level.value === 'low' || figure.level.value === 'missing')
    .sort((a, b) => Number(b.level.value === 'missing') - Number(a.level.value === 'missing'))
    .map((figure) => {
      const name = plain(ctx.m.risks.figures[figure.id]);
      return figure.level.value === 'missing'
        ? ctx.m.risks.pivotalMissing({ figure: name })
        : ctx.m.risks.pivotalAssumed({ figure: name });
    });
  return [...blockers, ...alerts, ...pivotal, ...worrySentence(ctx, run.input.worry.value)];
}

/**
 * The risks of answers that cannot be calculated yet (the summary between 40 and 79 percent): the
 * pivotal answers still missing, the pivotal answers that are only guesses, then H6.
 */
function answerRisks(ctx: Ctx): Inline[] {
  const { answers } = ctx.input;
  const missing: Inline[] = [];
  const assumed: Inline[] = [];
  for (const id of PIVOTAL_IDS) {
    const name = plain(ctx.m.risks.figures[id]);
    if (answers[id]?.status !== 'answered') {
      missing.push(ctx.m.risks.pivotalMissing({ figure: name }));
    } else if (answerProvenance(ctx.input, id).confidence === 'low') {
      assumed.push(ctx.m.risks.pivotalAssumed({ figure: name }));
    }
  }
  return [
    ...missing,
    ...assumed,
    ...worrySentence(ctx, valueOf(answers, 'H6', 'long_text') ?? null),
  ];
}

/** The top risks of the report: up to three sentences (D-229). */
export function topRisks(ctx: Ctx): Inline[] {
  const { run } = ctx.input;
  const all = run === null ? answerRisks(ctx) : runRisks(ctx, run);
  return all.slice(0, RISK_COUNT);
}
