import type { Inline } from '@sbn/report/model';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type ar from '../../../messages/ar.json';

/** The words of the report page's own chrome (the `report` namespace); the report's text is the model's. */
export type ReportLabels = (typeof ar)['report'];

/**
 * A sentence of the model (D-267, D-274). A string is text and React escapes it; `{ n }` is a
 * number or an amount in Western digits, isolated and drawn left to right; `{ l }` is a left-to-right
 * fragment such as a URL or a code. The model carries no markup, and nothing here sets HTML.
 */
export function InlineText({ parts }: { parts: Inline }) {
  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === 'string') return <Fragment key={index}>{part}</Fragment>;
        if ('n' in part) {
          return (
            <bdi key={index} dir="ltr" className="num">
              {part.n}
            </bdi>
          );
        }
        return (
          <bdi key={index} dir="ltr">
            {part.l}
          </bdi>
        );
      })}
    </>
  );
}

/** The URL when it is a well-formed https address, else null: only those become links (D-274). */
export function httpsUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/** A link to an outside page: https only, in a new window, without giving the page away. */
export function ExternalLink({
  url,
  children,
  className,
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  const href = httpsUrl(url);
  if (href === null) return <>{children}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('text-teal-ink underline underline-offset-4 hover:no-underline', className)}
    >
      {children}
    </a>
  );
}
