import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminTable, Cell } from '@/components/admin/fields';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { requireAdmin } from '@/lib/admin/guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.ratings');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * What founders rate their reports before the PDF (D-345): the average and the latest ratings with
 * their comments. The database function returns no account identity, so none is shown here.
 */
export default async function AdminRatingsPage() {
  const locale = await currentLocale();
  const { supabase } = await requireAdmin(locale);
  const [summary, list] = await Promise.all([
    supabase.rpc('admin_ratings_summary'),
    supabase.rpc('admin_report_ratings', { p_limit: 100 }),
  ]);
  if (summary.error || list.error) throw new Error('The ratings could not load.');
  const t = await getTranslations('admin.ratings');
  const row = summary.data[0];
  const count = row?.ratings ?? 0;
  const average = row?.average ?? null;

  return (
    <div className="mx-auto grid max-w-[75rem] gap-6 px-4 py-12 sm:px-6">
      <TextLink href="/admin">{(await getTranslations('admin'))('title')}</TextLink>
      <h1 className="text-h1 font-extrabold">{t('title')}</h1>
      {count === 0 || average === null ? (
        <p className="reading">{t('none')}</p>
      ) : (
        <>
          <p className="reading text-body-lg font-bold">
            {t.rich('summary', {
              count: () => <bdi className="num">{count}</bdi>,
              average: () => <bdi className="num">{average.toFixed(2)}</bdi>,
            })}
          </p>
          <AdminTable
            caption={t('listCaption')}
            head={[t('date'), t('stars'), t('version'), t('comment')]}
          >
            {list.data.map((item) => (
              <tr key={item.id}>
                <Cell ltr>{item.created_at.slice(0, 10)}</Cell>
                <Cell ltr>{item.stars}</Cell>
                <Cell ltr>{item.version}</Cell>
                <Cell>{item.comment}</Cell>
              </tr>
            ))}
          </AdminTable>
        </>
      )}
    </div>
  );
}
