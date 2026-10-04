import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { LinkPending } from './link-pending';

/**
 * An inline link to a page of this site; the /ar or /en prefix is added automatically. While
 * the page loads, the link shows that it is on its way (LinkPending).
 */
export function TextLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        'relative text-teal-ink underline underline-offset-4 hover:no-underline',
        className,
      )}
      {...props}
    >
      {children}
      <LinkPending />
    </Link>
  );
}
