import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminTable, Cell } from '@/components/admin/fields';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { requireAdmin } from '@/lib/admin/guard';
import { centsToUsd } from '@/lib/admin/money';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.payments');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The payments Paddle reported, for reference. Refunds are made in the Paddle dashboard. */
export default async function AdminPaymentsPage() {
  const locale = await currentLocale();
  const { supabase } = await requireAdmin(locale);
  const { data, error } = await supabase.rpc('admin_payments', { p_limit: 100 });
  if (error) throw new Error('The payments could not load.');
  const t = await getTranslations('admin.payments');

  return (
    <div className="mx-auto grid max-w-[75rem] gap-6 px-4 py-12 sm:px-6">
      <TextLink href="/admin">{(await getTranslations('admin'))('title')}</TextLink>
      <h1 className="text-h1 font-extrabold">{t('title')}</h1>
      {data.length === 0 ? (
        <p className="reading">{t('none')}</p>
      ) : (
        <AdminTable
          caption={t('listCaption')}
          head={[t('email'), t('amount'), t('status'), t('date'), t('transaction')]}
        >
          {data.map((row) => (
            <tr key={row.id}>
              <Cell ltr>{row.email}</Cell>
              <Cell ltr>{`${centsToUsd(row.amount_minor)} ${t('usd')}`}</Cell>
              <Cell>{row.status}</Cell>
              <Cell ltr>{row.occurred_at.slice(0, 10)}</Cell>
              <Cell ltr>{row.provider_transaction_id}</Cell>
            </tr>
          ))}
        </AdminTable>
      )}
      <p className="reading">{t('refundHint')}</p>
    </div>
  );
}
