import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { locale as rootLocale } from 'next/root-params';
import { type Locale, routing } from './routing';

/**
 * The page language, read from the [locale] root segment. Any other value is a 404.
 * Server Components only: Server Actions and Route Handlers receive the locale explicitly.
 */
export async function currentLocale(): Promise<Locale> {
  const value = await rootLocale();
  if (!hasLocale(routing.locales, value)) notFound();
  return value;
}
