'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

/** Deletion asks once more in a dialog; the action deletes the account and signs out. */
export function DeleteAccount({ action }: { action: () => Promise<void> }) {
  const t = useTranslations('account');

  return (
    <Dialog
      trigger={<Button className="text-danger">{t('deleteButton')}</Button>}
      title={t('deleteConfirmTitle')}
      description={t('deleteConfirmBody')}
    >
      <form action={action}>
        <Button type="submit" className="border-danger text-danger">
          {t('deleteConfirm')}
        </Button>
      </form>
    </Dialog>
  );
}
