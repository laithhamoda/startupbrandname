'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/** Links to the same page in the other language. The label is written in that language. */
export function LanguageSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('language');
  const target = locale === 'ar' ? 'en' : 'ar';

  return (
    <Link
      href={pathname}
      locale={target}
      hrefLang={target}
      lang={target}
      // No prefetch: fetching the other language in the background must not change anything.
      prefetch={false}
      className="rounded-control px-2 py-1 text-small text-ink-2 no-underline hover:bg-sunken"
    >
      {t('switch')}
    </Link>
  );
}
