export type CurrencyCode = 'JOD' | 'DZD' | 'USD';

export const CURRENCY_LABEL: Record<CurrencyCode, string> = { JOD: 'د.أ', DZD: 'د.ج', USD: '$' };

export const CURRENCY_NAME: Record<CurrencyCode, string> = {
  JOD: 'دينار أردني',
  DZD: 'دينار جزائري',
  USD: 'دولار أمريكي',
};

/**
 * An amount with its currency after the number: "250 د.أ" (CLAUDE.md §6).
 * `value` arrives already formatted by the engine; this component never computes or rounds.
 */
export function Money({ value, currency }: { value: string; currency: CurrencyCode }) {
  return (
    <span className="whitespace-nowrap">
      <bdi className="num">{value}</bdi> {CURRENCY_LABEL[currency]}
    </span>
  );
}
