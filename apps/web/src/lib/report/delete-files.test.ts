import { beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { removeReportFiles } from './delete-files';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const USER = '11111111-1111-4111-8111-111111111111';
const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '33333333-3333-4333-8333-333333333333';

interface Entry {
  name: string;
  id: string | null;
}
interface Page {
  data: Entry[] | null;
  error: unknown;
}

const folder = (name: string): Entry => ({ name, id: null });
const file = (name: string): Entry => ({ name, id: `id-${name}` });

/**
 * A bucket whose `list` answers from `tree` (the entries of each folder, by path) a page at a
 * time, as the Storage API does, and whose `remove` answers from `removed`.
 */
function bucket(
  tree: Record<string, Entry[] | Page>,
  removed?: (paths: string[]) => { data: unknown[] | null; error: unknown },
) {
  const list = vi.fn((path: string, options: { limit: number; offset: number }) => {
    const found = tree[path] ?? [];
    if (!Array.isArray(found)) return Promise.resolve(found);
    return Promise.resolve({
      data: found.slice(options.offset, options.offset + options.limit),
      error: null,
    });
  });
  const remove = vi.fn((paths: string[]) =>
    Promise.resolve(
      removed ? removed(paths) : { data: paths.map((name) => ({ name })), error: null },
    ),
  );
  const client = {
    storage: { from: vi.fn(() => ({ list, remove })) },
  } as unknown as SupabaseServerClient;
  return { client, list, remove };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('removeReportFiles', () => {
  it('removes only the folder of one project when a project is given', async () => {
    const { client, list, remove } = bucket({
      [`${USER}/${P1}`]: [file('a.pdf')],
      [`${USER}/${P2}`]: [file('c.pdf')],
    });

    expect(await removeReportFiles(client, USER, P1)).toBe(true);

    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith(`${USER}/${P1}`, { limit: 100, offset: 0 });
    expect(remove).toHaveBeenCalledWith([`${USER}/${P1}/a.pdf`]);
  });

  it('removes every file of every project folder of the user, and only theirs', async () => {
    const { client, list, remove } = bucket({
      [USER]: [folder(P1), folder(P2)],
      [`${USER}/${P1}`]: [file('a.pdf'), file('b.pdf')],
      [`${USER}/${P2}`]: [file('c.pdf')],
    });

    expect(await removeReportFiles(client, USER)).toBe(true);

    expect(list).toHaveBeenCalledWith(USER, { limit: 100, offset: 0 });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([
      `${USER}/${P1}/a.pdf`,
      `${USER}/${P1}/b.pdf`,
      `${USER}/${P2}/c.pdf`,
    ]);
    expect(log.info).toHaveBeenCalledWith('account.reports_removed', { count: 3 });
  });

  it('is fine with an empty folder, and with a project folder that holds nothing', async () => {
    const none = bucket({});
    expect(await removeReportFiles(none.client, USER)).toBe(true);
    expect(none.remove).not.toHaveBeenCalled();

    const empty = bucket({ [USER]: [folder(P1)], [`${USER}/${P1}`]: [] });
    expect(await removeReportFiles(empty.client, USER)).toBe(true);
    expect(empty.remove).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it('also removes a file lying straight under the user’s folder', async () => {
    const { client, remove } = bucket({ [USER]: [file('stray.pdf')] });
    expect(await removeReportFiles(client, USER)).toBe(true);
    expect(remove).toHaveBeenCalledWith([`${USER}/stray.pdf`]);
  });

  it('reads every page of a long folder and removes in batches of a hundred', async () => {
    const many = Array.from({ length: 230 }, (_, index) => file(`f${String(index)}.pdf`));
    const { client, list, remove } = bucket({ [USER]: [folder(P1)], [`${USER}/${P1}`]: many });

    expect(await removeReportFiles(client, USER)).toBe(true);

    expect(list).toHaveBeenCalledWith(`${USER}/${P1}`, { limit: 100, offset: 200 });
    expect(remove.mock.calls.map(([paths]) => paths.length)).toEqual([100, 100, 30]);
  });

  it('fails, and says where, when a folder cannot be listed', async () => {
    const top = bucket({ [USER]: { data: null, error: { name: 'StorageApiError', status: 500 } } });
    expect(await removeReportFiles(top.client, USER)).toBe(false);
    expect(log.error).toHaveBeenCalledWith('account.reports_list_failed', {
      errorName: 'StorageApiError',
      status: 500,
      stage: 'list',
    });

    const inner = bucket({
      [USER]: [folder(P1)],
      [`${USER}/${P1}`]: { data: null, error: { name: 'StorageApiError' } },
    });
    expect(await removeReportFiles(inner.client, USER)).toBe(false);
    expect(inner.remove).not.toHaveBeenCalled();
  });

  it('fails when a folder never ends', async () => {
    const endless = vi.fn(() =>
      Promise.resolve({
        data: Array.from({ length: 100 }, (_, i) => file(`f${String(i)}`)),
        error: null,
      }),
    );
    const client = {
      storage: { from: () => ({ list: endless, remove: vi.fn() }) },
    } as unknown as SupabaseServerClient;
    expect(await removeReportFiles(client, USER)).toBe(false);
    expect(log.error).toHaveBeenCalledWith('account.reports_list_failed', { stage: 'too_many' });
  });

  it('fails when the Storage API refuses the removal, or removes fewer files than asked', async () => {
    const tree = { [USER]: [folder(P1)], [`${USER}/${P1}`]: [file('a.pdf'), file('b.pdf')] };

    const refused = bucket(tree, () => ({ data: null, error: { name: 'StorageApiError' } }));
    expect(await removeReportFiles(refused.client, USER)).toBe(false);
    expect(log.error).toHaveBeenCalledWith('account.reports_remove_failed', {
      errorName: 'StorageApiError',
      stage: 'remove',
      count: 2,
    });

    // A policy that hides a file answers no error and one file fewer: that is a failure too.
    const partial = bucket(tree, (paths) => ({ data: [{ name: paths[0] }], error: null }));
    expect(await removeReportFiles(partial.client, USER)).toBe(false);
    expect(log.error).toHaveBeenLastCalledWith('account.reports_remove_failed', {
      stage: 'remove',
      count: 2,
    });
  });
});
