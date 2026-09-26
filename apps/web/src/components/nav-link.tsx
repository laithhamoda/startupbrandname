'use client';

import type { ComponentProps } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/** A header link that marks the current page for screen readers and sighted users alike. */
export function NavLink({
  href,
  emphasis = false,
  className,
  ...props
}: ComponentProps<typeof Link> & { href: string; emphasis?: boolean }) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'rounded-control px-2 py-1 text-small text-ink-2 no-underline hover:bg-sunken aria-[current=page]:font-bold aria-[current=page]:text-ink',
        emphasis && 'border border-control px-3 text-ink',
        className,
      )}
      {...props}
    />
  );
}
