import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';
import { catalogues } from './messages';
import { routing } from './routing';

export default getRequestConfig(async ({ locale: explicit }) => {
  // Server Actions and Route Handlers have no root params, so they pass the locale explicitly,
  // as in getTranslations({ locale, namespace }). Pages and layouts use the [locale] segment.
  const requested = explicit ?? (await rootLocale());
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: catalogues[locale] };
});
