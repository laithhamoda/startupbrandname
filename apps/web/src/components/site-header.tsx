import Link from 'next/link';
import { site } from '@/config/site';
import { ThemeToggle } from './theme-toggle';

export function SiteHeader() {
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex max-w-[75rem] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-ink no-underline"
        >
          <span lang="en" dir="ltr" className="font-display text-body font-extrabold">
            {site.name}
          </span>
          <span className="text-small text-muted">{site.descriptor}</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
