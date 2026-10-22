import { beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { PDF_URL_SECONDS, REPORTS_BUCKET, type RecordInput } from './pdf';
import { createPdfStore, outcomeOfRecordError, utcDayStart } from './pdf-store';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const USER = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const PATH_A = `${USER}/${PROJECT}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf`;
const PATH_B = `${USER}/${PROJECT}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf`;

interface Fake {
  rows: { data: { pdf_path: string }[] | null; error: unknown };
  listed: Record<string, { data: { name: string }[] | null; error: unknown }>;
  setting: { data: { value: unknown } | null; error: unknown };
  usage: { count: number | null; error: unknown };
  rpcError: { code?: string } | null;
  upload: { error: unknown };
  remove: { error: unknown };
  sign: { data: { signedUrl: string } | null; error: unknown };
}

function fake(over: Partial<Fake> = {}) {
  const state: Fake = {
    rows: { data: [], error: null },
    listed: {},
    setting: { data: { value: 10 }, error: null },
    usage: { count: 0, error: null },
    rpcError: null,
    upload: { error: null },
    remove: { error: null },
    sign: { data: { signedUrl: 'https://signed.example/f' }, error: null },
    ...over,
  };
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(state.rows)),
  };
  const gte = vi.fn(() => Promise.resolve(state.usage));
  const reportsSelect = vi.fn((columns: string) => (columns === 'id' ? { gte } : query));
  const settingsEq = vi.fn(() => ({ maybeSingle: () => Promise.resolve(state.setting) }));
  const from = vi.fn((table: string) =>
    table === 'settings' ? { select: () => ({ eq: settingsEq }) } : { select: reportsSelect },
  );
  const list = vi.fn((folder: string) =>
    Promise.resolve(state.listed[folder] ?? { data: [], error: null }),
  );
  const upload = vi.fn(() => Promise.resolve(state.upload));
  const remove = vi.fn(() => Promise.resolve(state.remove));
  const createSignedUrl = vi.fn(() => Promise.resolve(state.sign));
  const bucket = vi.fn(() => ({ list, upload, remove, createSignedUrl }));
  const rpc = vi.fn(() => Promise.resolve({ data: null, error: state.rpcError }));
  const client = { from, storage: { from: bucket }, rpc } as unknown as SupabaseServerClient;
  return {
    client,
    query,
    gte,
    settingsEq,
    from,
    list,
    upload,
    remove,
    createSignedUrl,
    bucket,
    rpc,
  };
}

const KEY = { projectId: PROJECT, inputHash: 'a'.repeat(64), kind: 'full', locale: 'ar' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findStored', () => {
  it('asks for the rows of the same key, newest first, and answers the path whose file is there', async () => {
    const f = fake({
      rows: { data: [{ pdf_path: PATH_A }, { pdf_path: PATH_B }], error: null },
      listed: {
        [`${USER}/${PROJECT}`]: {
          data: [{ name: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf' }],
          error: null,
        },
      },
    });
    const found = await createPdfStore(f.client).findStored(KEY);

    // The newest row has no file (a failed upload): the next one is the hit.
    expect(found).toBe(PATH_B);
    expect(f.bucket).toHaveBeenCalledWith(REPORTS_BUCKET);
    expect(f.query.eq).toHaveBeenCalledWith('project_id', PROJECT);
    expect(f.query.eq).toHaveBeenCalledWith('input_hash', KEY.inputHash);
    expect(f.query.eq).toHaveBeenCalledWith('kind', 'full');
    expect(f.query.eq).toHaveBeenCalledWith('locale', 'ar');
    expect(f.query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(f.list).toHaveBeenCalledWith(`${USER}/${PROJECT}`, {
      search: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf',
      limit: 5,
    });
  });

  it('answers null when no row has its file, or there is no row', async () => {
    const none = fake();
    expect(await createPdfStore(none.client).findStored(KEY)).toBeNull();
    const orphan = fake({ rows: { data: [{ pdf_path: PATH_A }], error: null } });
    expect(await createPdfStore(orphan.client).findStored(KEY)).toBeNull();
  });

  it('answers null, and says so, when the rows or the bucket cannot be read', async () => {
    const rows = fake({ rows: { data: null, error: { code: 'PGRST301' } } });
    expect(await createPdfStore(rows.client).findStored(KEY)).toBeNull();
    expect(log.warn).toHaveBeenCalledWith('report_pdf.lookup_failed', {
      code: 'PGRST301',
      stage: 'rows',
    });

    const bucket = fake({
      rows: { data: [{ pdf_path: PATH_A }], error: null },
      listed: { [`${USER}/${PROJECT}`]: { data: null, error: { name: 'StorageError' } } },
    });
    expect(await createPdfStore(bucket.client).findStored(KEY)).toBeNull();
    expect(log.warn).toHaveBeenCalledWith('report_pdf.lookup_failed', {
      errorName: 'StorageError',
      stage: 'file',
    });
  });
});

describe('mayRender', () => {
  const at = () => new Date('2026-10-22T15:30:00Z');

  it('counts the reports of the UTC day against the setting', async () => {
    const under = fake({ usage: { count: 9, error: null } });
    expect(await createPdfStore(under.client, at).mayRender()).toBe(true);
    expect(under.gte).toHaveBeenCalledWith('created_at', '2026-10-22T00:00:00.000Z');
    expect(under.settingsEq).toHaveBeenCalledWith('key', 'report.pdf_per_day');

    const used = fake({ usage: { count: 10, error: null } });
    expect(await createPdfStore(used.client, at).mayRender()).toBe(false);
  });

  it('leaves the decision to record_report when a read fails or the setting is not a number', async () => {
    const noSetting = fake({
      setting: { data: null, error: { code: 'x' } },
      usage: { count: 99, error: null },
    });
    expect(await createPdfStore(noSetting.client, at).mayRender()).toBe(true);
    const text = fake({
      setting: { data: { value: 'many' }, error: null },
      usage: { count: 99, error: null },
    });
    expect(await createPdfStore(text.client, at).mayRender()).toBe(true);
    const noCount = fake({ usage: { count: null, error: { code: 'x' } } });
    expect(await createPdfStore(noCount.client, at).mayRender()).toBe(true);
  });

  it('writes the start of a UTC day, whatever the local time zone', () => {
    expect(utcDayStart(new Date('2026-10-22T23:59:59Z'))).toBe('2026-10-22T00:00:00.000Z');
    expect(utcDayStart(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('record', () => {
  const input: RecordInput = {
    reportId: 'r',
    projectId: PROJECT,
    kind: 'full',
    locale: 'ar',
    audience: 'investor',
    inputHash: 'h',
    engineVersion: '1.1.0',
    path: PATH_A,
    bytes: 5,
  };

  it('calls record_report with the arguments it needs', async () => {
    const f = fake();
    expect(await createPdfStore(f.client).record(input)).toBe('ok');
    expect(f.rpc).toHaveBeenCalledWith('record_report', {
      p_report_id: 'r',
      p_project_id: PROJECT,
      p_kind: 'full',
      p_locale: 'ar',
      p_audience: 'investor',
      p_input_hash: 'h',
      p_engine_version: '1.1.0',
      p_pdf_path: PATH_A,
      p_pdf_bytes: 5,
    });
  });

  it('maps the refusals of the database: the limit, not yours, and anything else', async () => {
    expect(outcomeOfRecordError('54000')).toBe('limit');
    expect(outcomeOfRecordError('42501')).toBe('refused');
    expect(outcomeOfRecordError('57014')).toBe('failed');
    expect(outcomeOfRecordError(undefined)).toBe('failed');

    const limit = fake({ rpcError: { code: '54000' } });
    expect(await createPdfStore(limit.client).record(input)).toBe('limit');
    // The limit is an answer, not a fault: nothing is logged for it.
    expect(log.error).not.toHaveBeenCalled();

    const refused = fake({ rpcError: { code: '42501' } });
    expect(await createPdfStore(refused.client).record(input)).toBe('refused');
    expect(log.error).toHaveBeenCalledWith('report_pdf.record_failed', {
      code: '42501',
      projectId: PROJECT,
    });
  });
});

describe('the bucket calls', () => {
  it('uploads as a PDF, once, never over an existing file', async () => {
    const f = fake();
    const bytes = new Uint8Array([1]);
    expect(await createPdfStore(f.client).upload(PATH_A, bytes)).toBe(true);
    expect(f.upload).toHaveBeenCalledWith(PATH_A, bytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

    const failed = fake({ upload: { error: { name: 'StorageApiError', status: 409 } } });
    expect(await createPdfStore(failed.client).upload(PATH_A, bytes)).toBe(false);
    expect(log.error).toHaveBeenCalledWith('report_pdf.upload_failed', {
      errorName: 'StorageApiError',
      status: 409,
    });
  });

  it('removes a file, and says so when it cannot', async () => {
    const f = fake();
    await createPdfStore(f.client).remove(PATH_A);
    expect(f.remove).toHaveBeenCalledWith([PATH_A]);
    const failed = fake({ remove: { error: { name: 'StorageApiError' } } });
    await createPdfStore(failed.client).remove(PATH_A);
    expect(log.warn).toHaveBeenCalledWith('report_pdf.cleanup_failed', {
      errorName: 'StorageApiError',
    });
  });

  it('signs a short-lived address that downloads under the given name', async () => {
    const f = fake();
    expect(await createPdfStore(f.client).sign(PATH_A, 'report.pdf')).toBe(
      'https://signed.example/f',
    );
    expect(f.createSignedUrl).toHaveBeenCalledWith(PATH_A, PDF_URL_SECONDS, {
      download: 'report.pdf',
    });
    expect(PDF_URL_SECONDS).toBeLessThanOrEqual(120);

    const failed = fake({ sign: { data: null, error: { name: 'StorageApiError' } } });
    expect(await createPdfStore(failed.client).sign(PATH_A, 'report.pdf')).toBeNull();
    expect(log.error).toHaveBeenCalledWith('report_pdf.sign_failed', {
      errorName: 'StorageApiError',
    });
  });
});
