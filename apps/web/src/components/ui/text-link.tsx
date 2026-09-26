import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/** An inline link to a page of this site; the /ar or /en prefix is added automatically. */
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn('text-teal-ink underline underline-offset-4 hover:no-underline', className)}
      {...props}
    />
  );
}
