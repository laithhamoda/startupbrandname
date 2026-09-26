'use client';

import { Check } from 'lucide-react';
import { Checkbox as RadixCheckbox } from 'radix-ui';
import type { ReactNode } from 'react';

interface CheckboxProps {
  id: string;
  name: string;
  /** May contain links, for example to the terms of use. */
  label: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  defaultChecked?: boolean;
}

/** Unticked by default: consent boxes must never be pre-ticked (SPEC §11). */
export function Checkbox({
  id,
  name,
  label,
  hint,
  error,
  required,
  defaultChecked = false,
}: CheckboxProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-start gap-2.5">
        <RadixCheckbox.Root
          id={id}
          name={name}
          required={required}
          defaultChecked={defaultChecked}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-control border border-control bg-surface data-[state=checked]:border-ink data-[state=checked]:bg-ink aria-[invalid=true]:border-danger"
        >
          <RadixCheckbox.Indicator>
            <Check aria-hidden className="size-4 text-paper" />
          </RadixCheckbox.Indicator>
        </RadixCheckbox.Root>
        <label htmlFor={id}>{label}</label>
      </div>
      {hint ? (
        <p id={hintId} className="ps-7.5 text-caption text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="ps-7.5 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
