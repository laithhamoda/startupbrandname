'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

/** Switch between the quick and full diagnostic (answers are kept), or delete the project. */
export function ProjectSettings({
  mode,
  switchMode,
  deleteProject,
}: {
  mode: 'quick' | 'full';
  switchMode: () => Promise<void>;
  deleteProject: () => Promise<void>;
}) {
  const t = useTranslations('diagnostic.overview');

  return (
    <section
      aria-labelledby="settings-heading"
      className="grid gap-4 border-t border-hairline pt-8"
    >
      <h2 id="settings-heading" className="text-h3 font-bold">
        {t('settings')}
      </h2>
      <form action={switchMode} className="grid justify-items-start gap-2">
        <p className="reading text-small text-ink-2">
          {mode === 'quick' ? t('toFullLead') : t('toQuickLead')}
        </p>
        <Button type="submit">{mode === 'quick' ? t('toFull') : t('toQuick')}</Button>
      </form>
      <div className="grid justify-items-start gap-2">
        <p className="reading text-small text-ink-2">{t('deleteLead')}</p>
        <Dialog
          trigger={<Button className="text-danger">{t('delete')}</Button>}
          title={t('deleteTitle')}
          description={t('deleteBody')}
        >
          <form action={deleteProject}>
            <Button type="submit" className="border-danger text-danger">
              {t('deleteConfirm')}
            </Button>
          </form>
        </Dialog>
      </div>
    </section>
  );
}
