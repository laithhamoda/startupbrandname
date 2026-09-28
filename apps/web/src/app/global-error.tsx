'use client';

import { Button } from '@/components/ui/button';
import { GLOBAL_ERROR_TEXT } from '@/i18n/global-error';
import { cairo, tajawal } from './fonts';
import './globals.css';

const { ar, en } = GLOBAL_ERROR_TEXT;

const LINK = 'text-teal-ink underline underline-offset-4 hover:no-underline';

/**
 * The root layout itself failed, so neither the page language nor the translations are known:
 * the page has its own document, Arabic first (the default, D-067) and English after it.
 * The home links are plain anchors: a full page load starts the root layout again.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${tajawal.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <title>{`${ar.title} | ${en.title}`}</title>
        <main
          id="main"
          className="mx-auto grid w-full max-w-[75rem] content-start gap-8 px-4 py-16 sm:px-6"
        >
          <section className="grid justify-items-start gap-3">
            <h1 className="text-h1 font-extrabold">{ar.title}</h1>
            <p className="reading text-ink-2">{ar.body}</p>
          </section>
          <section lang="en" dir="ltr" className="grid justify-items-start gap-3">
            <h2 className="text-h2 font-extrabold">{en.title}</h2>
            <p className="reading text-ink-2">{en.body}</p>
          </section>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button variant="primary" onClick={retry}>
              {ar.retry}
              <span aria-hidden>·</span>
              <span lang="en" dir="ltr">
                {en.retry}
              </span>
            </Button>
            <a href="/ar" className={LINK}>
              {ar.home}
            </a>
            <a href="/en" lang="en" dir="ltr" className={LINK}>
              {en.home}
            </a>
          </div>
          {error.digest ? (
            <p className="text-small text-muted">
              {ar.reference} <bdi className="num">{error.digest}</bdi>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
