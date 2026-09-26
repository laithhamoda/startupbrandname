'use client';

import { Tabs as RadixTabs } from 'radix-ui';
import type { ReactNode } from 'react';

interface TabsProps {
  label: string;
  tabs: readonly { value: string; title: string; content: ReactNode }[];
  defaultValue?: string;
}

export function Tabs({ label, tabs, defaultValue }: TabsProps) {
  return (
    <RadixTabs.Root defaultValue={defaultValue ?? tabs[0]?.value}>
      <RadixTabs.List aria-label={label} className="flex gap-6 border-b border-hairline">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className="-mb-px border-b-2 border-transparent py-2 font-display text-small font-bold text-muted data-[state=active]:border-ink data-[state=active]:text-ink"
          >
            {tab.title}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.value} value={tab.value} className="pt-4">
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
