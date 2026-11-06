import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { hasReportRating, parseRating, passRatingGate, ratingVersion } from './rating';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const PROJECT = '22222222-2222-4222-8222-222222222222';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

/** A client whose two functions answer from `answers`; `rate_report` may fail or throw. */
function client(answers: {
  has?: { data: boolean | null; error: { code: string } | null };
  rate?: { error: { code: string } | null } | 'throw';
}) {
  const rpc = vi.fn((name: string) => {
    if (name === 'has_report_rating') {
      return Promise.resolve(answers.has ?? { data: false, error: null });
    }
    if (answers.rate === 'throw') return Promise.reject(new Error('network down'));
    return Promise.resolve({ data: null, ...(answers.rate ?? { error: null }) });
  });
  return { supabase: { rpc } as unknown as SupabaseServerClient, rpc };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('parseRating (D-345)', () => {
  it('takes one to five stars and a trimmed comment', () => {
    expect(parseRating(form({ stars: '4', comment: '  clear  ' }))).toEqual({
      stars: 4,
      comment: 'clear',
    });
    expect(parseRating(form({ stars: '1' }))).toEqual({ stars: 1, comment: '' });
  });

  it('refuses anything else, and cuts a long comment at 1000 characters', () => {
    for (const stars of ['0', '6', '3.5', '', 'five', '-1', '10']) {
      expect(parseRating(form({ stars }))).toBeNull();
    }
    expect(parseRating(form({ comment: 'no stars' }))).toBeNull();
    expect(parseRating(form({ stars: '5', comment: 'x'.repeat(1500) }))?.comment).toHaveLength(
      1000,
    );
  });
});

describe('ratingVersion', () => {
  it('is 0 for a report without versions', () => {
    expect(ratingVersion(null)).toBe(0);
    expect(ratingVersion(3)).toBe(3);
  });
});

describe('hasReportRating', () => {
  it('asks for this version of this project', async () => {
    const { supabase, rpc } = client({ has: { data: true, error: null } });
    expect(await hasReportRating(supabase, PROJECT, 2)).toBe(true);
    expect(rpc).toHaveBeenCalledWith('has_report_rating', { p_project_id: PROJECT, p_version: 2 });
  });

  it('answers null, and logs, when it cannot read', async () => {
    const { supabase } = client({ has: { data: null, error: { code: 'XX000' } } });
    expect(await hasReportRating(supabase, PROJECT, null)).toBeNull();
    expect(log.error).toHaveBeenCalledWith('report_rating.read_failed', { code: 'XX000' });
  });
});

describe('passRatingGate (D-345)', () => {
  it('lets a version already rated through, with or without stars on the form', async () => {
    const { supabase, rpc } = client({ has: { data: true, error: null } });
    expect(await passRatingGate(supabase, PROJECT, 1, form({}))).toBe('ok');
    expect(rpc).not.toHaveBeenCalledWith('rate_report', expect.anything());
  });

  it('asks for the rating when the version has none and the form carries none', async () => {
    const { supabase } = client({});
    expect(await passRatingGate(supabase, PROJECT, null, form({ comment: 'only words' }))).toBe(
      'rating_required',
    );
    expect(await passRatingGate(supabase, PROJECT, null, form({ stars: '9' }))).toBe(
      'rating_required',
    );
  });

  it('keeps the rating of the form and lets the file through', async () => {
    const { supabase, rpc } = client({});
    expect(
      await passRatingGate(supabase, PROJECT, 3, form({ stars: '5', comment: ' great ' })),
    ).toBe('ok');
    expect(rpc).toHaveBeenCalledWith('rate_report', {
      p_project_id: PROJECT,
      p_version: 3,
      p_stars: 5,
      p_comment: 'great',
    });
  });

  it('updates a rating the form carries even on a version already rated', async () => {
    const { supabase, rpc } = client({ has: { data: true, error: null } });
    expect(await passRatingGate(supabase, PROJECT, 1, form({ stars: '2' }))).toBe('ok');
    expect(rpc).toHaveBeenCalledWith('rate_report', expect.objectContaining({ p_stars: 2 }));
  });

  it('fails, never passes, when the rating cannot be read or written', async () => {
    expect(
      await passRatingGate(
        client({ has: { data: null, error: { code: 'x' } } }).supabase,
        PROJECT,
        1,
        form({ stars: '5' }),
      ),
    ).toBe('failed');
    expect(
      await passRatingGate(
        client({ rate: { error: { code: '42501' } } }).supabase,
        PROJECT,
        1,
        form({ stars: '5' }),
      ),
    ).toBe('failed');
    expect(
      await passRatingGate(client({ rate: 'throw' }).supabase, PROJECT, 1, form({ stars: '5' })),
    ).toBe('failed');
  });
});
