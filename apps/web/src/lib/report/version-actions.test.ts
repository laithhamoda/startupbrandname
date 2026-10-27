import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireAccount } from '@/lib/auth/session';
import { analyseProject, type ProjectAnalysis } from '@/lib/engine/analyse';
import { log } from '@/lib/log';
import { chooseFinalVersion, makeReportVersion } from './version-actions';

vi.mock('@/lib/auth/session', () => ({ requireAccount: vi.fn() }));
vi.mock('@/lib/engine/analyse', () => ({ analyseProject: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const ID = 'ab100000-0000-4000-8000-000000000001';
const REPORT = `/en/projects/${ID}/report`;
const HASH = 'a'.repeat(64);

/** A client whose RPC answers `result`. */
function account(result: { error: { code: string } | null } = { error: null }) {
  const rpc = vi.fn(() => Promise.resolve({ data: 1, ...result }));
  vi.mocked(requireAccount).mockResolvedValue({
    supabase: { rpc },
    user: { id: 'u', email: 'founder@example.test' },
  } as unknown as Awaited<ReturnType<typeof requireAccount>>);
  return rpc;
}

function analysis(status: 'ok' | 'failed' = 'ok') {
  vi.mocked(analyseProject).mockResolvedValue({
    inputHash: HASH,
    outcome:
      status === 'ok'
        ? { status: 'ok', run: { verdict: { verdict: { value: 'go' } } } }
        : { status: 'failed' },
  } as unknown as ProjectAnalysis);
}

/** Runs an action and returns the address of the redirect it throws. */
async function target(run: () => Promise<void>): Promise<string> {
  const error: unknown = await run().then(
    () => null,
    (thrown: unknown) => thrown,
  );
  const digest = (error as { digest?: string } | null)?.digest ?? '';
  return digest.split(';')[2] ?? '';
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('makeReportVersion (D-321)', () => {
  it('records the version of the answers the server analysed, then shows the report', async () => {
    const rpc = account();
    analysis();
    expect(await target(() => makeReportVersion('en', ID))).toBe(REPORT);
    expect(rpc).toHaveBeenCalledWith('record_report_version', {
      p_project_id: ID,
      p_input_hash: HASH,
      p_verdict: 'go',
    });
  });

  it('says when no version is left, or the project is closed', async () => {
    analysis();
    account({ error: { code: 'SB002' } });
    expect(await target(() => makeReportVersion('en', ID))).toBe(`${REPORT}?version=none_left`);
    account({ error: { code: 'SB003' } });
    expect(await target(() => makeReportVersion('en', ID))).toBe(`${REPORT}?version=closed`);
  });

  it('records nothing when the numbers cannot be calculated', async () => {
    const rpc = account();
    analysis('failed');
    expect(await target(() => makeReportVersion('en', ID))).toBe(`${REPORT}?version=failed`);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('logs any other refusal', async () => {
    analysis();
    account({ error: { code: '42501' } });
    expect(await target(() => makeReportVersion('en', ID))).toBe(`${REPORT}?version=failed`);
    expect(log.error).toHaveBeenCalledWith('report.version_failed', {
      code: '42501',
      projectId: ID,
    });
  });

  it('logs a thrown error', async () => {
    vi.mocked(requireAccount).mockRejectedValue(new TypeError('down'));
    expect(await target(() => makeReportVersion('en', ID))).toBe(`${REPORT}?version=failed`);
    expect(log.error).toHaveBeenCalled();
  });
});

describe('chooseFinalVersion (D-321)', () => {
  it('keeps the chosen version once the founder confirmed', async () => {
    const rpc = account();
    expect(
      await target(() => chooseFinalVersion('en', ID, form({ number: '2', confirm: 'on' }))),
    ).toBe(REPORT);
    expect(rpc).toHaveBeenCalledWith('choose_final_version', { p_project_id: ID, p_number: 2 });
  });

  it('asks for the confirmation and a version first', async () => {
    const rpc = account();
    expect(await target(() => chooseFinalVersion('en', ID, form({ number: '2' })))).toBe(
      `${REPORT}?version=confirm`,
    );
    expect(await target(() => chooseFinalVersion('en', ID, form({ confirm: 'on' })))).toBe(
      `${REPORT}?version=confirm`,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('says when the project is already closed, and logs any other refusal', async () => {
    account({ error: { code: 'SB003' } });
    expect(
      await target(() => chooseFinalVersion('en', ID, form({ number: '1', confirm: 'on' }))),
    ).toBe(`${REPORT}?version=closed`);
    account({ error: { code: '22023' } });
    expect(
      await target(() => chooseFinalVersion('en', ID, form({ number: '1', confirm: 'on' }))),
    ).toBe(`${REPORT}?version=failed`);
    expect(log.error).toHaveBeenCalledWith('report.final_failed', { code: '22023', projectId: ID });
  });

  it('logs a thrown error', async () => {
    vi.mocked(requireAccount).mockRejectedValue(new TypeError('down'));
    expect(
      await target(() => chooseFinalVersion('en', ID, form({ number: '1', confirm: 'on' }))),
    ).toBe(`${REPORT}?version=failed`);
  });
});
