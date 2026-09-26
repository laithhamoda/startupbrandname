import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { site } from '@/config/site';
import { Link } from '@/i18n/navigation';
import { LanguageSwitch } from './language-switch';
import { ThemeToggle } from './theme-toggle';

/** `children` is the navigation for the current area (public site or signed-in app). */
export function SiteHeader({ children }: { children?: ReactNode }) {
  const t = useTranslations('meta');

  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex max-w-[75rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-ink no-underline"
        >
          <span lang="en" dir="ltr" className="font-display text-body font-extrabold">
            {site.name}
          </span>
          <span className="text-small text-muted">{t('descriptor')}</span>
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {children}
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
