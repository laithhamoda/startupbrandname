'use client';

import { Direction, Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';

/** Right-to-left for every Radix primitive (keyboard arrows, alignment) and one tooltip timing. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <Direction.Provider dir="rtl">
      <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
    </Direction.Provider>
  );
}
