import { getTranslations } from 'next-intl/server';
import { publicPage, type PublicPageId } from '@/config/public-pages';
import { PAGE_META } from '@/content/pages';
import { Link } from '@/i18n/navigation';
import { currentLocale } from '@/i18n/locale';

/** Links to other public pages with their descriptions, closing each inner page. */
export async function RelatedPages({ ids }: { ids: readonly PublicPageId[] }) {
  const locale = await currentLocale();
  const t = await getTranslations('related');
  const meta = PAGE_META[locale];

  return (
    <nav aria-labelledby="related-heading" className="grid gap-5 border-t border-hairline py-10">
      <h2 id="related-heading" className="text-h3 font-bold">
        {t('heading')}
      </h2>
      <ul className="grid gap-x-10 gap-y-6 md:grid-cols-3">
        {ids.map((id) => (
          <li key={id} className="grid content-start gap-1">
            <Link
              href={publicPage(id).path || '/'}
              className="font-display font-bold text-teal-ink underline underline-offset-4 hover:no-underline"
            >
              {meta[id].title}
            </Link>
            <p className="text-small text-muted">{meta[id].description}</p>
          </li>
        ))}
      </ul>
    </nav>
  );
}
