import { Field } from './field';
import { controlClass } from './text-input';

interface SelectFieldProps {
  id: string;
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  /** An empty first choice that cannot be picked again. Omit when there is always a value. */
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
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
  required,
  defaultValue,
}: SelectFieldProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {({ describedBy, invalid }) => (
        <select
          id={id}
          name={name}
          required={required}
          defaultValue={defaultValue ?? ''}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={controlClass}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
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
