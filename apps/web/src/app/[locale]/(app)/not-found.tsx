import { useTranslations } from 'next-intl';
import { TextLink } from '@/components/ui/text-link';

/** A project or page of the signed-in area that does not exist: the app header stays. */
export default function AppNotFound() {
  const t = useTranslations('notFound');

  return (
    <div className="mx-auto grid max-w-[75rem] gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-h1 font-extrabold">{t('title')}</h1>
      <p className="text-ink-2">{t('body')}</p>
      <p>
        <TextLink href="/projects">{t('projects')}</TextLink>
      </p>
    </div>
  );
}
