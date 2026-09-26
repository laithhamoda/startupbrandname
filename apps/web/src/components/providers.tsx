'use client';

import { Direction, Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';

/** The page direction for every Radix primitive (keyboard arrows, alignment) and one tooltip timing. */
export function Providers({ dir, children }: { dir: 'rtl' | 'ltr'; children: ReactNode }) {
  return (
    <Direction.Provider dir={dir}>
      <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
    </Direction.Provider>
  );
}
