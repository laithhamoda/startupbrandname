import type { NotCalculableReason } from '@sbn/engine';
import { TextLink } from '@/components/ui/text-link';
import type { ReportLabels } from './inline';

export interface NoticeReason {
  readonly key: string;
  /** What the reason says, in words. */
  readonly text: string;
  readonly link: { readonly label: string; readonly href: string } | null;
}

/** The reasons once each, whichever question they concern (the engine may repeat one). */
export function distinctReasons(
  reasons: readonly NotCalculableReason[],
): readonly NotCalculableReason[] {
  return reasons.filter(
    (reason, index, all) =>
      all.findIndex(
        (other) => other.code === reason.code && other.questionId === reason.questionId,
      ) === index,
  );
}

/**
 * Said above the report when the numbers could not be calculated: the summary is still drawn from
 * the answers (D-231, D-273). A failure shows one sentence; a run that needs more answers lists
 * them with a link to each question.
 */
export function ReportNotice({
  failed,
  reasons,
  labels,
}: {
  failed: boolean;
  reasons: readonly NoticeReason[];
  labels: ReportLabels;
}) {
  if (failed) {
    return (
      <p
        role="note"
        className="mx-auto max-w-[75rem] border-s-[3px] border-ink bg-sunken px-4 py-3 text-small"
      >
        {labels.notice.failed}
      </p>
    );
  }
  if (reasons.length === 0) return null;
  return (
    <section
      aria-labelledby="report-notice"
      className="mx-auto grid max-w-[68ch] gap-2 border-s-[3px] border-ink bg-sunken px-4 py-3 text-small"
    >
      <h2 id="report-notice" className="font-bold">
        {labels.notice.title}
      </h2>
      <p>{labels.notice.lead}</p>
      <ul className="grid gap-1.5">
        {reasons.map((reason) => (
          <li key={reason.key}>
            {reason.text}
            {reason.link ? (
              <>
                {' '}
                <TextLink href={reason.link.href}>{reason.link.label}</TextLink>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
