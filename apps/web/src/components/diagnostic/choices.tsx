'use client';

import { Check } from 'lucide-react';
import { Checkbox as RadixCheckbox, RadioGroup as RadixRadioGroup } from 'radix-ui';
import { cn } from '@/lib/cn';

interface Choice {
  value: string;
  label: string;
}

/**
 * Controlled single choice. Labelled by the question heading (or its own label), since each
 * diagnostic screen asks one question.
 */
export function ChoiceGroup({
  id,
  labelledBy,
  options,
  value,
  onChange,
  inline = false,
}: {
  id: string;
  labelledBy: string;
  options: readonly Choice[];
  value: string;
  onChange: (value: string) => void;
  inline?: boolean;
}) {
  return (
    <RadixRadioGroup.Root
      value={value}
      onValueChange={onChange}
      aria-labelledby={labelledBy}
      className={cn(inline ? 'flex flex-wrap gap-x-8 gap-y-3' : 'grid gap-3')}
    >
      {options.map((option) => {
        const optionId = `${id}-${option.value}`;
        return (
          <div key={option.value} className="flex items-center gap-2.5">
            <RadixRadioGroup.Item
              id={optionId}
              value={option.value}
              className="flex size-5 shrink-0 items-center justify-center rounded-pill border border-control bg-surface data-[state=checked]:border-ink"
            >
              <RadixRadioGroup.Indicator className="block size-2.5 rounded-pill bg-ink" />
            </RadixRadioGroup.Item>
            <label htmlFor={optionId}>{option.label}</label>
          </div>
        );
      })}
    </RadixRadioGroup.Root>
  );
}

/** Controlled multiple choice, as a labelled group of checkboxes. */
export function CheckboxGroup({
  id,
  labelledBy,
  options,
  values,
  onChange,
  columns = 1,
}: {
  id: string;
  labelledBy: string;
  options: readonly Choice[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cn(
        'grid gap-3',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'grid-cols-2 sm:grid-cols-3',
      )}
    >
      {options.map((option) => {
        const optionId = `${id}-${option.value}`;
        const checked = values.includes(option.value);
        return (
          <div key={option.value} className="flex items-center gap-2.5">
            <RadixCheckbox.Root
              id={optionId}
              checked={checked}
              onCheckedChange={(state) => {
                onChange(
                  state === true
                    ? [...values, option.value]
                    : values.filter((value) => value !== option.value),
                );
              }}
              className="flex size-5 shrink-0 items-center justify-center rounded-control border border-control bg-surface data-[state=checked]:border-ink data-[state=checked]:bg-ink"
            >
              <RadixCheckbox.Indicator>
                <Check aria-hidden className="size-4 text-paper" />
              </RadixCheckbox.Indicator>
            </RadixCheckbox.Root>
            <label htmlFor={optionId}>{option.label}</label>
          </div>
        );
      })}
    </div>
  );
}
