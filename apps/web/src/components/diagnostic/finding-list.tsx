import type { QuestionId } from '@sbn/question-bank';
import { RuleAlert } from '@/components/ui/rule-alert';
import { Link } from '@/i18n/navigation';
import type { FindingView } from '@/lib/diagnostic/findings';

/**
 * Rule messages, firm and never insulting (SPEC §2). A contradiction lists the other answers
 * involved so they can be compared side by side (R6); a blocking one is marked in red.
 */
export function FindingList({
  findings,
  relatedHref,
}: {
  findings: readonly FindingView[];
  /** A link to each related question (a path without the language prefix), on the overview. */
  relatedHref?: (id: QuestionId) => string;
}) {
  return (
    <ul className="grid gap-3">
      {findings.map((finding) => (
        <li
          key={finding.code}
          className={finding.severity === 'block' ? '[&>div]:border-danger' : undefined}
        >
          <RuleAlert message={finding.text}>
            {finding.related.length > 0 ? (
              <ul className="mt-1 grid gap-0.5 text-muted">
                {finding.related.map((related) => (
                  <li key={related.id}>
                    {relatedHref ? (
                      <Link href={relatedHref(related.id)} className="underline underline-offset-4">
                        {related.label}
                      </Link>
                    ) : (
                      related.label
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </RuleAlert>
        </li>
      ))}
    </ul>
  );
}
