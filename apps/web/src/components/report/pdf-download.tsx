import { Button } from '@/components/ui/button';
import type { PdfErrorCode } from '@/lib/report/pdf-codes';
import type { ReportLabels } from './inline';

const FIELD = 'w-full rounded-control border border-hairline bg-transparent px-3 py-2';

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
  rated,
  defaultEmail,
  defaultName,
  defaultPhone,
  full,
}: {
  projectId: string;
  locale: 'ar' | 'en';
  labels: ReportLabels;
  /** Whether this version of the report was already rated (D-345): the form then asks nothing. */
  rated: boolean;
  /** The account's email, offered in the contact field; the founder may change or clear it. */
  defaultEmail: string | null;
  /** The name and the phone of the last download, kept in the account (D-349). */
  defaultName: string;
  defaultPhone: string;
  /** The full report: the name and the phone are then required (D-348). */
  full: boolean;
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
        <fieldset className="grid gap-3 border-0 p-0">
          <legend className="font-bold">{labels.pdf.contact.legend}</legend>
          <p className="text-small text-muted">
            {full ? labels.pdf.contact.hintRequired : labels.pdf.contact.hint}
          </p>
          <label className="grid gap-1 text-small">
            <span>{labels.pdf.contact.name}</span>
            <input
              type="text"
              name="contact_name"
              defaultValue={defaultName}
              required={full}
              autoComplete="name"
              maxLength={120}
              className={FIELD}
            />
          </label>
          <label className="grid gap-1 text-small">
            <span>{labels.pdf.contact.email}</span>
            <input
              type="email"
              name="contact_email"
              autoComplete="email"
              maxLength={254}
              dir="ltr"
              defaultValue={defaultEmail ?? ''}
              className={FIELD}
            />
          </label>
          <label className="grid gap-1 text-small">
            <span>{labels.pdf.contact.phone}</span>
            <input
              type="tel"
              name="contact_phone"
              defaultValue={defaultPhone}
              required={full}
              autoComplete="tel"
              maxLength={26}
              dir="ltr"
              className={FIELD}
            />
          </label>
        </fieldset>
        {rated ? null : (
          <fieldset className="grid gap-3 border-0 p-0">
            <legend className="font-bold">{labels.pdf.rating.legend}</legend>
            <p className="text-small text-muted">{labels.pdf.rating.scale}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {[1, 2, 3, 4, 5].map((stars) => (
                <label key={stars} className="flex items-center gap-2">
                  <input type="radio" name="stars" value={stars} required />
                  <bdi className="num">{stars}</bdi>
                </label>
              ))}
            </div>
            <label className="grid gap-1 text-small">
              <span>{labels.pdf.rating.comment}</span>
              <textarea name="comment" rows={3} maxLength={1000} className={FIELD} />
            </label>
          </fieldset>
        )}
        <div>
          <Button type="submit">{labels.pdf.button}</Button>
        </div>
        <p className="text-caption text-muted">{labels.pdf.hint}</p>
      </form>
    </div>
  );
}
