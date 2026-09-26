import { useTranslations } from 'next-intl';
import { NavLink } from './nav-link';

/** Public pages. They are static, so they do not know whether the visitor is signed in. */
export function PublicNav() {
  const t = useTranslations('nav');
  return (
    <nav aria-label={t('label')}>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <NavLink href="/login">{t('login')}</NavLink>
        </li>
        <li>
          <NavLink href="/signup" emphasis>
            {t('signup')}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

export function AppNav() {
  const t = useTranslations('nav');
  return (
    <nav aria-label={t('label')}>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <NavLink href="/projects">{t('projects')}</NavLink>
        </li>
        <li>
          <NavLink href="/account">{t('account')}</NavLink>
        </li>
      </ul>
    </nav>
  );
}
