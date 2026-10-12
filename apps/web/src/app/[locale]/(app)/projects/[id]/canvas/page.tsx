import { stepLabel } from '@sbn/question-bank';
import {
  type BlockId,
  buildBusinessModelCanvas,
  buildLeanCanvas,
  CANVAS_MAP,
} from '@sbn/report/canvas';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CanvasBoard } from '@/components/canvas/canvas-board';
import { Tabs } from '@/components/ui/tabs';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';
import { projectPath, stepFromCanvasPath } from '@/lib/diagnostic/steps';
import { analyseProject } from '@/lib/engine/analyse';
import { canvasTotals } from '@/lib/engine/totals';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('canvas');
  // Never the project's title: the founder typed it, and it travels into browser history.
  return { title: t('pageTitle'), robots: { index: false, follow: false } };
}

/** The block names of the Lean Canvas that the Business Model Canvas has not already shown. */
function newTerms(shown: readonly BlockId[], blocks: readonly BlockId[]): BlockId[] {
  return blocks.filter((id) => !shown.includes(id));
}

/**
 * The project's Business Model Canvas and Lean Canvas, built from the founder's own answers
 * (T1, T2, D-231). Every chip leads to the question that holds its answer and brings the founder
 * back here after saving (D-249), so the answer stays the single source (rule 3). The page runs the
 * engine on the answers, records the run by its input hash (rule 4, D-238) and shows its cost
 * totals; when the run cannot be calculated, the canvases still show every chip.
 */
export default async function CanvasPage({ params }: PageProps<'/[locale]/projects/[id]/canvas'>) {
  const locale = await currentLocale();
  const { supabase } = await requireAccount(locale);
  const analysis = await analyseProject(supabase, (await params).id);
  if (!analysis) notFound();
  const { source, outcome } = analysis;
  const { project } = source;
  const t = await getTranslations('canvas');
  const money = await getTranslations('money');

  // The label after an amount: the symbol where the site has one, else the ISO code.
  const symbols: Record<string, string> = {
    JOD: money('symbol.JOD'),
    DZD: money('symbol.DZD'),
    USD: money('symbol.USD'),
  };
  const currencyLabel = (code: string) => symbols[code] ?? code;
  const totals =
    outcome.status === 'ok' ? canvasTotals(outcome.run, { language: locale, currencyLabel }) : [];
  const input = {
    language: locale,
    answers: source.answers,
    provenance: source.provenance,
    currencyLabel,
    totals,
  };
  const hrefFor = (step: Parameters<typeof stepFromCanvasPath>[1]) =>
    stepFromCanvasPath(project.id, step);

  const businessModelBlocks = CANVAS_MAP.business_model.map((block) => block.id);
  const leanBlocks = CANVAS_MAP.lean.map((block) => block.id);
  const reasons =
    outcome.status === 'not_calculable'
      ? outcome.reasons.filter(
          (reason, index, all) =>
            all.findIndex(
              (other) => other.code === reason.code && other.questionId === reason.questionId,
            ) === index,
        )
      : [];

  return (
    <div className="mx-auto grid max-w-[90rem] gap-8 px-4 py-10 sm:px-6">
      <header className="grid gap-3">
        <p className="text-small text-muted">
          <TextLink href={projectPath(project.id)}>{t('back')}</TextLink>
        </p>
        <h1 className="text-h1 font-extrabold">{t('title')}</h1>
        <p className="reading text-muted">{t('lead')}</p>
      </header>

      {reasons.length > 0 ? (
        <section
          aria-labelledby="canvas-notice"
          className="grid max-w-[68ch] gap-2 border-s-[3px] border-ink bg-sunken px-4 py-3 text-small"
        >
          <h2 id="canvas-notice" className="font-bold">
            {t('notice.title')}
          </h2>
          <p>{t('notice.lead')}</p>
          <ul className="grid gap-1.5">
            {reasons.map((reason) => (
              <li key={`${reason.code}-${reason.questionId ?? ''}`}>
                {t(`notice.reason.${reason.code}`)}
                {reason.questionId ? (
                  <>
                    {' '}
                    <TextLink href={hrefFor(reason.questionId)}>
                      {stepLabel(reason.questionId)[locale]}
                    </TextLink>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {outcome.status === 'failed' ? (
        <p
          role="note"
          className="max-w-[68ch] border-s-[3px] border-ink bg-sunken px-4 py-3 text-small"
        >
          {t('notice.failed')}
        </p>
      ) : null}

      <Tabs
        label={t('tabsLabel')}
        tabs={[
          {
            value: 'business_model',
            title: t('tab.business_model'),
            content: (
              <div className="grid gap-4">
                <h2 id="canvas-bmc" className="sr-only">
                  {t('tab.business_model')}
                </h2>
                <CanvasBoard
                  model={buildBusinessModelCanvas(input)}
                  hrefFor={hrefFor}
                  idPrefix="bmc"
                  englishTerms={businessModelBlocks}
                />
              </div>
            ),
          },
          {
            value: 'lean',
            title: t('tab.lean'),
            content: (
              <div className="grid gap-4">
                <h2 id="canvas-lean" className="sr-only">
                  {t('tab.lean')}
                </h2>
                <CanvasBoard
                  model={buildLeanCanvas(input)}
                  hrefFor={hrefFor}
                  idPrefix="lean"
                  englishTerms={newTerms(businessModelBlocks, leanBlocks)}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
