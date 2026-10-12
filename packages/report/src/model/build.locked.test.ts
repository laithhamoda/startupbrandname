import { describe, expect, it, vi } from 'vitest';

/*
 * The builder of a locked section must never run (D-232, D-268): the summary is built with every
 * builder of a locked section replaced by one that throws. If the summary still builds, none ran.
 */
const lockedBuilder = vi.hoisted(() => vi.fn(() => ({ called: true })));

function refuse(name: string): () => never {
  return () => {
    lockedBuilder();
    throw new Error(`${name} ran for a locked section`);
  };
}

vi.mock('./sections/cover', () => ({ buildCover: refuse('cover') }));
vi.mock('./sections/executive', () => ({
  buildExecutiveSummary: refuse('executive_summary'),
  KEY_NUMBER_ORDER: {},
}));
vi.mock('./sections/canvases', () => ({ buildCanvases: refuse('canvases') }));
vi.mock('./sections/pricing', () => ({ buildPricing: refuse('pricing_unit_economics') }));
vi.mock('./sections/projection', () => ({ buildProjection: refuse('projection') }));
vi.mock('./sections/scenarios', () => ({ buildScenarios: refuse('scenarios_sensitivity') }));
vi.mock('./sections/legal', () => ({ buildLegalPath: refuse('legal_path_financing') }));
vi.mock('./sections/validation', () => ({ buildValidationPlan: refuse('validation_plan') }));
vi.mock('./sections/appendix', () => ({
  buildAssumptions: refuse('appendix_assumptions'),
  buildSources: refuse('appendix_sources'),
  buildDisclaimer: refuse('appendix_disclaimer'),
}));

const { buildReportModel } = await import('./build');
const { goldenReportInput } = await import('../testing/report-inputs');

describe('the builders of locked sections', () => {
  it('never run when the summary is built, even from a calculable run', () => {
    const model = buildReportModel(
      goldenReportInput('jo-service-subscription', { locale: 'ar', kind: 'summary' }),
    );
    expect(model.sections.filter((section) => section.locked)).toHaveLength(11);
    expect(lockedBuilder).not.toHaveBeenCalled();
  });

  it('would have run for the full report (the guard works)', () => {
    expect(() =>
      buildReportModel(goldenReportInput('jo-service-subscription', { locale: 'ar' })),
    ).toThrow('ran for a locked section');
    expect(lockedBuilder).toHaveBeenCalled();
  });
});
