import { buildReportModel, type ReportModel } from '@sbn/report/model';
import { drop, goldenReportInput } from '@sbn/report/testing/inputs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { loadReportPage, type ReportPage } from './load';
import { loadProjectResult } from './result';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./load', () => ({ loadReportPage: vi.fn() }));

const supabase = {} as SupabaseServerClient;
const options = {
  email: 'owner@example.test',
  locale: 'en' as const,
  currencyLabel: (code: string) => code,
};

function summaryModel(withoutRun = false): ReportModel {
  return buildReportModel(
    goldenReportInput('jo-service-subscription', {
      locale: 'en',
      kind: 'summary',
      lockReason: 'completeness',
      ...(withoutRun
        ? {
            withoutRun: [{ code: 'missing_answer' as const, questionId: 'F3' as const }],
            change: (answers: Parameters<typeof drop>[0]) => {
              drop(answers, 'F3', 'F4', 'F5', 'F6', 'D4', 'E8');
            },
          }
        : {}),
    }),
  );
}

const given = (page: ReportPage | null) => vi.mocked(loadReportPage).mockResolvedValue(page);

afterEach(() => {
  vi.clearAllMocks();
});

describe('loadProjectResult (D-286)', () => {
  it('asks the report loader for the summary alone, for this account', async () => {
    given({ status: 'none', percent: 10, missing: [] });
    await loadProjectResult(supabase, 'p', options);
    expect(loadReportPage).toHaveBeenCalledWith(supabase, 'p', {
      ...options,
      summaryOnly: true,
    });
  });

  it('has no result below the summary gate', async () => {
    given({ status: 'none', percent: 10, missing: [] });
    expect(await loadProjectResult(supabase, 'p', options)).toEqual({ status: 'none' });
  });

  it('gives the verdict section of the summary when the numbers were calculated', async () => {
    given({ status: 'ready', model: summaryModel(), notice: null });
    const result = await loadProjectResult(supabase, 'p', options);
    if (result.status !== 'verdict') throw new Error(`expected a verdict, got ${result.status}`);
    expect(result.section.id).toBe('verdict');
    expect(result.section.locked).toBe(false);
    expect(result.section.blocks[0]?.type).toBe('verdict');
  });

  it('gives the reasons when the answers are enough but the numbers cannot be calculated', async () => {
    const reasons = [{ code: 'unknown_answer' as const, questionId: 'F3' as const }];
    given({
      status: 'ready',
      model: summaryModel(true),
      notice: { kind: 'not_calculable', reasons },
    });
    expect(await loadProjectResult(supabase, 'p', options)).toEqual({
      status: 'needs_answers',
      reasons,
    });
  });

  it('fails softly when the engine failed, with no verdict to show', async () => {
    given({ status: 'ready', model: summaryModel(true), notice: { kind: 'failed' } });
    expect(await loadProjectResult(supabase, 'p', options)).toEqual({ status: 'failed' });
  });

  it('fails softly when the report page could not be built or is not the account', async () => {
    given({ status: 'failed' });
    expect(await loadProjectResult(supabase, 'p', options)).toEqual({ status: 'failed' });
    given(null);
    expect(await loadProjectResult(supabase, 'p', options)).toEqual({ status: 'failed' });
  });

  it('never throws into the project page: a throw is logged and the page goes on', async () => {
    vi.mocked(loadReportPage).mockRejectedValue(new Error('database down'));
    expect(await loadProjectResult(supabase, 'p', options)).toEqual({ status: 'failed' });
    expect(log.error).toHaveBeenCalledWith(
      'project.result_failed',
      expect.objectContaining({ projectId: 'p' }),
    );
  });
});
