import { Button } from '@/components/ui/button';
import type { PdfErrorCode } from '@/lib/report/pdf-codes';
import type { ReportLabels } from './inline';

/**
 * The PDF of the report, as a plain form (M5 step 6, D-280): a POST to the route, with the page's
 * language and no client JavaScript. The browser follows the route's answer, a redirect to the
 * file, and a refusal comes back to this page with its code in the address, drawn here as a
 * sentence. The project's id is in the address of the route only, never in a label.
 */
export function PdfDownload({
  projectId,
  locale,
  labels,
  error,
}: {
  projectId: string;
  locale: 'ar' | 'en';
  labels: ReportLabels;
  /** The code the route sent the founder back with, when it refused. */
  error: PdfErrorCode | null;
}) {
  return (
    <div className="grid gap-3" data-pdf-download>
      {error === null ? null : (
        <p
          role="alert"
          data-pdf-error={error}
          className="reading border-s-[3px] border-ink bg-sunken px-4 py-3 text-small"
        >
          {labels.pdf.errors[error]}
        </p>
      )}
      <form method="post" action={`/api/projects/${projectId}/report/pdf`} className="grid gap-2">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <Button type="submit">{labels.pdf.button}</Button>
        </div>
        <p className="text-caption text-muted">{labels.pdf.hint}</p>
      </form>
    </div>
  );
}
