import { useTranslations } from 'next-intl';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { TextLink } from '@/components/ui/text-link';

export default function LocaleNotFound() {
  const t = useTranslations('notFound');

  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <div className="mx-auto grid max-w-[75rem] gap-4 px-4 py-16 sm:px-6">
          <h1 className="text-h1 font-extrabold">{t('title')}</h1>
          <p className="text-ink-2">{t('body')}</p>
          <p>
            <TextLink href="/">{t('home')}</TextLink>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
