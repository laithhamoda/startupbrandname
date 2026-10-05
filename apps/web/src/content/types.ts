import type { Locale } from '@/i18n/routing';

/**
 * Public page content lives in typed server-only modules, not in messages/*.json: the message
 * catalogue is sent to the browser in full, page bodies need not be. Arabic is written first and
 * is the reference; the English version must have the same shape (content.test.ts).
 */
export type Localized<T> = Readonly<Record<Locale, T>>;

export interface PageMeta {
  /** <title> text, before " | Startup Brand Name". */
  title: string;
  description: string;
  /** Headline on the page's share image. */
  card: string;
}

export interface TitledText {
  title: string;
  body: string;
}
