'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';

/**
 * What the error pages show (error.tsx): what happened, a retry that fetches the page again, a
 * way out, and the digest that matches the server log line (instrumentation.ts). The heading
 * takes focus, so keyboard and screen-reader users land on the explanation.
 */
export function ErrorView({
  digest,
  retry,
  way,
}: {
  digest: string | undefined;
  retry: () => void;
  /** Signed-in pages lead back to the projects, the others to the home page. */
  way: 'projects' | 'home';
}) {
  const t = useTranslations('errors');
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className="mx-auto grid max-w-[75rem] justify-items-start gap-4 px-4 py-16 sm:px-6">
      <h1 ref={heading} tabIndex={-1} className="text-h1 font-extrabold focus:outline-none">
        {t('title')}
      </h1>
      <p className="reading text-ink-2">{t('body')}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
        <Button variant="primary" onClick={retry}>
          {t('retry')}
        </Button>
        <TextLink href={way === 'projects' ? '/projects' : '/'}>{t(way)}</TextLink>
      </div>
      {digest ? (
        <p className="text-small text-muted">
          {t('reference')} <bdi className="num">{digest}</bdi>
        </p>
      ) : null}
    </div>
  );
}
