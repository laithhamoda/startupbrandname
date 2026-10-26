import { messagesFor } from '@sbn/report/model';
import { goldenProject, goldenReportInput } from '@sbn/report/testing/inputs';
import { completeness, type Gate } from '@sbn/question-bank';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseProject, type ProjectAnalysis } from '@/lib/engine/analyse';
import type { RunSource } from '@/lib/engine/load';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { loadReportPage } from './load';
import { loadProjectResult } from './result';

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
    from: () => ({
      // Awaited as is, the read of the account's subscriptions (D-320): none, so the free package.
      select: () =>
        Object.assign(Promise.resolve({ data: [], error: null }), {
          eq: () => Promise.resolve(result),
        }),
    }),
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

  it('opens the full report to an account that is not on the list while early access is on (D-290)', async () => {
    vi.stubEnv('EARLY_ACCESS_FULL_REPORT', 'true');
    setup('jo-service-subscription', 'full');
    const page = await loadReportPage(client(), 'p', options('someone@example.test'));
    expect(page?.status === 'ready' && page.model.kind).toBe('full');
  });

  it('keeps the summary locked by the plan when early access is off or mistyped', async () => {
    vi.stubEnv('EARLY_ACCESS_FULL_REPORT', 'yes');
    setup('jo-service-subscription', 'full');
    const page = await loadReportPage(client(), 'p', options('someone@example.test'));
    expect(page?.status === 'ready' && page.model.kind).toBe('summary');
    expect(page?.status === 'ready' && page.model.lockReason).toBe('plan');
  });

  it('shows no more than the summary below the full gate, even in early access', async () => {
    vi.stubEnv('EARLY_ACCESS_FULL_REPORT', 'true');
    setup('jo-service-subscription', 'summary');
    const page = await loadReportPage(client(), 'p', options('someone@example.test'));
    expect(page?.status === 'ready' && page.model.kind).toBe('summary');
    expect(page?.status === 'ready' && page.model.lockReason).toBe('completeness');
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

  describe('for the project page (summaryOnly, D-287)', () => {
    const summaryOnly = (email: string | null) => ({ ...options(email), summaryOnly: true });

    it('gives an account that may open the full report the summary, and reads no pack', async () => {
      vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', OWNER);
      setup('jo-service-subscription', 'full');
      // Only the account's subscriptions are read (D-313, D-320), never the country pack.
      const from = vi.fn(() => ({
        select: () => Promise.resolve({ data: [], error: null }),
      }));
      const page = await loadReportPage(
        { from } as unknown as SupabaseServerClient,
        'p',
        summaryOnly(OWNER),
      );
      if (page?.status !== 'ready') throw new Error('expected a page');
      expect(page.model.kind).toBe('summary');
      expect(page.model.sections[0]?.id).toBe('verdict');
      expect(from.mock.calls).toEqual([['subscriptions']]);
    });

    it('searches for changes for a stop only, as the free summary does', async () => {
      vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', OWNER);
      setup('jo-service-subscription', 'full');
      const revise = await loadReportPage(client(), 'p', summaryOnly(OWNER));
      expect(JSON.stringify(revise)).not.toContain(changesCaption('revise'));

      setup('jo-home-ecommerce', 'full');
      const stop = await loadReportPage(client(), 'p', summaryOnly(OWNER));
      if (stop?.status !== 'ready') throw new Error('expected a page');
      const table = stop.model.sections[0]?.blocks.find((block) => block.type === 'table');
      expect(table?.type === 'table' ? table.rows : []).toHaveLength(3);
    });

    it('changes nothing for an account that may only open the summary', async () => {
      setup('jo-service-subscription', 'full');
      const page = await loadReportPage(client(), 'p', summaryOnly('someone@example.test'));
      expect(page?.status === 'ready' && page.model.lockReason).toBe('plan');
    });

    it('still has no page below the summary gate', async () => {
      setup('jo-service-subscription', 'none');
      const page = await loadReportPage(client(), 'p', summaryOnly(OWNER));
      expect(page?.status).toBe('none');
    });

    // The result the project page draws, through the real loader (D-286): what crosses to the page
    // for an account that may open the full report is the verdict section and nothing else.
    it('gives the project page the verdict section alone, never a full or a locked section', async () => {
      vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', OWNER);
      setup('jo-service-subscription', 'full');
      const result = await loadProjectResult(client(), 'p', { ...options(OWNER), gate: 'full' });
      if (result.status !== 'verdict') throw new Error(`expected a verdict, got ${result.status}`);
      expect(result.section.id).toBe('verdict');
      expect(result.section.blocks.map((block) => block.type)).toEqual(['verdict']);
      expect(JSON.stringify(result)).not.toContain(changesCaption('revise'));
    });

    it('keeps the three changes of a stop on the project page', async () => {
      setup('jo-home-ecommerce', 'full');
      const result = await loadProjectResult(client(), 'p', {
        ...options('someone@example.test'),
        gate: 'full',
      });
      if (result.status !== 'verdict') throw new Error(`expected a verdict, got ${result.status}`);
      const table = result.section.blocks.find((block) => block.type === 'table');
      expect(table?.type === 'table' ? table.rows : []).toHaveLength(3);
    });

    it('lists the reasons for the project page when the numbers cannot be calculated', async () => {
      const reasons = [{ code: 'missing_answer' as const, questionId: 'F3' as const }];
      setup('jo-service-subscription', 'full', { outcome: { status: 'not_calculable', reasons } });
      const result = await loadProjectResult(client(), 'p', { ...options(OWNER), gate: 'full' });
      expect(result).toEqual({ status: 'needs_answers', reasons });
    });
  });
});

describe('loadReportPage: report versions of a paid project (D-321, D-323)', () => {
  const PROJECT = 'p';
  const HASH = 'a'.repeat(64);
  const commander = {
    plan_id: 'commander',
    status: 'active',
    starts_at: '2026-10-01T00:00:00Z',
    ends_at: '2027-10-01T00:00:00Z',
    project_id: PROJECT,
  };
  const version = (number: number, inputHash: string, verdict = 'revise') => ({
    number,
    verdict,
    input_hash: inputHash,
    created_at: '2026-10-11T10:00:00Z',
  });

  /** A client with a paid project, its versions and its final version. */
  function paid(versions: readonly object[], final: number | null = null) {
    return {
      from: (table: string) => ({
        select: () => {
          if (table === 'subscriptions') return Promise.resolve({ data: [commander], error: null });
          if (table === 'report_versions') {
            return { eq: () => Promise.resolve({ data: versions, error: null }) };
          }
          if (table === 'projects') {
            return {
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { final_version: final }, error: null }),
              }),
            };
          }
          return { eq: () => Promise.resolve({ data: [], error: null }) };
        },
      }),
    } as unknown as SupabaseServerClient;
  }

  it('asks for the first version before a paid report is shown', async () => {
    setup('jo-service-subscription', 'full', { inputHash: HASH });
    const page = await loadReportPage(paid([]), PROJECT, options(OWNER));
    expect(page).toEqual({ status: 'version_needed', next: 1, left: 10, versions: [] });
  });

  it('shows the report of answers that match a version, with the versions left', async () => {
    setup('jo-service-subscription', 'full', { inputHash: HASH });
    const page = await loadReportPage(
      paid([version(1, 'b'.repeat(64)), version(2, HASH, 'go')]),
      PROJECT,
      options(OWNER),
    );
    expect(page?.status).toBe('ready');
    if (page?.status !== 'ready') return;
    expect(page.model.kind).toBe('full');
    expect(page.version).toMatchObject({ number: 2, left: 5, final: false });
    expect(page.version?.versions.map((item) => item.number)).toEqual([1, 2]);
  });

  it('asks for the next version after the answers changed, and says none is left at the limit', async () => {
    setup('jo-service-subscription', 'full', { inputHash: HASH });
    const ten = Array.from({ length: 10 }, (_, index) =>
      version(index + 1, String(index).repeat(64)),
    );
    const page = await loadReportPage(paid(ten), PROJECT, options(OWNER));
    expect(page).toMatchObject({ status: 'version_needed', next: 11, left: 0 });
  });

  it('shows the final version of a closed project', async () => {
    setup('jo-service-subscription', 'full', { inputHash: HASH });
    const page = await loadReportPage(paid([version(1, HASH)], 1), PROJECT, options(OWNER));
    expect(page?.status === 'ready' ? page.version : null).toMatchObject({
      number: 1,
      left: 0,
      final: true,
    });
  });

  it('keeps the project page on its summary, whatever the versions', async () => {
    setup('jo-service-subscription', 'full', { inputHash: HASH });
    const page = await loadReportPage(paid([]), PROJECT, { ...options(OWNER), summaryOnly: true });
    expect(page?.status === 'ready' ? [page.model.kind, page.version] : null).toEqual([
      'summary',
      null,
    ]);
  });
});
