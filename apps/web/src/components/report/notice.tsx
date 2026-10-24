import type { NotCalculableReason } from '@sbn/engine';
import { type Language, stepLabel } from '@sbn/question-bank';
import { TextLink } from '@/components/ui/text-link';
import { cn } from '@/lib/cn';
import { stepPath } from '@/lib/diagnostic/steps';
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
 * The reasons the numbers could not be calculated, each once, in words and with a link to the
 * question to answer or correct. `text` says a reason in the project's language.
 */
export function noticeReasonsOf(
  reasons: readonly NotCalculableReason[],
  projectId: string,
  locale: Language,
  text: (code: NotCalculableReason['code']) => string,
): NoticeReason[] {
  return distinctReasons(reasons).map((reason) => ({
    key: `${reason.code}-${reason.questionId ?? ''}`,
    text: text(reason.code),
    link: reason.questionId
      ? {
          label: stepLabel(reason.questionId)[locale],
          href: stepPath(projectId, reason.questionId),
        }
      : null,
  }));
}

/**
 * Said above the report when the numbers could not be calculated: the summary is still drawn from
 * the answers (D-231, D-273). A failure shows one sentence; a run that needs more answers lists
 * them with a link to each question. The project page says it too (D-286): the report page centres
 * the notice above its own column, so the placing is the caller's (`className`).
 */
export function ReportNotice({
  failed,
  reasons,
  labels,
  className,
}: {
  failed: boolean;
  reasons: readonly NoticeReason[];
  labels: ReportLabels;
  className?: string;
}) {
  if (failed) {
    return (
      <p
        role="note"
        className={cn(
          'max-w-[75rem] border-s-[3px] border-ink bg-sunken px-4 py-3 text-small',
          className,
        )}
      >
        {labels.notice.failed}
      </p>
    );
  }
  if (reasons.length === 0) return null;
  return (
    <section
      aria-labelledby="report-notice"
      className={cn(
        'grid max-w-[68ch] gap-2 border-s-[3px] border-ink bg-sunken px-4 py-3 text-small',
        className,
      )}
    >
      <p id="report-notice" className="font-bold">
        {labels.notice.title}
      </p>
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
