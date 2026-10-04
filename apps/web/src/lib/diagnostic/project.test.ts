import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { loadProject, parseAnswers } from './project';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const answered = (value: unknown) => ({ status: 'answered', value });
const partners = {
  items: [
    { label: 'أ', percent: 50 },
    { label: 'ب', percent: 50 },
  ],
};
const soleOwner = { items: [{ label: 'أ', percent: 100 }] };

afterEach(() => {
  vi.clearAllMocks();
});

describe('parseAnswers', () => {
  it('keeps a follow-up whose trigger holds, in any row order', () => {
    const answers = parseAnswers([
      { question_id: 'G4.1', normalized_value: answered(true) },
      { question_id: 'G4', normalized_value: answered(partners) },
    ]);
    expect(answers['G4.1']).toEqual(answered(true));
  });

  it('ignores a follow-up whose trigger no longer holds', () => {
    const answers = parseAnswers([
      { question_id: 'G4', normalized_value: answered(soleOwner) },
      { question_id: 'G4.1', normalized_value: answered(false) },
    ]);
    expect(answers).toEqual({ G4: answered(soleOwner) });
  });

  it('counts a value that no longer fits its question as missing', () => {
    expect(
      parseAnswers([
        { question_id: 'A2', normalized_value: answered('three') },
        { question_id: 'Z9', normalized_value: answered(1) },
      ]),
    ).toEqual({});
  });
});

describe('loadProject', () => {
  const id = '6f1c1f1e-7d4b-4c55-9a51-0f6f5d2b9e10';

  function clientWith(rows: { question_id: string; normalized_value: unknown }[]) {
    const project = {
      id,
      title: 'صيانة مكيّفات المطاعم',
      country_code: 'JO',
      currency: 'JOD',
      mode: 'quick',
      created_at: '2026-09-28T10:00:00Z',
      updated_at: '2026-09-28T10:00:00Z',
    };
    const query = (result: unknown) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    };
    return {
      from: (table: string) =>
        table === 'projects'
          ? query({ data: project, error: null })
          : query({ data: rows, error: null }),
    } as unknown as SupabaseServerClient;
  }

  it('logs stored answers it cannot read by question ID, never by value', async () => {
    const loaded = await loadProject(
      clientWith([
        { question_id: 'A2', normalized_value: answered('founder@example.com') },
        { question_id: 'A6', normalized_value: answered(12) },
      ]),
      id,
    );

    expect(loaded?.answers).toEqual({ A6: answered(12) });
    expect(log.warn).toHaveBeenCalledWith('diagnostic.answers_unreadable', {
      projectId: id,
      questionId: 'A2',
      count: 1,
    });
  });

  it('does not log an inactive follow-up, which the next save removes', async () => {
    await loadProject(
      clientWith([
        { question_id: 'G4', normalized_value: answered(soleOwner) },
        { question_id: 'G4.1', normalized_value: answered(true) },
      ]),
      id,
    );
    expect(log.warn).not.toHaveBeenCalled();
  });
});
