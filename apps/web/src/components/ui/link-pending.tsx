'use client';

import { useLinkStatus } from 'next/link';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Placed inside a link: while the page it leads to is loading (PERF-11), the link is marked busy
 * and a thin teal line shows along its bottom edge. The line is positioned over the link, so
 * nothing moves; it fades in only after a moment, so a fast page never flickers.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  const line = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const link = line.current?.closest('a');
    if (!link) return;
    if (pending) link.setAttribute('aria-busy', 'true');
    else link.removeAttribute('aria-busy');
  }, [pending]);

  return (
    <span
      ref={line}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-teal-ink transition-opacity',
        pending ? 'opacity-100 delay-150 duration-150' : 'opacity-0 delay-0 duration-0',
      )}
    />
  );
}
