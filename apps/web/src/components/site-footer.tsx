import { useTranslations } from 'next-intl';
import { site } from '@/config/site';
import { Link } from '@/i18n/navigation';

const LINK = 'text-ink-2 underline underline-offset-4 hover:no-underline';

export function SiteFooter() {
  const t = useTranslations('meta');
  const footer = useTranslations('footer');
  const nav = useTranslations('nav');

  const pages = [
    { href: '/how-it-works', label: nav('howItWorks') },
    { href: '/methodology', label: nav('methodology') },
    { href: '/pricing', label: nav('pricing') },
    { href: '/glossary', label: nav('glossary') },
    { href: '/faq', label: nav('faq') },
    { href: '/about', label: nav('about') },
  ];

  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto grid max-w-[75rem] gap-8 px-4 py-10 text-small sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-2">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span lang="en" dir="ltr" className="font-display font-extrabold text-ink">
              {site.name}
            </span>
            <span className="text-muted">{t('descriptor')}</span>
          </p>
          <p className="text-muted">{footer('disclaimer')}</p>
          <p className="text-caption text-muted">
            © <bdi className="num">{new Date().getFullYear()}</bdi>{' '}
            <span lang="en" dir="ltr">
              {site.name}
            </span>
          </p>
        </div>
        <nav aria-label={footer('site')}>
          <ul className="grid gap-2">
            {pages.map((page) => (
              <li key={page.href}>
                <Link href={page.href} className={LINK}>
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={footer('legal')}>
          <ul className="grid gap-2">
            <li>
              <Link href="/privacy" className={LINK}>
                {footer('privacy')}
              </Link>
            </li>
            <li>
              <Link href="/terms" className={LINK}>
                {footer('terms')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
