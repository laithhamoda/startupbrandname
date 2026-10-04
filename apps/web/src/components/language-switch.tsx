'use client';

import { useLocale, useTranslations } from 'next-intl';
import { LinkPending } from '@/components/ui/link-pending';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Links to the same page in the other language. The label is written in that language. With an
 * answer typed but not saved, the diagnostic asks before following it (LeaveGuard).
 */
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
      className="relative rounded-control px-2 py-1 text-small text-ink-2 no-underline hover:bg-sunken"
    >
      {t('switch')}
      <LinkPending />
    </Link>
  );
}
