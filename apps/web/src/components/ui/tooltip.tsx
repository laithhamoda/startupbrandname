'use client';

import { Tooltip as RadixTooltip } from 'radix-ui';
import type { ReactNode } from 'react';

/**
 * Supplementary hint only; never the sole place important information appears. It brings its own
 * provider, so Radix's tooltip code loads only on pages that show a tooltip, not in the root
 * layout of every page (PERF-8).
 */
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={6}
            className="max-w-xs rounded-control bg-ink px-3 py-1.5 text-caption text-paper"
          >
            {content}
            <RadixTooltip.Arrow className="fill-ink" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
