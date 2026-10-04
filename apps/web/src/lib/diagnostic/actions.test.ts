import type { ReviewOutput } from '@sbn/ai';
import type { Answers } from '@sbn/question-bank';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewWithAi } from '@/lib/ai/service';
import { requireAccount } from '@/lib/auth/session';
import { log } from '@/lib/log';
import { deleteProject, saveAnswer, type SaveInput, switchMode } from './actions';
import { loadProject } from './project';

vi.mock('@/lib/auth/session', () => ({ requireAccount: vi.fn() }));
vi.mock('@/lib/ai/service', () => ({ reviewWithAi: vi.fn() }));
vi.mock('./project', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./project')>()),
  loadProject: vi.fn(),
}));
vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
// Messages come back as their key, followed by their values when they have some.
vi.mock('next-intl/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
    ),
}));

const projectId = '6f1c1f1e-7d4b-4c55-9a51-0f6f5d2b9e10';
const project = {
  id: projectId,
  title: 'صيانة مكيّفات المطاعم',
  countryCode: 'JO',
  currency: 'JOD',
  mode: 'full' as const,
  createdAt: '2026-09-28T10:00:00Z',
  updatedAt: '2026-09-28T10:00:00Z',
};

/** A Supabase client that records the answer writes and returns the given results. */
function fakeClient(results: { upsert?: unknown; delete?: unknown } = {}) {
  const writes = {
    upsert: vi.fn<(row: unknown) => Promise<unknown>>(() =>
      Promise.resolve(results.upsert ?? { error: null }),
    ),
    deleted: vi.fn<(ids: string[]) => Promise<unknown>>(() =>
      Promise.resolve(results.delete ?? { error: null }),
    ),
  };
  const client = {
    from: () => ({
      upsert: writes.upsert,
      delete: () => ({
        eq: () => ({ in: (_column: string, ids: string[]) => writes.deleted(ids) }),
      }),
    }),
  };
  return { client, writes };
}

function signedIn(client: unknown, answers: Answers = {}) {
  vi.mocked(requireAccount).mockResolvedValue({
    supabase: client,
    user: { id: 'user-1', email: 'founder@example.com', names: ['Laith Ahmad', 'Laith'] },
    profile: { country_code: 'JO', locale: 'ar' },
  } as unknown as Awaited<ReturnType<typeof requireAccount>>);
  vi.mocked(loadProject).mockResolvedValue({ project, answers });
}

const numberOfPartners = (value: number): SaveInput => ({
  locale: 'ar',
  projectId,
  step: 'A2',
  submission: { kind: 'value', value },
});

beforeEach(() => {
  vi.mocked(reviewWithAi).mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('saveAnswer', () => {
  it('saves the answer and removes every follow-up that no longer applies', async () => {
    const { client, writes } = fakeClient();
    signedIn(client);

    const result = await saveAnswer(numberOfPartners(3));

    expect(result.status).toBe('saved');
    expect(writes.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        question_id: 'A2',
        normalized_value: { status: 'answered', value: 3 },
        source: 'user',
      }),
    );
    // Stored or not: an inactive follow-up is never read back, so all of them are cleared.
    expect(writes.deleted).toHaveBeenCalledWith(
      expect.arrayContaining(['A2.1', 'G4.1']) as string[],
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  it('stores a whole number when a range is picked on a whole-number question (UX-1)', async () => {
    const { client, writes } = fakeClient();
    signedIn(client);

    const result = await saveAnswer({
      locale: 'ar',
      projectId,
      step: 'C8',
      submission: { kind: 'range', min: 11, max: 50 },
    });

    expect(result.status).toBe('saved');
    expect(writes.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        question_id: 'C8',
        normalized_value: { status: 'answered', value: 31 },
        source: 'assumption',
      }),
    );
  });

  it('says what is wrong with a number instead of asking to complete the fields', async () => {
    const { client, writes } = fakeClient();
    signedIn(client);

    expect(await saveAnswer(numberOfPartners(2.5))).toEqual({
      status: 'invalid',
      errors: [{ path: '', message: 'wholeNumber' }],
    });
    expect(await saveAnswer(numberOfPartners(70))).toEqual({
      status: 'invalid',
      errors: [{ path: '', message: 'outOfRange {"min":"0","max":"60"}' }],
    });
    expect(writes.upsert).not.toHaveBeenCalled();
  });

  it('names the box of each error and the limit it broke (UX-3)', async () => {
    const { client, writes } = fakeClient();
    signedIn(client);
    const save = (step: string, value: unknown) =>
      saveAnswer({ locale: 'ar', projectId, step, submission: { kind: 'value', value } });

    expect(
      await save('F3', {
        items: [
          { label: 'قطع', amount: 8, currency: 'JOD' },
          { label: ' ', amount: 2e12, currency: 'JOD' },
        ],
      }),
    ).toEqual({
      status: 'invalid',
      errors: [
        { path: 'items.1.label', message: 'required' },
        { path: 'items.1.amount', message: 'outOfRange {"min":"0","max":"1000000000000"}' },
      ],
    });
    expect(
      await save('G4', {
        items: [
          { label: 'أ', percent: 100 },
          { label: 'ب', percent: 0 },
        ],
      }),
    ).toMatchObject({ errors: [{ path: 'items.1.percent', message: 'aboveMin {"min":"0"}' }] });
    expect(await save('B3', 'x'.repeat(601))).toEqual({
      status: 'invalid',
      errors: [{ path: '', message: 'tooLong {"max":"600"}' }],
    });
    const competitor = { name: 'n', strength: 's', weakness: 'w' };
    expect(await save('D3', { items: Array.from({ length: 16 }, () => competitor) })).toEqual({
      status: 'invalid',
      errors: [{ path: 'items', message: 'maxItems {"count":"15"}' }],
    });
    expect(writes.upsert).not.toHaveBeenCalled();
  });

  it('says "gone" when the project was deleted', async () => {
    const { client, writes } = fakeClient();
    signedIn(client);
    vi.mocked(loadProject).mockResolvedValue(null);

    expect(await saveAnswer(numberOfPartners(3))).toEqual({ status: 'error', reason: 'gone' });
    expect(writes.upsert).not.toHaveBeenCalled();
  });

  it('keeps a follow-up’s warning with its saved answer (G4.1 without an agreement)', async () => {
    const { client } = fakeClient();
    const partners = {
      items: [
        { label: 'أ', percent: 50 },
        { label: 'ب', percent: 50 },
      ],
    };
    signedIn(client, { G4: { status: 'answered', value: partners } });

    const result = await saveAnswer({
      locale: 'ar',
      projectId,
      step: 'G4.1',
      submission: { kind: 'value', value: false },
    });

    expect(result).toMatchObject({
      status: 'saved',
      notes: [{ code: 'G4_no_agreement', severity: 'warn' }],
    });
  });

  it('says "stale" for a follow-up that no longer applies', async () => {
    const { client, writes } = fakeClient();
    // G4.1 (a written agreement) applies only while G4 lists two partners or more.
    signedIn(client);

    const result = await saveAnswer({
      locale: 'ar',
      projectId,
      step: 'G4-1',
      submission: { kind: 'value', value: true },
    });

    expect(result).toEqual({ status: 'error', reason: 'stale' });
    expect(writes.upsert).not.toHaveBeenCalled();
  });

  it('says "failed" and logs the stage when the database cannot be reached', async () => {
    const { client } = fakeClient();
    signedIn(client);
    vi.mocked(loadProject).mockRejectedValue(
      Object.assign(new Error('fetch failed for founder@example.com'), { code: 'ECONNRESET' }),
    );

    expect(await saveAnswer(numberOfPartners(3))).toEqual({ status: 'error', reason: 'failed' });
    expect(log.error).toHaveBeenCalledWith('diagnostic.save_failed', {
      code: 'ECONNRESET',
      errorName: 'Error',
      stage: 'load',
      questionId: 'A2',
    });
  });

  it('says "failed" and logs when the database refuses the answer', async () => {
    const { client } = fakeClient({ upsert: { error: { code: '42501', message: 'denied' } } });
    signedIn(client);

    expect(await saveAnswer(numberOfPartners(3))).toEqual({ status: 'error', reason: 'failed' });
    expect(log.error).toHaveBeenCalledWith('diagnostic.save_failed', {
      code: '42501',
      stage: 'upsert',
      questionId: 'A2',
    });
  });

  it('still reports the answer saved when removing old follow-ups fails', async () => {
    const { client } = fakeClient({ delete: { error: { code: '57014' } } });
    signedIn(client);

    expect((await saveAnswer(numberOfPartners(3))).status).toBe('saved');
    expect(log.warn).toHaveBeenCalledWith('diagnostic.follow_up_cleanup_failed', {
      code: '57014',
      projectId,
    });
  });

  it('lets a sign-in redirect through instead of reporting a failure', async () => {
    let signInRedirect: unknown;
    try {
      redirect('/ar/login');
    } catch (error) {
      signInRedirect = error;
    }
    vi.mocked(requireAccount).mockRejectedValue(signInRedirect);

    await expect(saveAnswer(numberOfPartners(3))).rejects.toBe(signInRedirect);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('refuses malformed input without touching the database', async () => {
    const { client, writes } = fakeClient();
    signedIn(client);

    expect(await saveAnswer({ ...numberOfPartners(3), projectId: 'not-a-uuid' })).toEqual({
      status: 'error',
      reason: 'failed',
    });
    expect(await saveAnswer({ ...numberOfPartners(3), step: 'Z9' })).toEqual({
      status: 'error',
      reason: 'failed',
    });
    expect(writes.upsert).not.toHaveBeenCalled();
  });

  it('gives the AI review the account’s email and sign-in names to remove (rule 5)', async () => {
    const { client } = fakeClient();
    signedIn(client);
    const typed = 'أصحاب المطاعم الصغيرة في وسط إربد';

    const result = await saveAnswer({
      locale: 'ar',
      projectId,
      step: 'B3',
      submission: { kind: 'value', value: typed },
    });

    expect(result.status).toBe('saved');
    expect(reviewWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: { email: 'founder@example.com', names: ['Laith Ahmad', 'Laith'] },
        projectId,
      }),
      'B3',
      typed,
    );
  });

  it('saves the confirmed answer as typed when the model reading does not fit the question', async () => {
    const { client, writes } = fakeClient();
    signedIn(client);
    const typed = 'أصحاب المطاعم الصغيرة في وسط إربد';
    const review: ReviewOutput = {
      language: 'dialect',
      msa: 'ن'.repeat(700),
      confirmation: 'فهمت أن …',
      violations: [],
      coherent: null,
    };
    vi.mocked(reviewWithAi).mockResolvedValue(review);

    const result = await saveAnswer({
      locale: 'ar',
      projectId,
      step: 'B3',
      submission: { kind: 'confirmed', value: typed },
    });

    expect(result.status).toBe('saved');
    expect(writes.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        raw_text: typed,
        normalized_value: { status: 'answered', value: typed },
      }),
    );
    expect(log.warn).toHaveBeenCalledWith('diagnostic.msa_unusable', {
      questionId: 'B3',
      reason: 'schema',
    });
  });
});

describe('project settings', () => {
  /** A client whose project update and delete answer `result`. */
  function projectsClient(result: unknown = { error: null }) {
    const eq = vi.fn(() => Promise.resolve(result));
    const update = vi.fn(() => ({ eq }));
    const client = { from: () => ({ update, delete: () => ({ eq }) }) };
    signedIn(client);
    return { update, eq };
  }

  /** The target of a redirect() thrown by `action`, read from its digest. */
  async function redirectTarget(action: Promise<unknown>): Promise<string> {
    const error: unknown = await action.then(
      () => null,
      (thrown: unknown) => thrown,
    );
    return ((error as { digest?: string } | null)?.digest ?? '').split(';')[2] ?? '';
  }

  it('switches the mode and re-renders the project', async () => {
    const { update, eq } = projectsClient();

    expect(await switchMode('ar', projectId, 'quick')).toEqual({ status: 'done' });
    expect(update).toHaveBeenCalledWith({ mode: 'quick' });
    expect(eq).toHaveBeenCalledWith('id', projectId);
  });

  it('reports a failed switch to the form instead of throwing', async () => {
    projectsClient({ error: { code: '42501', message: 'denied' } });

    expect(await switchMode('en', projectId, 'full')).toEqual({ status: 'error' });
    expect(log.error).toHaveBeenCalledWith('diagnostic.mode_switch_failed', {
      code: '42501',
      projectId,
    });
  });

  it('reports an unreachable database to the form', async () => {
    vi.mocked(requireAccount).mockRejectedValue(
      Object.assign(new Error('fetch failed'), { code: 'ECONNRESET' }),
    );

    expect(await switchMode('ar', projectId, 'full')).toEqual({ status: 'error' });
    expect(log.error).toHaveBeenCalledWith('diagnostic.mode_switch_failed', {
      code: 'ECONNRESET',
      errorName: 'Error',
      projectId,
    });
  });

  it('deletes the project and opens the list', async () => {
    projectsClient();

    expect(await redirectTarget(deleteProject('en', projectId))).toBe('/en/projects');
  });

  it('keeps the dialog when the project cannot be deleted', async () => {
    projectsClient({ error: { code: '57014' } });

    expect(await deleteProject('ar', projectId)).toEqual({ status: 'error' });
    expect(log.error).toHaveBeenCalledWith('diagnostic.delete_failed', {
      code: '57014',
      projectId,
    });
  });

  it('throws for input no page of ours sends', async () => {
    projectsClient();

    await expect(deleteProject('ar', 'not-a-uuid')).rejects.toThrow();
    await expect(switchMode('ar', projectId, 'slow' as 'full')).rejects.toThrow();
  });
});
