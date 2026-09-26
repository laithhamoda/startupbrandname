import { useTranslations } from 'next-intl';

export type CurrencyCode = 'JOD' | 'DZD' | 'USD';

export const CURRENCIES: readonly CurrencyCode[] = ['JOD', 'DZD', 'USD'];

/**
 * An amount with its currency after the number: "250 د.أ" in Arabic, "250 JOD" in English
 * (CLAUDE.md §6). `value` arrives already formatted by the engine; this component never
 * computes or rounds.
 */
export function Money({ value, currency }: { value: string; currency: CurrencyCode }) {
  const t = useTranslations('money');

  return (
    <span className="whitespace-nowrap">
      <bdi className="num">{value}</bdi> {t(`symbol.${currency}`)}
    </span>
  );
}
