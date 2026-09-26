import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'quiet';

// Gold is reserved for the one primary action per screen (CLAUDE.md §6), so "secondary" is the default.
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-on-gold hover:brightness-95',
  secondary: 'border border-control text-ink hover:bg-sunken',
  quiet: 'px-1 text-teal-ink underline underline-offset-4',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control px-4.5 py-2 font-display text-body font-bold transition-[background-color,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-50';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={cn(BASE, VARIANTS[variant], className)} {...props} />;
}

/** A link that looks like a button, for navigation such as "Start for free". */
export function ButtonLink({
  variant = 'secondary',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(BASE, 'no-underline', VARIANTS[variant], className)} {...props} />;
}
