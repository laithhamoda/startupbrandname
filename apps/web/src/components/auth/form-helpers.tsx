'use client';

import { type SubmitEvent, type ReactNode, startTransition, useEffect, useRef } from 'react';

/**
 * Submits a form to an action without React's automatic form reset, so a rejected submission
 * keeps what the person typed. Browser validation is off (`noValidate` on the forms): errors are
 * shown next to each field in the page language instead.
 */
export function submitTo(dispatch: (formData: FormData) => void) {
  return (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      dispatch(formData);
    });
  };
}

/** An error for the whole form, announced by screen readers as soon as it appears. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="border-s-[3px] border-danger ps-3 text-small text-danger">
      {children}
    </p>
  );
}

/**
 * A step title that takes keyboard focus when a new step appears, so screen-reader and keyboard
 * users land on the new content instead of the top of the page.
 */
export function StepHeading({ children, focus = true }: { children: ReactNode; focus?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);
  return (
    <h2 ref={heading} tabIndex={-1} className="font-display text-h3 font-bold focus:outline-none">
      {children}
    </h2>
  );
}

/** Moves focus to the first field marked invalid after a rejected submission. */
export function useFocusFirstInvalid(trigger: unknown) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const first = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    // A radio group is not focusable itself; its first option is.
    const target = first?.matches('[role="radiogroup"]')
      ? first.querySelector<HTMLElement>('[role="radio"]')
      : first;
    target?.focus();
  }, [trigger]);
  return form;
}
