import { Field } from './field';
import { controlClass } from './text-input';

interface SelectFieldProps {
  id: string;
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  placeholder: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
}

// A native select: fully accessible and familiar on phones, styled with the design tokens.
export function SelectField({
  id,
  name,
  label,
  options,
  placeholder,
  hint,
  error,
  defaultValue,
}: SelectFieldProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {({ describedBy, invalid }) => (
        <select
          id={id}
          name={name}
          defaultValue={defaultValue ?? ''}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={controlClass}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
