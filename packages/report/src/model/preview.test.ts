import { describe, expect, it, vi } from 'vitest';

/*
 * The preview a visitor without an account reads (D-335, D-356): the first four sections, the others locked
 * titles whose builders never run (D-232), and no verdict anywhere in what the model holds.
 */
const ran = vi.hoisted(() => vi.fn());

function refuse(name: string): () => never {
  return () => {
    ran(name);
    throw new Error(`${name} ran for a locked section`);
  };
}

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
const { FULL_SECTION_IDS, PREVIEW_OPEN_SECTION_IDS, ReportModelError } = await import('./types');

const SAMPLES = ['jo-service-subscription', 'jo-home-ecommerce', 'dz-auto-entrepreneur'] as const;

describe.each(SAMPLES)('the visitor preview of %s', (sample) => {
  const base = goldenReportInput(sample, { locale: 'ar', kind: 'preview', lockReason: 'account' });
  const model = buildReportModel(base);

  it('has every section of the full report, in order, for the account reason', () => {
    expect(model.kind).toBe('preview');
    expect(model.lockReason).toBe('account');
    expect(model.sections.map((section) => section.id)).toEqual([...FULL_SECTION_IDS]);
  });

  it('opens the first four of the twelve sections and locks the other eight, without running them', () => {
    const open = model.sections.filter((section) => !section.locked).map((section) => section.id);
    expect(open).toEqual([...PREVIEW_OPEN_SECTION_IDS]);
    expect(open.length / FULL_SECTION_IDS.length).toBeLessThanOrEqual(0.4);
    for (const section of model.sections.filter((s) => s.locked)) {
      expect(section.blocks, section.id).toEqual([]);
    }
    for (const section of model.sections.filter((s) => !s.locked)) {
      expect(section.blocks.length, section.id).toBeGreaterThan(0);
    }
    expect(ran).not.toHaveBeenCalled();
  });

  it('holds no verdict: no verdict block, no table of what blocks Go, no suggested changes', () => {
    const blocks = model.sections.flatMap((section) => section.blocks);
    expect(blocks.some((block) => block.type === 'verdict')).toBe(false);
    const text = JSON.stringify(model);
    expect(text).not.toContain('"verdict"');
    expect(text).not.toMatch(/امضِ|عدّل|توقّف|غير قابل للتنفيذ/);
  });

  it('keeps the three key numbers in the executive summary', () => {
    const summary = model.sections.find((section) => section.id === 'executive_summary');
    expect(summary?.blocks.some((block) => block.type === 'keyNumbers')).toBe(true);
  });

  it('needs a calculable run and the account as the reason for its locks', () => {
    expect(() => buildReportModel({ ...base, run: null })).toThrow(ReportModelError);
    expect(() => buildReportModel({ ...base, lockReason: null })).toThrow(ReportModelError);
    expect(() => buildReportModel({ ...base, lockReason: 'plan' })).toThrow(ReportModelError);
  });
});
