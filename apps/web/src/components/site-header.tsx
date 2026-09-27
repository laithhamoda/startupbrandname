import { useTranslations } from 'next-intl';
import { site } from '@/config/site';
import { Link } from '@/i18n/navigation';
import { HeaderMenu, type MenuLink } from './header-menu';
import { LanguageSwitch } from './language-switch';
import { ThemeToggle } from './theme-toggle';

/**
 * `public` pages are static, so they do not know whether the visitor is signed in; the signed-in
 * `app` area shows its own links.
 */
export function SiteHeader({ area }: { area: 'public' | 'app' }) {
  const t = useTranslations('meta');
  const nav = useTranslations('nav');

  const links: readonly MenuLink[] =
    area === 'public'
      ? [
          { href: '/how-it-works', label: nav('howItWorks') },
          { href: '/methodology', label: nav('methodology') },
          { href: '/pricing', label: nav('pricing') },
          { href: '/faq', label: nav('faq') },
          { href: '/login', label: nav('login') },
          { href: '/signup', label: nav('signup'), emphasis: true },
        ]
      : [
          { href: '/projects', label: nav('projects') },
          { href: '/account', label: nav('account') },
        ];

  return (
    <header className="relative border-b border-hairline">
      <div className="mx-auto flex max-w-[75rem] items-center justify-between gap-x-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-ink no-underline"
        >
          <span lang="en" dir="ltr" className="font-display text-body font-extrabold">
            {site.name}
          </span>
          <span className="text-small text-muted">{t('descriptor')}</span>
        </Link>
        <HeaderMenu label={nav('label')} menuLabel={nav('menu')} links={links}>
          <LanguageSwitch />
          <ThemeToggle />
        </HeaderMenu>
      </div>
    </header>
  );
}
