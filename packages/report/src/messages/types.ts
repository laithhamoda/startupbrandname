import type {
  AlertCode,
  BlockerCode,
  ChangeLever,
  CostClass,
  CriterionId,
  EngineNote,
  FigureConfidence,
  FigureSource,
  HoldBack,
  NotCalculableReason,
  PivotalId,
  PricingGap,
  ScenarioKind,
  SubscriptionGap,
  TaxAlertCode,
  TaxGap,
  TornadoVariable,
  Verdict,
} from '@sbn/engine';
import type { BlockId, CanvasKind, CanvasTotal, EmptyReason } from '../canvas';
import type { GuideRole } from '../legal-path';
import type { Audience, Inline, SectionId } from '../model/types';

/*
 * The words of the report, once for each language (D-270). A message is a plain string or a
 * template: a function of named slots, each an `Inline` the builder filled from an engine figure,
 * an answer or a named constant. A template's fixed text holds no digit, neither Western nor
 * Arabic-Indic, so no number in a report is written by hand (CLAUDE.md rule 1).
 */

export type Slots<K extends string> = Readonly<Record<K, Inline>>;
export type Template<K extends string> = (slots: Slots<K>) => Inline;

/** The terms whose first occurrence in a report carries the English term in parentheses. */
export const TERM_KEYS = [
  'break_even',
  'payback',
  'contribution_margin',
  'ltv',
  'cac',
  'price_floor',
  'sensitivity',
] as const;
export type TermKey = (typeof TERM_KEYS)[number];

export interface TermText {
  /** The term in the report's language. */
  readonly name: string;
  /** The English term shown in parentheses on first use; null when the language is English. */
  readonly english: string | null;
}

/** The rows of the project card, each from one question of the diagnostic. */
export const CARD_ROWS = [
  'team',
  'idea',
  'customerType',
  'customerProfile',
  'location',
  'workplace',
  'sector',
  'projectType',
  'pricingModel',
  'price',
  'capital',
  'goal',
] as const;
export type CardRow = (typeof CARD_ROWS)[number];

/** The engine parameters the appendix lists, each with a label (the others are not shown). */
export const PARAM_LABEL_KEYS = [
  'engine.horizon_months',
  'growth.upper_bound_yearly',
  'growth.founder_share',
  'growth.year3_share_of_year2',
  'seasonality.peak_factor',
  'inflation.yearly',
  'scenario.conservative.sales_factor',
  'scenario.optimistic.sales_factor',
  'scenario.conservative.vc_factor',
  'scenario.optimistic.vc_factor',
  'scenario.conservative.launch_delay_months',
  'pricing.penetration_floor_factor',
  'unit_economics.ltv_cac_minimum',
  'fx.cogs_shocks',
  'scenario.tornado_swing',
  'feasibility.window_months',
  'verdict.go_score_line',
  'verdict.funding_multiple',
  'confidence.high_line',
  'confidence.medium_line',
] as const;
export type ParamLabelKey = (typeof PARAM_LABEL_KEYS)[number];

/** Every code of the validation library: its metric, success line and fallback (D-230). */
export const EXPERIMENT_CODES = [
  'price.willingness_to_pay',
  'price.accepting_share',
  'price.test_second_price',
  'variable_cost.supplier_quotes',
  'variable_cost.quotes_within_estimate',
  'variable_cost.second_supplier',
  'sales.paid_preorders',
  'sales.preorders_against_month_one',
  'sales.revise_forecast',
  'fixed_costs.written_quotes',
  'fixed_costs.total_within_estimate',
  'fixed_costs.cut_or_postpone',
  'worry.smallest_test',
  'worry.founder_sets_the_line',
  'worry.ask_an_expert',
] as const;
export type ExperimentCode = (typeof EXPERIMENT_CODES)[number];

export type AnyAlertCode = AlertCode | TaxAlertCode;

type AlertSlot = 'measured' | 'limit' | 'lowerLimit' | 'year' | 'regime';
type ScoreSlot = 'passed' | 'evaluated' | 'score' | 'line';

export interface ReportMessages {
  readonly reportKind: string;
  readonly sections: Readonly<Record<SectionId, string>>;
  readonly verdictWords: Readonly<Record<Verdict, string>>;
  /** «غير قابل للتنفيذ بصيغته الحالية» (D-227). */
  readonly stopSentence: string;
  readonly terms: Readonly<Record<TermKey, TermText>>;

  readonly words: {
    readonly source: Readonly<Record<FigureSource, string>>;
    readonly confidence: Readonly<Record<FigureConfidence | 'missing', string>>;
    readonly validated: string;
    readonly unvalidated: string;
    readonly yes: string;
    readonly no: string;
    readonly notCalculated: string;
    readonly perMonth: string;
    readonly dash: string;
    readonly listSeparator: string;
  };
  /** «هذا الرقم افتراض، اختبره قبل أن تبني عليه قراراً.» (D-229). */
  readonly lowConfidence: string;
  /** «تحقّق من المصدر الرسمي» (rule 8). */
  readonly verifyOfficialSource: string;
  /** The line that recommends a tax adviser, always shown (D-233). */
  readonly adviserLine: string;

  readonly month: Template<'n'>;
  readonly months: (slots: { readonly count: number; readonly n: Inline }) => Inline;
  /** Counted nouns with their own plural rules: "one unit", "3 units". */
  readonly units: (slots: { readonly count: number; readonly n: Inline }) => Inline;
  readonly changes: (slots: { readonly count: number; readonly n: Inline }) => Inline;
  readonly within: Template<'months'>;
  readonly noBreakEvenWithin: Template<'months'>;
  readonly noPaybackWithin: Template<'months'>;
  readonly quarter: Template<'n'>;
  readonly yearLabel: Template<'n'>;
  readonly yearTotal: string;
  readonly total: string;

  readonly cover: {
    readonly promise: string;
    readonly facts: Readonly<
      Record<
        | 'project'
        | 'country'
        | 'currency'
        | 'issuedOn'
        | 'engineVersion'
        | 'completeness'
        | 'confidence',
        string
      >
    >;
    readonly currencyValue: Template<'name' | 'code'>;
    readonly confidenceValue: Template<'level' | 'sound' | 'total'>;
  };

  readonly executive: {
    readonly opening: Readonly<Record<Audience, string>>;
    readonly reason: {
      readonly go: Template<ScoreSlot>;
      readonly noBlocker: string;
      readonly blockers: Template<'count'>;
      readonly score: Template<ScoreSlot>;
      readonly changesReach: Template<'changes'>;
      readonly changesImprove: Template<'changes'>;
      readonly goNeedsConfidence: string;
      readonly notProbability: string;
    };
    readonly holdBacks: Readonly<Record<HoldBack, Template<ScoreSlot | 'sound' | 'total'>>>;
    readonly meterCaption: Template<'passed' | 'evaluated' | 'line'>;
    readonly keyNumbers: {
      readonly fundingNeed: string;
      readonly breakEven: string;
      readonly firstYearProfit: string;
      readonly fundingNeedCaption: Template<'month'>;
      readonly fundingNeedNone: string;
      readonly breakEvenCaption: Template<'term'>;
      readonly breakEvenNone: string;
      readonly firstYearProfitCaption: string;
    };
    readonly risksTitle: string;
    readonly blocksCaption: string;
    readonly blocksColumns: Readonly<Record<'criterion' | 'measured' | 'limit', string>>;
    readonly blocksNote: Template<'evaluated' | 'total'>;
    readonly criteria: Readonly<Record<CriterionId, string>>;
    readonly changesCaption: Readonly<Record<'stop' | 'revise', string>>;
    readonly changesColumns: Readonly<
      Record<'change' | 'now' | 'suggested' | 'delta' | 'result', string>
    >;
    readonly changeResult: Template<'verdict' | 'passed' | 'evaluated'>;
    readonly changeLevers: Readonly<Record<ChangeLever, Readonly<Record<'up' | 'down', string>>>>;
    readonly leverBasis: Readonly<Record<ChangeLever, string>>;
    readonly premiumNote: Template<'ceiling'>;
    readonly premiumNoteNoCeiling: string;
    readonly rethinkTitle: string;
    readonly rethinkItem: Template<'lever' | 'swing'>;
    readonly changesUnavailable: string;
    readonly confidenceLine: Template<'level' | 'sound' | 'total'>;
    readonly beforeTax: string;
    readonly leverNames: Readonly<Record<ChangeLever, string>>;
  };

  readonly risks: {
    readonly none: string;
    readonly figures: Readonly<Record<PivotalId, string>>;
    readonly pivotalMissing: Template<'figure'>;
    readonly pivotalAssumed: Template<'figure'>;
    readonly worry: Template<'worry'>;
    readonly blockers: Readonly<
      Record<BlockerCode, Template<'margin' | 'window' | 'need' | 'capital' | 'multiple'>>
    >;
  };

  readonly alerts: Readonly<Record<AnyAlertCode, Template<AlertSlot>>>;
  readonly taxGaps: Readonly<Record<TaxGap['code'], Template<'regimes' | 'currency'>>>;

  readonly breakEven: {
    readonly estimate: Template<'term' | 'month' | 'revenue' | 'units'>;
    readonly notReached: Template<'term' | 'horizon'>;
    readonly blocked: Template<'term' | 'margin'>;
    readonly notEnough: Template<'term'>;
    readonly missingIntro: string;
    readonly caveat: string;
  };
  readonly notCalculable: Readonly<
    Record<NotCalculableReason['code'], Template<'question' | 'item' | 'currency'>>
  >;

  readonly card: {
    readonly rows: Readonly<Record<CardRow, string>>;
    readonly empty: string;
    readonly location: Template<'city' | 'country'>;
    readonly moneyRange: Template<'min' | 'max'>;
  };

  readonly canvases: {
    readonly intro: string;
    readonly names: Readonly<Record<CanvasKind, string>>;
    readonly blocks: Readonly<Record<BlockId, string>>;
    readonly empty: Readonly<Record<EmptyReason, string>>;
    readonly totals: Readonly<Record<CanvasTotal['kind'], string>>;
  };

  readonly pricing: {
    readonly unitCaption: string;
    readonly columns: Readonly<Record<'item' | 'value', string>>;
    readonly rows: Readonly<
      Record<
        | 'price'
        | 'variableCost'
        | 'fixedEntered'
        | 'marginRate'
        | 'fixedTotal'
        | 'breakEvenUnits'
        | 'breakEvenRevenue',
        string
      >
    > & {
      readonly margin: Template<'term'>;
      readonly breakEvenMonth: Template<'term'>;
    };
    readonly blocked: Template<'margin'>;
    readonly capacityUnlimited: string;
    readonly capacityWithin: Template<'units' | 'capacity'>;
    readonly capacityAbove: Template<'units' | 'capacity'>;
    readonly subscriptionCaption: string;
    readonly subscriptionRows: Readonly<
      Record<'arpu' | 'churn' | 'newCustomers' | 'ltvToCac', string>
    > & {
      readonly ltv: Template<'term'>;
      readonly cac: Template<'term'>;
    };
    readonly subscriptionGaps: Readonly<Record<SubscriptionGap, string>>;
    readonly marketCaption: string;
    readonly marketRows: Readonly<
      Record<'bandMin' | 'bandMedian' | 'bandMax' | 'penetration' | 'market' | 'premium', string>
    > & { readonly floor: Template<'term'> };
    readonly marketGaps: Readonly<Record<PricingGap, string>>;
    readonly premiumAllowed: string;
    readonly premiumNotAllowed: string;
  };

  readonly projection: {
    readonly intro: Template<'timing'>;
    readonly yearOneCaption: string;
    readonly laterYearCaption: Template<'year'>;
    readonly rows: Readonly<
      Record<
        | 'units'
        | 'revenue'
        | 'cogs'
        | 'grossProfit'
        | 'operatingCosts'
        | 'operatingProfit'
        | 'netCash'
        | 'cumulativeCash'
        | 'cumulativeCashBeforeTax',
        string
      >
    >;
    readonly monthHeader: string;
    readonly startsFrom: Template<'setup'>;
    readonly legendLowest: Template<'month'>;
    readonly legendBreakEven: Template<'term' | 'month'>;
    readonly paybackLine: Template<'term' | 'month'>;
    readonly paybackNone: Template<'term' | 'horizon'>;
    readonly cashNotCalculated: string;
    readonly timingWords: Readonly<
      Record<'cash' | 'credit' | 'instalments' | 'deposit' | 'assumed', string>
    >;
    readonly taxNotIncluded: string;
  };

  readonly scenarios: {
    readonly caption: string;
    readonly names: Readonly<Record<ScenarioKind, string>>;
    readonly rows: Readonly<
      Record<'assumptions' | 'breakEvenMonth' | 'fundingNeed' | 'firstYearProfit', string>
    >;
    readonly baseAssumptions: string;
    readonly assumptions: Template<'sales' | 'cost'>;
    readonly assumptionsDelay: Template<'sales' | 'cost' | 'delay'>;
    readonly fundingNotCalculated: string;
    readonly tornadoCaption: Template<'term' | 'change'>;
    readonly tornadoColumns: Readonly<Record<'variable' | 'low' | 'high' | 'swing', string>>;
    readonly variables: Readonly<Record<TornadoVariable, string>>;
    readonly tornadoNote: string;
  };

  readonly legal: {
    readonly noPack: Template<'country'>;
    readonly guideTitle: string;
    readonly roles: Readonly<Record<GuideRole, string>>;
    readonly missingItems: Template<'count'>;
    readonly taxCalculated: Template<'regime'>;
    readonly taxCaption: string;
    readonly taxColumns: Readonly<Record<'year' | 'turnover' | 'profit' | 'tax', string>>;
    readonly noOfficialLink: string;
    readonly financingTitle: string;
    readonly fundingVsCapitalWithin: Template<'need' | 'min' | 'max'>;
    readonly fundingVsCapitalAbove: Template<'need' | 'max'>;
    readonly fundingNoCapital: Template<'need'>;
    readonly fundingNotCalculated: string;
    readonly outsideSources: Template<'sources'>;
    readonly noOutsideSources: string;
    readonly shariaYes: string;
  };

  readonly validation: {
    readonly intro: Template<'days'>;
    readonly worryTitle: string;
    readonly worryQuote: Template<'worry'>;
    readonly entryTitle: Template<'n'>;
    readonly why: Readonly<
      Record<TornadoVariable, Template<'value' | 'change' | 'swing' | 'confidence'>>
    >;
    readonly labels: Readonly<Record<'why' | 'test' | 'success' | 'fallback' | 'cost', string>>;
    readonly successDefault: string;
    readonly costClasses: Readonly<Record<CostClass, string>>;
    readonly codes: Readonly<Record<ExperimentCode, string>>;
    readonly rankCaption: string;
    readonly rankColumns: Readonly<
      Record<'assumption' | 'confidence' | 'rank' | 'priority', string>
    >;
    readonly priorityFormula: Template<'ceiling' | 'rankCeiling' | 'high' | 'medium' | 'low'>;
    readonly worryFirst: string;
  };

  readonly appendix: {
    readonly assumptionsIntro: string;
    readonly registerCaption: string;
    readonly registerColumns: Readonly<
      Record<'item' | 'value' | 'source' | 'confidence' | 'validated', string>
    >;
    readonly registerNone: string;
    readonly registerItems: Readonly<
      Record<
        | 'price'
        | 'variableCost'
        | 'fixedCosts'
        | 'marketing'
        | 'staff'
        | 'sales'
        | 'capacity'
        | 'churn'
        | 'setupCosts'
        | 'capital'
        | 'runway'
        | 'breakEvenTarget'
        | 'legalForm'
        | 'fundingNeed'
        | 'breakEvenMonth'
        | 'firstYearProfit',
        string
      >
    >;
    readonly sales: Template<'month1' | 'month6' | 'month12'>;
    readonly staffCount: Template<'count'>;
    readonly capital: Template<'min' | 'max'>;
    readonly limitUnbounded: string;
    readonly legalForms: Readonly<Record<'sole' | 'company', string>>;
    readonly notesTitle: string;
    readonly notes: Readonly<Record<EngineNote['code'], string>>;
    readonly parametersCaption: string;
    readonly parameterColumns: Readonly<
      Record<'parameter' | 'value' | 'source' | 'confidence' | 'validated', string>
    >;
    readonly parameters: Readonly<Record<ParamLabelKey, string>>;
    readonly inflationNone: string;
    readonly sourcesIntro: string;
    readonly sourcesCaption: string;
    readonly sourcesColumns: Readonly<Record<'item' | 'source' | 'verified' | 'status', string>>;
    readonly neverVerified: string;
    readonly sourcesNone: string;
    readonly disclaimer: readonly string[];
    readonly notAProbability: string;
  };
}
