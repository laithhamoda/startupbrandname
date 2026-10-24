import type { Section } from '@sbn/report/model';
import { useId } from 'react';
import { ReportBlock } from '@/components/report/blocks';
import type { ReportLabels } from '@/components/report/inline';
import { type NoticeReason, ReportNotice } from '@/components/report/notice';

export type ProjectResultView =
  | { readonly status: 'none' }
  | { readonly status: 'verdict'; readonly section: Section }
  | { readonly status: 'needs_answers'; readonly reasons: readonly NoticeReason[] }
  | { readonly status: 'failed' };

/**
 * The check result on the project page (D-286): the verdict slab of the one-page summary, and for a
 * stop its fixed sentence and three changes, so the founder meets the answer where the diagnostic
 * ends. When there is no verdict it says why in words: not enough answers yet, or which answers to
 * give or correct, with a link to each. The words of the verdict are the model's; the rest are the
 * report page's own (`labels`). No client JavaScript, and the slab is drawn still (D-287).
 */
export function ProjectResult({
  view,
  heading,
  locale,
  labels,
}: {
  view: ProjectResultView;
  heading: string;
  locale: 'ar' | 'en';
  labels: ReportLabels;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <h2 id={headingId} className="text-h3 font-bold">
        {heading}
      </h2>
      {view.status === 'verdict' ? (
        <div className="grid gap-5">
          {view.section.blocks.map((block, index) => (
            <ReportBlock
              key={index}
              block={block}
              id={`${headingId}-${String(index)}`}
              locale={locale}
              labels={labels}
              still
            />
          ))}
        </div>
      ) : view.status === 'needs_answers' && view.reasons.length > 0 ? (
        <ReportNotice failed={false} reasons={view.reasons} labels={labels} />
      ) : view.status === 'none' ? (
        <div className="reading grid gap-1 border-s-[3px] border-ink bg-sunken px-4 py-3 text-small">
          <p className="font-bold">{labels.none.title}</p>
          <p>{labels.none.lead}</p>
        </div>
      ) : (
        <ReportNotice failed reasons={[]} labels={labels} />
      )}
    </section>
  );
}
