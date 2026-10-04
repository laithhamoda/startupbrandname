import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerEnv } from '@/env/server';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Internal page that always fails, so the signed-in error page is tested end to end
// (e2e/auth/errors.spec.ts). Hidden in production, like /design.
export default async function FailureCheckPage() {
  if (getServerEnv().VERCEL_ENV === 'production') notFound();
  await requireAccount(await currentLocale());
  throw new Error('Failure check: this page always fails outside production.');
}
