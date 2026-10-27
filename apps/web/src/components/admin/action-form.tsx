'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useActionState } from 'react';
import { FormError, submitTo } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import type { ToolState } from '@/lib/admin/actions';
import { callAction } from '@/lib/call-action';

const IDLE: ToolState = { status: 'idle' };
const FAILED: ToolState = { status: 'error', reason: 'failed' };

/**
 * One admin tool as a form: the fields are given as children, `action` is the bound server
 * action, and the answer shows below, with any text to copy (the issued codes) in a read-only box.
 * Submitting always asks the database again; nothing here grants anything.
 */
export function ActionForm({
  action,
  submit,
  pending: pendingLabel,
  quiet = false,
  children,
}: {
  action: (previous: ToolState, formData: FormData) => Promise<ToolState>;
  submit: string;
  pending: string;
  /** A small button in a table row rather than a form with fields. */
  quiet?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('admin.tools');
  const [state, dispatch, pending] = useActionState(
    (previous: ToolState, formData: FormData) =>
      callAction(() => action(previous, formData), FAILED),
    IDLE,
  );

  return (
    <form
      noValidate
      onSubmit={submitTo(dispatch)}
      className={quiet ? 'grid justify-items-start gap-2' : 'grid max-w-[28rem] gap-4'}
    >
      {children}
      {state.status === 'error' ? <FormError>{t(`errors.${state.reason}`)}</FormError> : null}
      {state.status === 'done' ? (
        <p role="status" className="font-bold">
          {state.count === undefined ? t('done') : t('doneCount', { count: state.count })}
        </p>
      ) : null}
      {state.status === 'done' && state.output ? (
        <div className="grid gap-1.5">
          <label htmlFor="tool-output" className="text-small font-bold">
            {t('outputLabel')}
          </label>
          <textarea
            id="tool-output"
            readOnly
            dir="ltr"
            rows={Math.min(state.count ?? 6, 12)}
            value={state.output}
            className="w-full rounded-control border border-control bg-surface p-3 font-mono text-small"
          />
          <p className="text-caption text-muted">{t('outputHint')}</p>
        </div>
      ) : null}
      <div>
        <Button type="submit" variant={quiet ? 'secondary' : 'primary'} disabled={pending}>
          {pending ? pendingLabel : submit}
        </Button>
      </div>
    </form>
  );
}
