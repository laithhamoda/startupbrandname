'use client';

import { RadioGroup as RadixRadioGroup } from 'radix-ui';
import { cn } from '@/lib/cn';

interface RadioGroupProps {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
  error?: string;
  /** Short options (yes / no) side by side instead of stacked. */
  inline?: boolean;
}

export function RadioGroup({
  name,
  label,
  options,
  defaultValue,
  required,
  error,
  inline = false,
}: RadioGroupProps) {
  const labelId = `${name}-label`;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div className="grid gap-2">
      <span id={labelId} className="font-display text-small font-bold">
        {label}
      </span>
      <RadixRadioGroup.Root
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-labelledby={labelId}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className={cn(inline ? 'flex flex-wrap gap-x-8 gap-y-2' : 'grid gap-2')}
      >
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          return (
            <div key={option.value} className="flex items-center gap-2.5">
              <RadixRadioGroup.Item
                id={id}
                value={option.value}
                className="flex size-5 shrink-0 items-center justify-center rounded-pill border border-control bg-surface data-[state=checked]:border-ink"
              >
                <RadixRadioGroup.Indicator className="block size-2.5 rounded-pill bg-ink" />
              </RadixRadioGroup.Item>
              <label htmlFor={id}>{option.label}</label>
            </div>
          );
        })}
      </RadixRadioGroup.Root>
      {error ? (
        <p id={errorId} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
