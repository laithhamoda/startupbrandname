import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const controlClass =
  'w-full min-w-0 rounded-control border border-control bg-surface px-3 py-2 text-body text-ink placeholder:text-muted aria-[invalid=true]:border-danger';

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(controlClass, className)} {...props} />;
}
