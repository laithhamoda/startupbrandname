'use client';

import { ErrorView } from '@/components/error-view';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

/**
 * A public page failed, or the signed-in area's own layout did (its account check): shown in the
 * page language with the public header, like the 404 page.
 */
export default function LocaleError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <>
      <SiteHeader area="public" />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <ErrorView digest={error.digest} retry={retry} way="home" />
      </main>
      <SiteFooter />
    </>
  );
}
