import { useTranslations } from 'next-intl';
import { site } from '@/config/site';
import { Link } from '@/i18n/navigation';

export function SiteFooter() {
  const t = useTranslations('meta');
  const footer = useTranslations('footer');

  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-[75rem] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-6 text-caption text-muted sm:px-6">
        <p className="flex flex-wrap gap-x-3">
          <span>
            © <bdi className="num">{new Date().getFullYear()}</bdi>{' '}
            <span lang="en" dir="ltr">
              {site.name}
            </span>
          </span>
          <span>{t('descriptor')}</span>
        </p>
        <nav aria-label={footer('legal')}>
          <ul className="flex flex-wrap gap-x-4">
            <li>
              <Link href="/privacy" className="text-ink-2 underline underline-offset-4">
                {footer('privacy')}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-ink-2 underline underline-offset-4">
                {footer('terms')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
