import type { EngineRun } from '@sbn/engine';
import { valueOf, type Answers } from '@sbn/question-bank';
import { isIsoDate } from '../legal-path';
import { Ctx } from './context';
import { buildCanvases } from './sections/canvases';
import { buildProjectCard } from './sections/card';
import { buildCover } from './sections/cover';
import { buildExecutiveSummary } from './sections/executive';
import { buildLegalPath } from './sections/legal';
import { buildAssumptions, buildDisclaimer, buildSources } from './sections/appendix';
import { buildPricing } from './sections/pricing';
import { buildProjection } from './sections/projection';
import { buildScenarios } from './sections/scenarios';
import { callout, hasLowConfidence } from './sections/shared';
import { buildBreakEven, buildTopRisks } from './sections/summary';
import { buildValidationPlan } from './sections/validation';
import { plain } from './inline';
import {
  FULL_SECTION_IDS,
  ReportModelError,
  type Audience,
  type Block,
  type ConfidenceMeta,
  type FullSectionId,
  type ReportInput,
  type ReportMeta,
  type ReportModel,
  type Section,
  type SectionId,
} from './types';

/**
 * Reads H8 ("who will this report be shown to?") as the audience of the report (D-236). `self`
 * when the question is unanswered, «لا أعرف», or holds a value this version does not know.
 */
export function audienceOfAnswers(answers: Answers): Audience {
  switch (valueOf(answers, 'H8', 'single')) {
    case 'investor':
      return 'investor';
    case 'bank':
      return 'bank';
    case 'grant_body':
      return 'grant';
    case 'course':
      return 'course';
    default:
      return 'self';
  }
}

function validate(input: ReportInput): void {
  if (!isIsoDate(input.today)) {
    throw new ReportModelError('invalid_date', 'today must be a YYYY-MM-DD date.');
  }
  if (input.kind === 'full') {
    if (input.run === null) {
      throw new ReportModelError('run_required', 'The full report needs a calculable run.');
    }
    if (input.lockReason !== null) {
      throw new ReportModelError(
        'lock_reason_unexpected',
        'The full report has no locked section.',
      );
    }
  } else if (input.lockReason === null) {
    throw new ReportModelError(
      'lock_reason_required',
      'The summary needs the reason it is locked.',
    );
  }
  if (input.run !== null && input.run.input.currency !== input.project.currency) {
    throw new ReportModelError(
      'currency_mismatch',
      'The run and the project differ in currency: the report never converts.',
    );
  }
}

function confidenceMeta(run: EngineRun | null): ConfidenceMeta | null {
  if (run === null) return null;
  return {
    level: run.confidence.level.value,
    sound: run.confidence.sound,
    pivotal: run.confidence.pivotal.map((figure) => ({
      id: figure.id,
      level: figure.level.value,
      sound: figure.sound,
    })),
  };
}

function metaOf(input: ReportInput): ReportMeta {
  return {
    title: input.project.title,
    countryCode: input.project.countryCode,
    currencyLabel: input.project.currencyLabel,
    issuedOn: input.today,
    engineVersion: input.run === null ? null : input.run.engineVersion,
    inputHash: input.inputHash ?? null,
    completeness: { percent: input.completeness.percent, gate: input.completeness.gate },
    confidence: confidenceMeta(input.run),
  };
}

/** The sentence about low-confidence pivotal figures, once at the end of a section that shows one. */
function closed(ctx: Ctx, blocks: Block[]): Block[] {
  return hasLowConfidence(blocks)
    ? [...blocks, callout('low_confidence', plain(ctx.m.lowConfidence))]
    : blocks;
}

function open(ctx: Ctx, id: SectionId, blocks: Block[]): Section {
  return { id, title: ctx.m.sections[id], locked: false, blocks: closed(ctx, blocks) };
}

function locked(ctx: Ctx, id: SectionId): Section {
  return { id, title: ctx.m.sections[id], locked: true, blocks: [] };
}

/** Builds each section in reading order, so the term tracker sees the report as a reader does. */
function fullSections(ctx: Ctx, run: EngineRun): Section[] {
  const builders: Readonly<Record<FullSectionId, () => Block[]>> = {
    cover: () => buildCover(ctx, run),
    executive_summary: () => buildExecutiveSummary(ctx, run, ctx.input.changes),
    project_card: () => buildProjectCard(ctx),
    canvases: () => buildCanvases(ctx, run),
    pricing_unit_economics: () => buildPricing(ctx, run),
    projection: () => buildProjection(ctx, run),
    scenarios_sensitivity: () => buildScenarios(ctx, run),
    legal_path_financing: () => buildLegalPath(ctx, run),
    validation_plan: () => buildValidationPlan(ctx, run),
    appendix_assumptions: () => buildAssumptions(ctx, run),
    appendix_sources: () => buildSources(ctx),
    appendix_disclaimer: () => buildDisclaimer(ctx),
  };
  return FULL_SECTION_IDS.map((id) => open(ctx, id, builders[id]()));
}

/**
 * The one-page summary (SPEC section 6): the project card, the three risks and the break-even
 * estimate are real; every other section is a locked title with no blocks, and the builder of a
 * locked section never runs, so no locked value is computed into the model (D-232, D-268).
 */
function summarySections(ctx: Ctx): Section[] {
  return [
    open(ctx, 'project_card', buildProjectCard(ctx)),
    open(ctx, 'top_risks', buildTopRisks(ctx)),
    open(ctx, 'break_even', buildBreakEven(ctx)),
    ...FULL_SECTION_IDS.filter((id) => id !== 'project_card').map((id) => locked(ctx, id)),
  ];
}

/**
 * Builds the report as data (D-267). Pure and deterministic: the same input gives a deeply equal
 * model, and nothing here reads a clock, a random number or the network. The caller decides the
 * `kind` and the `lockReason` from the gate and the entitlement. Throws a `ReportModelError` for an
 * input that cannot make the report it asked for.
 */
export function buildReportModel(input: ReportInput): ReportModel {
  validate(input);
  const ctx = new Ctx(input);
  const { run } = input;
  const sections =
    input.kind === 'full' && run !== null ? fullSections(ctx, run) : summarySections(ctx);
  return {
    version: 1,
    locale: input.locale,
    kind: input.kind,
    lockReason: input.lockReason,
    audience: input.audience,
    meta: metaOf(input),
    sections,
  };
}
