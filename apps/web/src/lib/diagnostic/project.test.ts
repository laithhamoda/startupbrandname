import type { Answer } from '@sbn/question-bank';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { loadProject, parseAnswers, provenanceOf } from './project';

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

  // A1 is a country and city that does not accept «لا أعرف»; A2 a number of years from 0 to 60
  // that does; A2.1 a text follow-up asked only when A2 is 0.
  const unknown = { status: 'unknown' };
  const story = answered('خالي يعمل في توريد المطاعم');
  it.each([
    ['a number stored as text', [['A2', answered('three')]], []],
    ['a number outside its bounds', [['A2', answered(70)]], []],
    ['«لا أعرف» where the question refuses it', [['A1', unknown]], []],
    ['«لا أعرف» where the question accepts it', [['A2', unknown]], ['A2']],
    [
      'a part the field does not have',
      [['A1', answered({ country: 'JO', city: 'إربد', street: 'x' })]],
      [],
    ],
    ['a status the bank does not know', [['A2', { status: 'skipped' }]], []],
    ['a question ID the bank does not have', [['Z9', answered(1)]], []],
    ['a follow-up ID the bank does not have', [['A2.7', story]], []],
    [
      'an active follow-up',
      [
        ['A2', answered(0)],
        ['A2.1', story],
      ],
      ['A2', 'A2.1'],
    ],
    [
      'an inactive follow-up (D-116)',
      [
        ['A2', answered(3)],
        ['A2.1', story],
      ],
      ['A2'],
    ],
    ['a follow-up without the answer that calls for it', [['A2.1', story]], []],
    [
      'a follow-up saved as «لا أعرف»',
      [
        ['A2', answered(0)],
        ['A2.1', unknown],
      ],
      ['A2'],
    ],
  ] as const)('reads %s', (_case, rows, kept) => {
    const answers = parseAnswers(
      rows.map(([question_id, normalized_value]) => ({ question_id, normalized_value })),
    );
    expect(Object.keys(answers).sort()).toEqual([...kept]);
  });
});

describe('provenanceOf (rule 2, D-104, D-114)', () => {
  const three: Answer = { status: 'answered', value: 3 };
  const dontKnow: Answer = { status: 'unknown' };
  it.each([
    ['a typed answer', three, false, { source: 'user', confidence: 'medium' }],
    ['a range picked after R3', three, true, { source: 'assumption', confidence: 'medium' }],
    ['«لا أعرف»', dontKnow, false, { source: 'assumption', confidence: 'low' }],
    [
      '«لا أعرف», whatever the submission',
      dontKnow,
      true,
      { source: 'assumption', confidence: 'low' },
    ],
  ] as const)(
    'stores %s with its provenance, not validated',
    (_case, answer, fromRange, expected) => {
      expect(provenanceOf(answer, fromRange)).toEqual({ ...expected, validated: false });
    },
  );
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
