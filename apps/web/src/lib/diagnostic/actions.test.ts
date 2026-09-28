import type { ReviewOutput } from '@sbn/ai';
import type { Answers } from '@sbn/question-bank';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewWithAi } from '@/lib/ai/service';
import { requireAccount } from '@/lib/auth/session';
import { log } from '@/lib/log';
import { saveAnswer, type SaveInput } from './actions';
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
vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
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
    user: { id: 'user-1', email: 'founder@example.com' },
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

  it('says "stale" when the project is gone', async () => {
    const { client, writes } = fakeClient();
    signedIn(client);
    vi.mocked(loadProject).mockResolvedValue(null);

    expect(await saveAnswer(numberOfPartners(3))).toEqual({ status: 'error', reason: 'stale' });
    expect(writes.upsert).not.toHaveBeenCalled();
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
