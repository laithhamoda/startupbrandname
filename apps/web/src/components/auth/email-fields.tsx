'use client';

import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/field';
import { TextInput } from '@/components/ui/text-input';
import type { AuthErrorCode } from '@/lib/auth/actions';

/** The email field of the sign-in and sign-up forms. Addresses are always left-to-right. */
export function EmailField({
  error,
  defaultValue,
}: {
  error?: AuthErrorCode | null;
  defaultValue?: string;
}) {
  const t = useTranslations('auth');
  return (
    <Field
      id="email"
      label={t('email')}
      hint={t('emailHint')}
      error={error === 'invalidEmail' ? t('errors.invalidEmail') : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <TextInput
          id={id}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          required
          defaultValue={defaultValue}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="text-start"
        />
      )}
    </Field>
  );
}

/** A divider between the email form and the Google button. */
export function OrDivider() {
  const t = useTranslations('auth');
  return (
    <div className="flex items-center gap-3 text-small text-muted" role="separator">
      <span aria-hidden className="h-px flex-1 bg-hairline" />
      {t('or')}
      <span aria-hidden className="h-px flex-1 bg-hairline" />
    </div>
  );
}
