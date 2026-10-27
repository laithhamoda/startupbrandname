import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ActionForm } from '@/components/admin/action-form';
import { AdminField, AdminTable, Cell } from '@/components/admin/fields';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { createAffiliate, payCommissions } from '@/lib/admin/actions';
import { requireAdmin } from '@/lib/admin/guard';
import { centsToUsd } from '@/lib/admin/money';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.affiliates');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Affiliates, their codes and commissions; a commission is paid outside the platform (D-326). */
export default async function AdminAffiliatesPage() {
  const locale = await currentLocale();
  const { supabase } = await requireAdmin(locale);
  const { data, error } = await supabase.rpc('admin_affiliates');
  if (error) throw new Error('The affiliates could not load.');
  const t = await getTranslations('admin.affiliates');
  const usd = (cents: number) => `${centsToUsd(cents)} ${t('usd')}`;

  return (
    <div className="mx-auto grid max-w-[75rem] gap-8 px-4 py-12 sm:px-6">
      <TextLink href="/admin">{(await getTranslations('admin'))('title')}</TextLink>
      <h1 className="text-h1 font-extrabold">{t('title')}</h1>

      {data.length === 0 ? (
        <p className="reading">{t('none')}</p>
      ) : (
        <AdminTable
          caption={t('listCaption')}
          head={[
            t('name'),
            t('perCode'),
            t('issued'),
            t('activated'),
            t('due'),
            t('paid'),
            t('settle'),
          ]}
        >
          {data.map((row) => (
            <tr key={row.id}>
              <Cell>{row.name}</Cell>
              <Cell ltr>{usd(row.amount_usd_cents)}</Cell>
              <Cell ltr>{row.issued}</Cell>
              <Cell ltr>{row.activated}</Cell>
              <Cell ltr>{usd(row.due_usd_cents)}</Cell>
              <Cell ltr>{usd(row.paid_usd_cents)}</Cell>
              <Cell>
                {row.due_usd_cents > 0 ? (
                  <ActionForm
                    quiet
                    action={payCommissions.bind(null, locale, row.id)}
                    submit={t('markPaid')}
                    pending={t('marking')}
                  />
                ) : null}
              </Cell>
            </tr>
          ))}
        </AdminTable>
      )}
      <p className="reading">{t('settleHint')}</p>

      <section className="grid gap-4">
        <h2 className="text-h3 font-bold">{t('createTitle')}</h2>
        <ActionForm
          action={createAffiliate.bind(null, locale)}
          submit={t('create')}
          pending={t('creating')}
        >
          <AdminField id="name" name="name" label={t('name')} required />
          <AdminField
            id="amount"
            name="amount"
            label={t('amountLabel')}
            hint={t('amountHint')}
            ltr
            inputMode="decimal"
            required
          />
        </ActionForm>
      </section>
    </div>
  );
}
