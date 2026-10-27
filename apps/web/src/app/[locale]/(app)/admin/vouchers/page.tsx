import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ActionForm } from '@/components/admin/action-form';
import { AdminField } from '@/components/admin/fields';
import { SelectField } from '@/components/ui/select-field';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { issueBatch } from '@/lib/admin/actions';
import { requireAdmin } from '@/lib/admin/guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.vouchers');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Issues a batch of VIVA codes and shows them once (D-325, D-328). */
export default async function AdminVouchersPage() {
  const locale = await currentLocale();
  const { supabase } = await requireAdmin(locale);
  const [types, affiliates] = await Promise.all([
    supabase.rpc('admin_voucher_types'),
    supabase.rpc('admin_affiliates'),
  ]);
  if (types.error || affiliates.error) throw new Error('The voucher tools could not load.');
  const t = await getTranslations('admin.vouchers');

  return (
    <div className="mx-auto grid max-w-[75rem] gap-6 px-4 py-12 sm:px-6">
      <TextLink href="/admin">{(await getTranslations('admin'))('title')}</TextLink>
      <h1 className="text-h1 font-extrabold">{t('title')}</h1>
      <p className="reading">{t('intro')}</p>
      <ActionForm action={issueBatch.bind(null, locale)} submit={t('issue')} pending={t('issuing')}>
        <SelectField
          id="type"
          name="type"
          label={t('type')}
          required
          options={types.data.map((row) => ({
            value: row.type,
            label: `${row.type} (${row.plan_id})`,
          }))}
        />
        <AdminField
          id="count"
          name="count"
          label={t('count')}
          ltr
          inputMode="numeric"
          required
          defaultValue="10"
        />
        <SelectField
          id="affiliate"
          name="affiliate"
          label={t('affiliate')}
          options={[
            { value: '', label: t('noAffiliate') },
            ...affiliates.data.map((row) => ({ value: row.id, label: row.name })),
          ]}
        />
        <AdminField id="note" name="note" label={t('note')} hint={t('noteHint')} />
      </ActionForm>
    </div>
  );
}
