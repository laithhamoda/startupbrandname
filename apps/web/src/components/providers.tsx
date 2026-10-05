'use client';

import { Direction } from 'radix-ui';
import type { ReactNode } from 'react';

/**
 * The page direction for every Radix primitive (keyboard arrows, alignment). Tooltips bring their
 * own provider (`components/ui/tooltip.tsx`), so pages without one do not load it (PERF-8).
 */
export function Providers({ dir, children }: { dir: 'rtl' | 'ltr'; children: ReactNode }) {
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>;
}
