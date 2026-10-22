import 'server-only';
import { errorFields, log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import {
  PDF_URL_SECONDS,
  REPORTS_BUCKET,
  type PdfStore,
  type RecordInput,
  type RecordOutcome,
} from './pdf';

/** The settings row that holds the number of reports a user may make in a UTC day (D-234). */
const LIMIT_SETTING = 'report.pdf_per_day';

/** How many stored rows of the same key are checked for a file that is still there. */
const SAME_KEY_ROWS = 3;

/** The start of the UTC day that `now` falls in: the day record_report() counts from. */
export function utcDayStart(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

/** SQLSTATE of the refusals of record_report(): 54000 the limit, 42501 not signed in or not yours. */
export function outcomeOfRecordError(code: string | undefined): RecordOutcome {
  if (code === '54000') return 'limit';
  if (code === '42501') return 'refused';
  return 'failed';
}

/**
 * The store of the PDF route on Supabase, acting as the signed-in user: row level security and the
 * storage policies of D-244 apply to every call, and no service role exists in this path.
 */
export function createPdfStore(
  supabase: SupabaseServerClient,
  now: () => Date = () => new Date(),
): PdfStore {
  const bucket = () => supabase.storage.from(REPORTS_BUCKET);

  return {
    async findStored({ projectId, inputHash, kind, locale }) {
      const { data, error } = await supabase
        .from('reports')
        .select('pdf_path')
        .eq('project_id', projectId)
        .eq('input_hash', inputHash)
        .eq('kind', kind)
        .eq('locale', locale)
        .order('created_at', { ascending: false })
        .limit(SAME_KEY_ROWS);
      if (error) {
        await log.warn('report_pdf.lookup_failed', { ...errorFields(error), stage: 'rows' });
        return null;
      }
      for (const { pdf_path: path } of data) {
        const slash = path.lastIndexOf('/');
        const folder = path.slice(0, slash);
        const name = path.slice(slash + 1);
        const listed = await bucket().list(folder, { search: name, limit: 5 });
        if (listed.error) {
          await log.warn('report_pdf.lookup_failed', {
            ...errorFields(listed.error),
            stage: 'file',
          });
          return null;
        }
        // A row without its file (a failed upload) is not a hit: the report is made again.
        if (listed.data.some((file) => file.name === name)) return path;
      }
      return null;
    },

    async mayRender() {
      const setting = await supabase
        .from('settings')
        .select('value')
        .eq('key', LIMIT_SETTING)
        .maybeSingle();
      const limit = Number(setting.data?.value);
      if (setting.error || !Number.isFinite(limit)) return true;
      const used = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', utcDayStart(now()));
      if (used.error || used.count === null) return true;
      return used.count < limit;
    },

    async record(input: RecordInput) {
      const { error } = await supabase.rpc('record_report', {
        p_report_id: input.reportId,
        p_project_id: input.projectId,
        p_kind: input.kind,
        p_locale: input.locale,
        p_audience: input.audience,
        p_input_hash: input.inputHash,
        p_engine_version: input.engineVersion,
        p_pdf_path: input.path,
        p_pdf_bytes: input.bytes,
      });
      if (!error) return 'ok';
      const outcome = outcomeOfRecordError(error.code);
      if (outcome !== 'limit') {
        await log.error('report_pdf.record_failed', {
          ...errorFields(error),
          projectId: input.projectId,
        });
      }
      return outcome;
    },

    async upload(path, pdf) {
      const { error } = await bucket().upload(path, pdf, {
        contentType: 'application/pdf',
        upsert: false,
      });
      if (error) await log.error('report_pdf.upload_failed', errorFields(error));
      return error === null;
    },

    async remove(path) {
      const { error } = await bucket().remove([path]);
      if (error) await log.warn('report_pdf.cleanup_failed', errorFields(error));
    },

    async sign(path, fileName) {
      const { data, error } = await bucket().createSignedUrl(path, PDF_URL_SECONDS, {
        download: fileName,
      });
      if (error) {
        await log.error('report_pdf.sign_failed', errorFields(error));
        return null;
      }
      return data.signedUrl;
    },
  };
}
