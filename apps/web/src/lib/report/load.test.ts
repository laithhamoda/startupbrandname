import { messagesFor } from '@sbn/report/model';
import { goldenProject, goldenReportInput } from '@sbn/report/testing/inputs';
import { completeness, type Gate } from '@sbn/question-bank';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseProject, type ProjectAnalysis } from '@/lib/engine/analyse';
import type { RunSource } from '@/lib/engine/load';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { loadReportPage } from './load';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/engine/analyse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/engine/analyse')>()),
  analyseProject: vi.fn(),
}));
vi.mock('@sbn/question-bank', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sbn/question-bank')>()),
  completeness: vi.fn(),
}));

type Name = 'jo-service-subscription' | 'jo-home-ecommerce' | 'dz-auto-entrepreneur';

const OWNER = 'owner@example.test';
const now = new Date('2026-10-12T10:00:00Z');
const words = messagesFor('en');

/** A supabase stand-in that answers the pack query with the given result. */
function client(result: { data: unknown[]; error: unknown } = { data: [], error: null }) {
  return {
    from: () => ({ select: () => ({ eq: () => Promise.resolve(result) }) }),
  } as unknown as SupabaseServerClient;
}

function analysisOf(name: Name, over: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  const input = goldenReportInput(name, { locale: 'en', kind: 'full' });
  const project = goldenProject(name);
  const source: RunSource = {
    project: {
      id: '6f1c1f1e-7d4b-4c55-9a51-0f6f5d2b9e10',
      title: input.project.title,
      countryCode: input.project.countryCode,
      currency: input.project.currency,
      mode: 'full',
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    },
    answers: input.answers,
    provenance: input.provenance,
    taxRules: project.tax.rules,
    taxRulesRead: true,
  };
  const outcome =
    input.run === null ? { status: 'failed' as const } : { status: 'ok' as const, run: input.run };
  return { source, outcome, inputHash: 'hash-1', recorded: 'skipped', ...over };
}

function setup(name: Name, gate: Gate, over: Partial<ProjectAnalysis> = {}) {
  vi.mocked(analyseProject).mockResolvedValue(analysisOf(name, over));
  vi.mocked(completeness).mockReturnValue({
    score: 0.5,
    gate,
    next: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
  } as unknown as ReturnType<typeof completeness>);
}

const options = (email: string | null) => ({
  email,
  locale: 'en' as const,
  currencyLabel: (code: string) => code,
  now,
});

const changesCaption = (kind: 'revise' | 'stop') => words.executive.changesCaption[kind];

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('loadReportPage (D-273)', () => {
  it('is null for a project that is not the account', async () => {
    vi.mocked(analyseProject).mockResolvedValue(null);
    expect(await loadReportPage(client(), 'p', options(OWNER))).toBeNull();
  });

  it('shows no report below the summary gate, only the questions to answer', async () => {
    setup('jo-service-subscription', 'none');
    const page = await loadReportPage(client(), 'p', options(OWNER));
    expect(page?.status).toBe('none');
    expect(page?.status === 'none' ? page.missing : []).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
    expect(page?.status === 'none' ? page.percent : -1).toBeGreaterThanOrEqual(0);
  });

  it('builds the full report for an account on the preview list, with the changes of a revise', async () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', 'Owner@Example.Test');
    setup('jo-service-subscription', 'full');
    const page = await loadReportPage(client(), 'p', options(OWNER));
    expect(page?.status).toBe('ready');
    if (page?.status !== 'ready') return;
    expect(page.model.kind).toBe('full');
    expect(page.model.lockReason).toBeNull();
    expect(page.notice).toBeNull();
    expect(JSON.stringify(page.model)).toContain(changesCaption('revise'));
  });

  it('does not search for changes for a go', async () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', OWNER);
    setup('dz-auto-entrepreneur', 'full');
    const page = await loadReportPage(client(), 'p', options(OWNER));
    expect(page?.status === 'ready' && page.model.kind).toBe('full');
    expect(JSON.stringify(page)).not.toContain(words.executive.changesCaption.revise);
  });

  it('gives an account that is not on the list the summary locked by the plan, with no revise changes', async () => {
    setup('jo-service-subscription', 'full');
    const page = await loadReportPage(client(), 'p', options('someone@example.test'));
    expect(page?.status).toBe('ready');
    if (page?.status !== 'ready') return;
    expect(page.model.kind).toBe('summary');
    expect(page.model.lockReason).toBe('plan');
    expect(JSON.stringify(page.model)).not.toContain(changesCaption('revise'));
  });

  it('shows a stop in the free summary with its three changes (D-278)', async () => {
    setup('jo-home-ecommerce', 'full');
    const page = await loadReportPage(client(), 'p', options('someone@example.test'));
    if (page?.status !== 'ready') throw new Error('expected a page');
    const verdict = page.model.sections[0];
    expect(verdict?.id).toBe('verdict');
    const table = verdict?.blocks.find((block) => block.type === 'table');
    expect(table?.type === 'table' ? table.rows : []).toHaveLength(3);
  });

  it('locks the rest of the summary by the answers when they are not complete enough', async () => {
    setup('jo-service-subscription', 'summary');
    const page = await loadReportPage(client(), 'p', options(OWNER));
    expect(page?.status === 'ready' && page.model.lockReason).toBe('completeness');
  });

  it('falls back to the summary when the numbers cannot be calculated, and says why', async () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', OWNER);
    setup('jo-service-subscription', 'full', {
      outcome: {
        status: 'not_calculable',
        reasons: [{ code: 'missing_answer', questionId: 'F3' }],
      },
    });
    const page = await loadReportPage(client(), 'p', options(OWNER));
    if (page?.status !== 'ready') throw new Error('expected a page');
    expect(page.model.kind).toBe('summary');
    expect(page.model.lockReason).toBe('completeness');
    expect(page.notice).toEqual({
      kind: 'not_calculable',
      reasons: [{ code: 'missing_answer', questionId: 'F3' }],
    });
    expect(page.model.sections.some((section) => section.id === 'verdict')).toBe(false);
  });

  it('keeps the page when the engine failed, with a notice', async () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', OWNER);
    setup('jo-service-subscription', 'full', { outcome: { status: 'failed' } });
    const page = await loadReportPage(client(), 'p', options(OWNER));
    expect(page?.status === 'ready' && page.notice).toEqual({ kind: 'failed' });
  });

  it('reports a failed page, logged, when the model cannot be built', async () => {
    const analysis = analysisOf('jo-service-subscription');
    setup('jo-service-subscription', 'full', {
      source: { ...analysis.source, project: { ...analysis.source.project, currency: 'USD' } },
    });
    expect(await loadReportPage(client(), 'p', options(OWNER))).toEqual({ status: 'failed' });
    expect(log.error).toHaveBeenCalledWith('report.model_failed', expect.anything());
  });

  it('logs a malformed preview list and previews nobody', async () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', 'owner@');
    setup('jo-service-subscription', 'full');
    const page = await loadReportPage(client(), 'p', options(OWNER));
    expect(page?.status === 'ready' && page.model.kind).toBe('summary');
    expect(log.warn).toHaveBeenCalledWith('report.preview_list_invalid', { projectId: 'p' });
  });

  it('reads the pack of the full report, skipping and logging a row that does not fit', async () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', OWNER);
    setup('jo-service-subscription', 'full');
    const good = {
      country_code: 'JO',
      key: 'registration.sole.body',
      value: {
        name: { ar: 'تسجيل مؤسسة فردية', en: 'Sole proprietorship registration' },
        description: { ar: 'وصف.', en: 'A description.' },
      },
      source_url: 'https://example.invalid/jo/registration',
      last_verified: '2026-10-01',
      status: 'verified',
    };
    const page = await loadReportPage(
      client({ data: [good, { ...good, status: 'invented' }], error: null }),
      'p',
      options(OWNER),
    );
    expect(page?.status).toBe('ready');
    expect(log.warn).toHaveBeenCalledWith('report.pack_unreadable', { projectId: 'p', count: 1 });
  });

  it('goes on with an empty legal path when the pack cannot be read', async () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', OWNER);
    setup('jo-service-subscription', 'full');
    const page = await loadReportPage(
      client({ data: [], error: { message: 'down', code: '500' } }),
      'p',
      options(OWNER),
    );
    expect(page?.status).toBe('ready');
    expect(log.warn).toHaveBeenCalledWith(
      'report.pack_unavailable',
      expect.objectContaining({ projectId: 'p' }),
    );
  });
});
