'use client';

import { Check } from 'lucide-react';
import { Checkbox as RadixCheckbox } from 'radix-ui';

interface CheckboxProps {
  id: string;
  name: string;
  label: string;
  defaultChecked?: boolean;
}

/** Unticked by default: consent boxes must never be pre-ticked (SPEC §11). */
export function Checkbox({ id, name, label, defaultChecked = false }: CheckboxProps) {
  return (
    <div className="flex items-start gap-2.5">
      <RadixCheckbox.Root
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-control border border-control bg-surface data-[state=checked]:border-ink data-[state=checked]:bg-ink"
      >
        <RadixCheckbox.Indicator>
          <Check aria-hidden className="size-4 text-paper" />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
