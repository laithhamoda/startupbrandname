import { useTranslations } from 'next-intl';

/** Exact Arabic wording from SPEC §6 for low-confidence pivotal numbers. */
export function AssumptionNote() {
  const t = useTranslations('assumption');

  return <p className="border border-dashed border-control px-4 py-2.5 text-small">{t('note')}</p>;
}
