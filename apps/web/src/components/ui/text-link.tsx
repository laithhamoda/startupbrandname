import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn('text-teal-ink underline underline-offset-4 hover:no-underline', className)}
      {...props}
    />
  );
}
