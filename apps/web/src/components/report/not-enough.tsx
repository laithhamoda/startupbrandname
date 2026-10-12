import { Progress } from '@/components/ui/progress';
import { TextLink } from '@/components/ui/text-link';
import type { ReportLabels } from './inline';

export interface MissingQuestion {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

/**
 * What the report page shows below the summary gate (D-273): no report, the completeness now, and
 * the most important missing questions with links to answer them. No value of the project is
 * computed or shown here.
 */
export function NotEnoughAnswers({
  percent,
  missing,
  backHref,
  labels,
}: {
  percent: number;
  missing: readonly MissingQuestion[];
  backHref: string;
  labels: ReportLabels;
}) {
  return (
    <div className="mx-auto grid max-w-[75rem] gap-6 px-4 py-10 sm:px-6">
      <p className="text-small text-muted">
        <TextLink href={backHref}>{labels.back}</TextLink>
      </p>
      <h1 className="text-h1 font-extrabold">{labels.none.title}</h1>
      <p className="reading">{labels.none.lead}</p>
      <div className="max-w-[28rem]">
        <Progress value={percent} label={labels.none.progress} />
      </div>
      {missing.length > 0 ? (
        <section
          aria-labelledby="report-missing"
          className="grid gap-3 border-t border-hairline pt-6"
        >
          <h2 id="report-missing" className="text-h3 font-bold">
            {labels.none.missingTitle}
          </h2>
          <p className="reading text-small text-muted">{labels.none.missingLead}</p>
          <ul className="grid gap-2">
            {missing.map((question) => (
              <li key={question.id}>
                <TextLink href={question.href}>{question.label}</TextLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
