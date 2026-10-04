import {
  AXES,
  AXIS_NAMES,
  type Axis,
  type Completeness,
  displayPercent,
  getQuestion,
  type Language,
  SUMMARY_THRESHOLD,
  FULL_THRESHOLD,
} from '@sbn/question-bank';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TextLink } from '@/components/ui/text-link';
import { cn } from '@/lib/cn';

/** Eight segments, one per axis, filled by the share answered; the current axis is outlined. */
export function AxisProgress({
  byAxis,
  current,
  language,
}: {
  byAxis: Completeness['byAxis'];
  current?: Axis;
  language: Language;
}) {
  const t = useTranslations('diagnostic');
  return (
    <ol aria-label={t('axesProgress')} className="grid grid-cols-8 gap-1">
      {AXES.map((axis) => {
        const percent = Math.round(byAxis[axis] * 100);
        return (
          <li key={axis} className="grid gap-1">
            <span
              aria-hidden
              className={cn(
                'block h-1.5 bg-sunken',
                axis === current && 'outline outline-1 outline-offset-2 outline-ink',
              )}
            >
              <span
                className="block h-full bg-teal-ink"
                style={{ inlineSize: `${String(percent)}%` }}
              />
            </span>
            <span className="sr-only">
              {AXIS_NAMES[axis][language]}: {percent}%
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The completeness score and what it unlocks (SPEC §3): the one-page summary from 40%, the full
 * report from 80% with the price and costs answered.
 */
export function CompletenessPanel({
  result,
  language,
  overviewHref,
}: {
  result: Completeness;
  language: Language;
  /** Omitted on the overview itself. */
  overviewHref?: string;
}) {
  const t = useTranslations('diagnostic.completeness');
  const percent = displayPercent(result.score);
  const summary = result.gate !== 'none';
  const full = result.gate === 'full';

  return (
    <section
      aria-labelledby="completeness-heading"
      className="grid content-start gap-4 border-t-2 border-ink pt-4"
    >
      <h2 id="completeness-heading" className="font-display text-small font-bold text-muted">
        {t('title')}
      </h2>
      <p className="font-display text-h1 font-extrabold text-gold-ink">
        <bdi className="num">{percent}%</bdi>
      </p>
      <div
        role="progressbar"
        aria-label={t('title')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-full bg-sunken"
      >
        <div className="h-full bg-teal-ink" style={{ inlineSize: `${String(percent)}%` }} />
      </div>
      <ul className="grid gap-2 text-small">
        <li className="flex items-start gap-2">
          <Check
            aria-hidden
            className={cn('mt-1 size-4 shrink-0', summary ? 'text-ink' : 'text-hairline')}
          />
          <span>
            {t('summary', { threshold: SUMMARY_THRESHOLD })}{' '}
            <span className="text-muted">{summary ? t('unlocked') : t('locked')}</span>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check
            aria-hidden
            className={cn('mt-1 size-4 shrink-0', full ? 'text-ink' : 'text-hairline')}
          />
          <span>
            {t('full', { threshold: FULL_THRESHOLD })}{' '}
            <span className="text-muted">{full ? t('unlocked') : t('locked')}</span>
            {result.missingForFull.length > 0 ? (
              <span className="block text-caption text-muted">
                {t('needs')}{' '}
                {result.missingForFull
                  .map((id) => getQuestion(id).label[language])
                  .join(language === 'ar' ? '، ' : ', ')}
              </span>
            ) : null}
          </span>
        </li>
      </ul>
      {overviewHref ? (
        <TextLink href={overviewHref} className="justify-self-start text-small">
          {t('overview')}
        </TextLink>
      ) : null}
    </section>
  );
}
