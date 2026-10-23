import type { Block, CalloutTone, DefinitionItem } from '@sbn/report/model';
import { CellValue } from './cell';
import { ReportCanvas } from './canvas';
import { ExternalLink, InlineText, httpsUrl, type ReportLabels } from './inline';
import { ReportTable } from './table';
import { ReportVerdict } from './verdict';
import { cn } from '@/lib/cn';

const CALLOUT_STYLE: Record<CalloutTone, string> = {
  low_confidence: 'border-gold-ink',
  tax: 'border-ink',
  adviser: 'border-ink',
  verify: 'border-ink-2',
  worry: 'border-ink-2',
  info: 'border-control',
};

/** A short tag or label drawn as text in an outline: meaning in words and shape, not colour. */
function Chip({ children }: { children: string }) {
  return (
    <span className="inline-block border border-ink-2 px-1.5 text-caption font-bold text-ink-2">
      {children}
    </span>
  );
}

function Definition({ item, labels }: { item: DefinitionItem; labels: ReportLabels }) {
  const href = item.url === null ? null : httpsUrl(item.url);
  return (
    <div className="grid gap-1 border-s-2 border-hairline ps-4">
      <dt className="flex flex-wrap items-center gap-2 font-bold">
        <span>
          <InlineText parts={item.term} />
        </span>
        {item.tag ? <Chip>{item.tag}</Chip> : null}
      </dt>
      <dd className="reading grid gap-1 text-small">
        <span>
          <CellValue cell={item.definition} labels={labels} />
        </span>
        {item.label ? (
          <span>
            <Chip>{item.label.text}</Chip>
          </span>
        ) : null}
        {href ? (
          <span>
            <ExternalLink url={href} className="break-all">
              <bdi dir="ltr">{href}</bdi>
              <span className="sr-only"> ({labels.link.external})</span>
            </ExternalLink>
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * One block of the model (D-274). Every block type of the closed set has its drawing, the switch is
 * exhaustive, and no block sets HTML: the model's strings are escaped by React.
 */
export function ReportBlock({
  block,
  id,
  locale,
  labels,
  still,
}: {
  block: Block;
  id: string;
  locale: 'ar' | 'en';
  labels: ReportLabels;
  /** Draw a verdict slab without its reveal motion (the project page, D-287). */
  still?: boolean;
}) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="reading">
          <InlineText parts={block.text} />
        </p>
      );
    case 'note':
      return (
        <p className="reading text-small text-muted">
          <InlineText parts={block.text} />
        </p>
      );
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <div className="reading grid gap-2">
          {block.title ? (
            <p className="font-bold">
              <InlineText parts={block.title} />
            </p>
          ) : null}
          <List className={cn('grid gap-1.5 ps-6', block.ordered ? 'list-decimal' : 'list-disc')}>
            {block.items.map((item, index) => (
              <li key={index}>
                <InlineText parts={item} />
              </li>
            ))}
          </List>
        </div>
      );
    }
    case 'keyNumbers':
      return (
        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
          {block.items.map((item, index) => (
            <li key={index} className="grid content-start gap-1 border-t border-hairline pt-3">
              <span className="text-caption text-muted">
                <InlineText parts={item.label} />
              </span>
              <span className="font-display text-h2 font-extrabold text-gold-ink">
                <CellValue cell={item.value} labels={labels} />
              </span>
              <span className="text-small text-muted">
                <InlineText parts={item.caption} />
              </span>
            </li>
          ))}
        </ul>
      );
    case 'verdict':
      return <ReportVerdict block={block} labels={labels} still={still} />;
    case 'table':
      return <ReportTable block={block} id={id} labels={labels} />;
    case 'definitionList':
      return (
        <div className="grid gap-3">
          {block.title ? (
            <p className="font-bold">
              <InlineText parts={block.title} />
            </p>
          ) : null}
          <dl className="grid gap-4">
            {block.items.map((item, index) => (
              <Definition key={index} item={item} labels={labels} />
            ))}
          </dl>
        </div>
      );
    case 'canvas':
      return <ReportCanvas block={block} id={id} locale={locale} labels={labels} />;
    case 'callout':
      return (
        <p
          role="note"
          className={cn(
            'reading border-s-[3px] bg-sunken px-4 py-3 text-small',
            CALLOUT_STYLE[block.tone],
          )}
        >
          <InlineText parts={block.text} />
        </p>
      );
    case 'link': {
      const href = httpsUrl(block.url);
      return (
        <p className="flex flex-wrap items-center gap-2 text-small">
          {href ? (
            <ExternalLink url={href}>
              <InlineText parts={block.label} />
              <span className="sr-only"> ({labels.link.external})</span>
            </ExternalLink>
          ) : (
            <InlineText parts={block.label} />
          )}
          {block.labelText ? <Chip>{block.labelText}</Chip> : null}
        </p>
      );
    }
  }
}
