'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormError, submitTo } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { callAction } from '@/lib/call-action';
import type { SettingsResult } from '@/lib/diagnostic/actions';

const IDLE: SettingsResult = { status: 'idle' };
const FAILED: SettingsResult = { status: 'error' };

/**
 * Switch between the quick and full diagnostic (answers are kept), or delete the project. Each
 * button says what it is doing while its action runs, and a failure is shown next to it; the
 * delete dialog stays open, so trying again is one click.
 */
export function ProjectSettings({
  mode,
  switchMode,
  deleteProject,
}: {
  mode: 'quick' | 'full';
  switchMode: () => Promise<SettingsResult>;
  deleteProject: () => Promise<SettingsResult>;
}) {
  const t = useTranslations('diagnostic.overview');
  const errors = useTranslations('auth.errors');
  const [switchState, switchAction, switching] = useActionState(
    () => callAction(switchMode, FAILED),
    IDLE,
  );

  return (
    <section
      aria-labelledby="settings-heading"
      className="grid gap-4 border-t border-hairline pt-8"
    >
      <h2 id="settings-heading" className="text-h3 font-bold">
        {t('settings')}
      </h2>
      <form noValidate onSubmit={submitTo(switchAction)} className="grid justify-items-start gap-2">
        <p className="reading text-small text-ink-2">
          {mode === 'quick' ? t('toFullLead') : t('toQuickLead')}
        </p>
        {switchState.status === 'error' ? <FormError>{errors('failed')}</FormError> : null}
        <Button type="submit" disabled={switching}>
          {switching ? t('switching') : mode === 'quick' ? t('toFull') : t('toQuick')}
        </Button>
      </form>
      <div className="grid justify-items-start gap-2">
        <p className="reading text-small text-ink-2">{t('deleteLead')}</p>
        <Dialog
          trigger={<Button className="text-danger">{t('delete')}</Button>}
          title={t('deleteTitle')}
          description={t('deleteBody')}
        >
          <DeleteForm deleteProject={deleteProject} />
        </Dialog>
      </div>
    </section>
  );
}

/**
 * Rendered only while the dialog is open, so each opening starts afresh: the error of an
 * earlier attempt is not shown, or announced, again before a new one.
 */
function DeleteForm({ deleteProject }: { deleteProject: () => Promise<SettingsResult> }) {
  const t = useTranslations('diagnostic.overview');
  const errors = useTranslations('auth.errors');
  const [state, dispatch, pending] = useActionState(() => callAction(deleteProject, FAILED), IDLE);

  return (
    <form noValidate onSubmit={submitTo(dispatch)} className="grid justify-items-start gap-4">
      {state.status === 'error' ? <FormError>{errors('failed')}</FormError> : null}
      <Button type="submit" disabled={pending} className="border-danger text-danger">
        {pending ? t('deleting') : t('deleteConfirm')}
      </Button>
    </form>
  );
}
