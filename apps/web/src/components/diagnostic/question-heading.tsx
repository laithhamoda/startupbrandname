'use client';

import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * The question, as the page's h1. After a move inside the app (Next, Previous, a link) it takes
 * focus, so keyboard and screen-reader users start at the new question instead of the top of
 * the page (WCAG 2.4.3, UX-5); the new page title is announced too. On a full page load it does
 * not: the browser starts at the top as usual. The page keys it by step, so each step mounts it
 * afresh.
 */
export function QuestionHeading({ id, children }: { id: string; children: ReactNode }) {
  // Hydration renders with the server snapshot (false); a heading mounted by a client-side
  // navigation renders with the browser's (true). Only that first render decides.
  const navigated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [focusOnMount] = useState(navigated);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);
  return (
    <h1
      ref={heading}
      id={id}
      tabIndex={-1}
      className="reading text-h2 font-extrabold focus:outline-none"
    >
      {children}
    </h1>
  );
}
