import { stepLabel, type StepId } from '@sbn/question-bank';
import {
  type BlockId,
  type CanvasBlock,
  type CanvasChip,
  type CanvasKind,
  type CanvasModel,
  type CanvasTotal,
  fillingStep,
} from '@sbn/report/canvas';
import { useLocale, useTranslations } from 'next-intl';
import { LinkPending } from '@/components/ui/link-pending';
import { ProvenanceMark, type ProvenanceSource } from '@/components/ui/provenance-tag';
import { TextLink } from '@/components/ui/text-link';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import type ar from '../../../messages/ar.json';

/** The sources the catalogue names: a step with none would show its key instead of its name. */
type SourceKey = keyof (typeof ar)['canvas']['source'];

/**
 * Where each block sits on the board from the `lg` breakpoint, in the standard geometry (D-051,
 * D-250): ten columns and three rows, physically left to right whatever the language, because the
 * board itself is laid out left to right and only the text inside a block follows the page
 * direction. Customer segments are the rightmost block of both canvases. Below `lg` the blocks
 * stack in the model's filling order instead, starting with the customer segments.
 */
const PLACEMENT: Record<CanvasKind, Partial<Record<BlockId, string>>> = {
  business_model: {
    keyPartners: 'lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-2',
    keyActivities: 'lg:col-start-3 lg:col-span-2 lg:row-start-1',
    keyResources: 'lg:col-start-3 lg:col-span-2 lg:row-start-2',
    valuePropositions: 'lg:col-start-5 lg:col-span-2 lg:row-start-1 lg:row-span-2',
    customerRelationships: 'lg:col-start-7 lg:col-span-2 lg:row-start-1',
    channels: 'lg:col-start-7 lg:col-span-2 lg:row-start-2',
    customerSegments: 'lg:col-start-9 lg:col-span-2 lg:row-start-1 lg:row-span-2',
    costStructure: 'lg:col-start-1 lg:col-span-5 lg:row-start-3',
    revenueStreams: 'lg:col-start-6 lg:col-span-5 lg:row-start-3',
  },
  lean: {
    problem: 'lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-2',
    solution: 'lg:col-start-3 lg:col-span-2 lg:row-start-1',
    keyMetrics: 'lg:col-start-3 lg:col-span-2 lg:row-start-2',
    uniqueValueProposition: 'lg:col-start-5 lg:col-span-2 lg:row-start-1 lg:row-span-2',
    unfairAdvantage: 'lg:col-start-7 lg:col-span-2 lg:row-start-1',
    channels: 'lg:col-start-7 lg:col-span-2 lg:row-start-2',
    customerSegments: 'lg:col-start-9 lg:col-span-2 lg:row-start-1 lg:row-span-2',
    costStructure: 'lg:col-start-1 lg:col-span-5 lg:row-start-3',
    revenueStreams: 'lg:col-start-6 lg:col-span-5 lg:row-start-3',
  },
};

const SOURCES: readonly ProvenanceSource[] = ['user', 'assumption', 'external'];

/** Western digits, isolated from the text around them (CLAUDE.md §6): "50 مطعمًا", "8 د.أ". */
function Isolated({ text }: { text: string }) {
  return text.split(/(\d+(?:[.,]\d+)*)/).map((part, index) =>
    index % 2 === 1 ? (
      <bdi key={index} className="num">
        {part}
      </bdi>
    ) : (
      part
    ),
  );
}

/** The key of a source's message: follow-ups have no dot in theirs ("C7.1" is "C7_1"). */
const sourceKey = (id: StepId) => id.replace('.', '_') as SourceKey;

/** What a mark stands for, in words, for the people who cannot see it. */
function ProvenanceWords({ source }: { source: ProvenanceSource }) {
  const t = useTranslations('provenance');
  return <span className="sr-only">{t(source)}</span>;
}

function Chip({ chip, href }: { chip: CanvasChip; href: string }) {
  const t = useTranslations('canvas');
  return (
    <Link
      href={href}
      className="relative grid gap-0.5 border-s-2 border-hairline py-1.5 ps-3 text-ink no-underline hover:border-ink hover:bg-sunken"
    >
      <span className="flex items-center gap-1.5 text-caption text-muted">
        <ProvenanceMark source={chip.provenance.source} />
        {t(`source.${sourceKey(chip.questionId)}`)}
        <ProvenanceWords source={chip.provenance.source} />
      </span>
      {chip.label ? (
        // The founder's own words, in any script: their own direction (UX-12).
        <span dir="auto" className="text-small font-bold">
          <Isolated text={chip.label} />
        </span>
      ) : null}
      <span dir="auto" className="line-clamp-6 text-small">
        <Isolated text={chip.text} />
      </span>
      <span className="sr-only">{t('edit')}</span>
      <LinkPending />
    </Link>
  );
}

function Totals({ totals }: { totals: readonly CanvasTotal[] }) {
  const t = useTranslations('canvas');
  return (
    <div className="mt-1 grid gap-1.5 border-t border-hairline pt-3">
      <p className="text-caption text-muted">{t('totalsTitle')}</p>
      <dl className="grid gap-1.5">
        {totals.map((total) => (
          <div key={total.kind} className="grid gap-0.5">
            <dt className="text-caption text-ink-2">{t(`total.${total.kind}`)}</dt>
            <dd className="flex items-center gap-1.5 font-display text-small font-extrabold text-gold-ink">
              <ProvenanceMark source={total.provenance.source} />
              <span>
                <Isolated text={total.text} />
              </span>
              <ProvenanceWords source={total.provenance.source} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Block({
  block,
  placement,
  headingId,
  hrefFor,
  englishTerm,
}: {
  block: CanvasBlock;
  placement: string | undefined;
  headingId: string;
  hrefFor: (step: StepId) => string;
  englishTerm: boolean;
}) {
  const t = useTranslations('canvas');
  const locale = useLocale();
  const filling = fillingStep(block);
  return (
    <section
      aria-labelledby={headingId}
      // The board is laid out left to right; the words in a block read in the page direction.
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={cn('flex min-w-0 flex-col gap-3 bg-paper p-4', placement)}
    >
      <h3 id={headingId} className="font-display text-small font-bold">
        {t(`block.${block.id}`)}
        {englishTerm && locale === 'ar' ? (
          <>
            {' '}
            <span className="font-normal text-muted">
              (<bdi lang="en">{t(`term.${block.id}`)}</bdi>)
            </span>
          </>
        ) : null}
      </h3>
      {block.chips.length > 0 ? (
        <ul className="grid gap-1.5">
          {block.chips.map((chip) => (
            <li key={chip.key}>
              <Chip chip={chip} href={hrefFor(chip.questionId)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-1 text-small text-muted">
          <p>{t(`empty.${block.reason ?? 'no_question'}`)}</p>
          {filling ? (
            <p>
              <TextLink href={hrefFor(filling)}>
                {stepLabel(filling)[locale === 'ar' ? 'ar' : 'en']}
              </TextLink>
            </p>
          ) : null}
        </div>
      )}
      {block.totals.length > 0 ? <Totals totals={block.totals} /> : null}
    </section>
  );
}

/**
 * One canvas: nine labelled regions in the standard geometry (D-051, D-250), each with a chip for
 * every answer or list line that feeds it, or the reason it is empty and a link to the question
 * that fills it. Presentational: the page and the gallery give it a model and a way to reach a
 * question, so both show the same board. A chip is a link to the question that holds its answer,
 * so editing uses the diagnostic's own editor (D-249); marks carry the provenance in shape and in
 * words, never in colour alone (rule 2).
 *
 * `englishTerms` lists the blocks whose English term is shown beside the Arabic name: its first
 * use on the page (CLAUDE.md §3). `idPrefix` keeps heading IDs unique when two boards share a page.
 */
export function CanvasBoard({
  model,
  hrefFor,
  idPrefix,
  englishTerms = [],
}: {
  model: CanvasModel;
  hrefFor: (step: StepId) => string;
  idPrefix: string;
  englishTerms?: readonly BlockId[];
}) {
  const t = useTranslations('canvas');
  const tp = useTranslations('provenance');
  const placement = PLACEMENT[model.kind];
  return (
    <div className="grid gap-4">
      <ul
        aria-label={t('legend')}
        className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-ink-2"
      >
        {SOURCES.map((source) => (
          <li key={source} className="inline-flex items-center gap-1.5">
            <ProvenanceMark source={source} />
            {tp(source)}
          </li>
        ))}
      </ul>
      <div dir="ltr" className="grid gap-px border border-hairline bg-hairline lg:grid-cols-10">
        {model.blocks.map((block) => (
          <Block
            key={block.id}
            block={block}
            placement={placement[block.id]}
            headingId={`${idPrefix}-${block.id}`}
            hrefFor={hrefFor}
            englishTerm={englishTerms.includes(block.id)}
          />
        ))}
      </div>
    </div>
  );
}
