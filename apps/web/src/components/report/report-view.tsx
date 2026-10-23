import type { ReportModel, Section } from '@sbn/report/model';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { TextLink } from '@/components/ui/text-link';
import { ReportBlock } from './blocks';
import type { ReportLabels } from './inline';

export interface ReportHrefs {
  /** The project page, where the founder goes back to and continues the diagnostic from. */
  readonly project: string;
  /** The pricing page: paid plans open later, and there is no purchase flow before M7. */
  readonly pricing: string;
}

const sectionAnchor = (section: Section) => `section-${section.id}`;

function ContentsList({
  sections,
  labels,
}: {
  sections: readonly Section[];
  labels: ReportLabels;
}) {
  return (
    <ul className="grid gap-1.5 text-small">
      {sections.map((section) => (
        <li key={section.id}>
          <a href={`#${sectionAnchor(section)}`} className="text-teal-ink hover:underline">
            {section.title}
          </a>
          {section.locked ? <span className="text-muted"> ({labels.contents.locked})</span> : null}
        </li>
      ))}
    </ul>
  );
}

function LockedSection({
  model,
  labels,
  hrefs,
}: {
  model: ReportModel;
  labels: ReportLabels;
  hrefs: ReportHrefs;
}) {
  const byPlan = model.lockReason === 'plan';
  return (
    <div className="reading grid gap-2 border-s-[3px] border-hairline bg-sunken px-4 py-3 text-small">
      <p className="flex items-start gap-2">
        <Lock aria-hidden className="mt-1.5 size-4 shrink-0 text-ink-2" />
        <span>
          <span className="sr-only">{labels.lock.label}. </span>
          {byPlan ? labels.lock.plan : labels.lock.completeness}
        </span>
      </p>
      <p>
        {byPlan ? (
          <TextLink href={hrefs.pricing}>{labels.lock.pricing}</TextLink>
        ) : (
          <TextLink href={hrefs.project}>{labels.lock.continue}</TextLink>
        )}
      </p>
    </div>
  );
}

/**
 * The report on screen (D-274): the model drawn as a page, from the server, with no client
 * JavaScript. One h1 (the founder's project title, escaped), an h2 for each section, a contents
 * list (a sticky column on a wide screen, a disclosure on a phone), and a locked section as its
 * title with a short note and the way to open it. A locked section holds no block at all: what it
 * would have said was never computed (D-232).
 */
export function ReportView({
  model,
  labels,
  hrefs,
  actions,
  embedded = false,
}: {
  model: ReportModel;
  labels: ReportLabels;
  hrefs: ReportHrefs;
  /** What the founder can do with the report, drawn under its title (the PDF download). */
  actions?: ReactNode;
  /**
   * The report sits inside a page that has its own h1 (the public sample report, D-293): the
   * project's title is then an h2 and there is no link back to a project.
   */
  embedded?: boolean;
}) {
  return (
    <div className="mx-auto max-w-[75rem] px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
      <aside className="hidden lg:block">
        <nav aria-label={labels.contents.title} className="sticky top-6 grid gap-3">
          <p className="font-display font-bold">{labels.contents.title}</p>
          <ContentsList sections={model.sections} labels={labels} />
        </nav>
      </aside>
      <div className="grid min-w-0 content-start gap-10">
        <header className="grid gap-3">
          {embedded ? null : (
            <p className="text-small text-muted">
              <TextLink href={hrefs.project}>{labels.back}</TextLink>
            </p>
          )}
          <p className="text-caption text-muted">{labels.kind[model.kind]}</p>
          {embedded ? (
            <h2 className="text-h2 font-extrabold">
              <span dir="auto">{model.meta.title}</span>
            </h2>
          ) : (
            <h1 className="text-h1 font-extrabold">
              {/* Typed by the founder, in any script: its own direction. */}
              <span dir="auto">{model.meta.title}</span>
            </h1>
          )}
          {model.kind === 'summary' ? (
            <p className="reading text-muted">{labels.summaryLead}</p>
          ) : null}
          {actions}
        </header>

        <details className="border-y border-hairline py-3 lg:hidden">
          <summary className="cursor-pointer font-display font-bold">
            {labels.contents.title}
          </summary>
          <nav aria-label={labels.contents.title} className="pt-3">
            <ContentsList sections={model.sections} labels={labels} />
          </nav>
        </details>

        {model.sections.map((section) => (
          <section
            key={section.id}
            id={sectionAnchor(section)}
            aria-labelledby={`heading-${section.id}`}
            className="grid scroll-mt-6 gap-5 border-t border-hairline pt-8"
          >
            <h2 id={`heading-${section.id}`} className="text-h2 font-bold">
              {section.title}
            </h2>
            {section.locked ? (
              <LockedSection model={model} labels={labels} hrefs={hrefs} />
            ) : (
              section.blocks.map((block, index) => (
                <ReportBlock
                  key={index}
                  block={block}
                  id={`${section.id}-${String(index)}`}
                  locale={model.locale}
                  labels={labels}
                />
              ))
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
