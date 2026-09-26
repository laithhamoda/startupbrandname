import { cn } from '@/lib/cn';
import { Field } from './field';
import { CURRENCY_LABEL, CURRENCY_NAME, type CurrencyCode } from './money';
import { controlClass } from './text-input';

const CURRENCIES: readonly CurrencyCode[] = ['JOD', 'DZD', 'USD'];

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
            className={cn(controlClass, 'num text-start')}
          />
          <select
            name={`${name}.currency`}
            required
            defaultValue={defaultCurrency ?? ''}
            aria-label={`عملة ${label}`}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={controlClass}
          >
            <option value="" disabled>
              اختر العملة
            </option>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {CURRENCY_LABEL[code]} · {CURRENCY_NAME[code]}
              </option>
            ))}
          </select>
        </div>
      )}
    </Field>
  );
}
