import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { Field } from './field';
import { CURRENCIES, type CurrencyCode } from './money';
import { controlClass } from './text-input';

interface MoneyFieldProps {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultAmount?: string;
  /** No default on purpose: currency is never inferred (CLAUDE.md §3, Language). */
  defaultCurrency?: CurrencyCode;
}

/** Amount plus an explicit currency. The currency starts empty and is required. */
export function MoneyField({
  id,
  name,
  label,
  hint,
  error,
  defaultAmount,
  defaultCurrency,
}: MoneyFieldProps) {
  const t = useTranslations('money');

  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {({ describedBy, invalid }) => (
        <div className="grid grid-cols-[1fr_9.5rem] gap-2">
          <input
            id={id}
            name={`${name}.amount`}
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            defaultValue={defaultAmount}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            // Digits are always left-to-right; "end" keeps the amount beside the label's side.
            className={cn(controlClass, 'num text-end')}
          />
          <select
            name={`${name}.currency`}
            required
            defaultValue={defaultCurrency ?? ''}
            aria-label={t('currencyOf', { label })}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={controlClass}
          >
            <option value="" disabled>
              {t('chooseCurrency')}
            </option>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {t(`symbol.${code}`)} · {t(`name.${code}`)}
              </option>
            ))}
          </select>
        </div>
      )}
    </Field>
  );
}
