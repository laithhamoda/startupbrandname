import { describe, expect, it, vi } from 'vitest';

/*
 * The «متردد» report (D-314, D-316): the builders of the three sections it keeps locked must never
 * run, so their values are never computed into the model (D-232). They throw here; the others run.
 */
const ran = vi.hoisted(() => vi.fn());

function refuse(name: string): () => never {
  return () => {
    ran(name);
    throw new Error(`${name} ran for a locked section`);
  };
}

vi.mock('./sections/canvases', () => ({ buildCanvases: refuse('canvases') }));
vi.mock('./sections/scenarios', () => ({ buildScenarios: refuse('scenarios_sensitivity') }));
vi.mock('./sections/validation', () => ({ buildValidationPlan: refuse('validation_plan') }));

const { buildReportModel } = await import('./build');
const { goldenReportInput } = await import('../testing/report-inputs');
const { FULL_SECTION_IDS, ReportModelError, STANDARD_LOCKED_SECTION_IDS } = await import('./types');

describe('the «متردد» report', () => {
  const model = buildReportModel(
    goldenReportInput('jo-service-subscription', {
      locale: 'ar',
      kind: 'standard',
      lockReason: 'plan',
    }),
  );

  it('has every section of the full report, in order', () => {
    expect(model.kind).toBe('standard');
    expect(model.lockReason).toBe('plan');
    expect(model.sections.map((section) => section.id)).toEqual([...FULL_SECTION_IDS]);
  });

  it('locks the canvases, the scenarios and the validation plan, without running them', () => {
    const lockedIds = model.sections
      .filter((section) => section.locked)
      .map((section) => section.id);
    expect(lockedIds).toEqual([...STANDARD_LOCKED_SECTION_IDS]);
    for (const section of model.sections.filter((s) => s.locked))
      expect(section.blocks).toEqual([]);
    expect(ran).not.toHaveBeenCalled();
  });

  it('opens the numbers, the legal path and the appendices that give their provenance', () => {
    const openIds = model.sections
      .filter((section) => !section.locked)
      .map((section) => section.id);
    for (const id of [
      'executive_summary',
      'pricing_unit_economics',
      'projection',
      'legal_path_financing',
      'appendix_assumptions',
      'appendix_sources',
    ] as const) {
      expect(openIds).toContain(id);
    }
    for (const section of model.sections.filter((s) => !s.locked)) {
      expect(section.blocks.length, section.id).toBeGreaterThan(0);
    }
  });

  it('needs a calculable run and the plan as the reason for its locks', () => {
    const base = goldenReportInput('jo-service-subscription', { locale: 'ar', kind: 'standard' });
    expect(() => buildReportModel({ ...base, run: null })).toThrow(ReportModelError);
    expect(() => buildReportModel({ ...base, lockReason: null })).toThrow(ReportModelError);
    expect(() => buildReportModel({ ...base, lockReason: 'completeness' })).toThrow(
      ReportModelError,
    );
  });
});
