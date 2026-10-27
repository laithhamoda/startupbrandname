import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ActionForm } from '@/components/admin/action-form';
import { AdminField, AdminTable, Cell } from '@/components/admin/fields';
import { SelectField } from '@/components/ui/select-field';
import { TextLink } from '@/components/ui/text-link';
import { currentLocale } from '@/i18n/locale';
import { endSubscription, grantSubscription } from '@/lib/admin/actions';
import { requireAdmin } from '@/lib/admin/guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.subscriptions');
  return { title: t('title'), robots: { index: false, follow: false } };
}

const day = (value: string | null) => (value === null ? '—' : value.slice(0, 10));

/** Access by hand or by voucher, and the paid ones for reference (D-328). Reading it is logged. */
export default async function AdminSubscriptionsPage() {
  const locale = await currentLocale();
  const { supabase } = await requireAdmin(locale);
  const { data, error } = await supabase.rpc('admin_subscriptions', { p_limit: 100 });
  if (error) throw new Error('The subscriptions could not load.');
  const t = await getTranslations('admin.subscriptions');

  return (
    <div className="mx-auto grid max-w-[75rem] gap-8 px-4 py-12 sm:px-6">
      <TextLink href="/admin">{(await getTranslations('admin'))('title')}</TextLink>
      <h1 className="text-h1 font-extrabold">{t('title')}</h1>

      <section className="grid gap-4">
        <h2 className="text-h3 font-bold">{t('grantTitle')}</h2>
        <p className="reading">{t('grantIntro')}</p>
        <ActionForm
          action={grantSubscription.bind(null, locale)}
          submit={t('grant')}
          pending={t('granting')}
        >
          <AdminField id="email" name="email" label={t('email')} ltr inputMode="email" required />
          <SelectField
            id="plan"
            name="plan"
            label={t('plan')}
            required
            options={(['strategist', 'commander', 'course'] as const).map((plan) => ({
              value: plan,
              label: t(`plans.${plan}`),
            }))}
          />
          <AdminField
            id="project"
            name="project"
            label={t('project')}
            hint={t('projectHint')}
            ltr
          />
          <AdminField
            id="days"
            name="days"
            label={t('days')}
            ltr
            inputMode="numeric"
            required
            defaultValue="365"
          />
        </ActionForm>
      </section>

      {data.length === 0 ? (
        <p className="reading">{t('none')}</p>
      ) : (
        <AdminTable
          caption={t('listCaption')}
          head={[t('email'), t('plan'), t('source'), t('status'), t('starts'), t('ends'), t('end')]}
        >
          {data.map((row) => (
            <tr key={row.id}>
              <Cell ltr>{row.email}</Cell>
              <Cell>{row.plan_id}</Cell>
              <Cell>{row.source}</Cell>
              <Cell>{row.status}</Cell>
              <Cell ltr>{day(row.starts_at)}</Cell>
              <Cell ltr>{day(row.ends_at)}</Cell>
              <Cell>
                {row.source !== 'paddle' && row.status === 'active' ? (
                  <ActionForm
                    quiet
                    action={endSubscription.bind(null, locale, row.id)}
                    submit={t('endNow')}
                    pending={t('ending')}
                  />
                ) : null}
              </Cell>
            </tr>
          ))}
        </AdminTable>
      )}
      <p className="reading">{t('paidHint')}</p>
    </div>
  );
}
