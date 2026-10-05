'use client';

import { useTranslations } from 'next-intl';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { canTakeFocus, firstTabbable, leavesPage, TABBABLE } from '@/lib/diagnostic/leave';

/**
 * While `active` (an answer is typed but not saved), leaving the page asks first (UX-6). A link
 * to another page of the site, such as Previous, the overview, the header or the language
 * switch, opens a dialog; closing or reloading the tab gets the browser's own prompt. Leaving
 * anyway follows the same link, so it behaves exactly as without the guard.
 */
export function LeaveGuard({
  active,
  form,
}: {
  active: boolean;
  /** The answer form, which takes focus back when the clicked link can no longer take it. */
  form: RefObject<HTMLFormElement | null>;
}) {
  const t = useTranslations('diagnostic.leave');
  const [open, setOpen] = useState(false);
  // The link the founder clicked, followed if they choose to leave.
  const link = useRef<HTMLAnchorElement | null>(null);
  // Set while that link is clicked again, so the guard lets the click through.
  const leaving = useRef(false);
  // The control of the answer the founder used last, where focus goes back after Stay.
  const lastControl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = form.current;
    if (!element) return;
    function onFocusIn(event: FocusEvent) {
      if (event.target instanceof HTMLElement) lastControl.current = event.target;
    }
    element.addEventListener('focusin', onFocusIn);
    return () => {
      element.removeEventListener('focusin', onFocusIn);
    };
  }, [form]);

  useEffect(() => {
    if (!active) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function onClick(event: MouseEvent) {
      if (leaving.current) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const target = {
        href: anchor.href,
        target: anchor.target,
        download: anchor.hasAttribute('download'),
      };
      if (!leavesPage(event, target, window.location.href)) return;
      // Captured on window, before the link's own handler, so nothing navigates yet.
      event.preventDefault();
      event.stopPropagation();
      link.current = anchor;
      setOpen(true);
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('click', onClick, { capture: true });
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('click', onClick, { capture: true });
    };
  }, [active]);

  // Staying returns focus to the clicked link, as for any dialog. A header link below 1280px
  // sat in the menu panel, which closed with the dialog, so focus goes back to the answer: to the
  // control the founder used last (the city, not the country before it), else the first one.
  function returnFocus(): HTMLElement | null {
    if (canTakeFocus(link.current)) return link.current;
    if (canTakeFocus(lastControl.current)) return lastControl.current;
    return firstTabbable(form.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? []);
  }

  function leave() {
    setOpen(false);
    const anchor = link.current;
    if (!anchor) return;
    if (!anchor.isConnected) {
      window.location.assign(anchor.href);
      return;
    }
    leaving.current = true;
    try {
      anchor.click();
    } finally {
      leaving.current = false;
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      returnFocus={returnFocus}
      title={t('title')}
      description={t('body')}
    >
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={() => {
            setOpen(false);
          }}
        >
          {t('stay')}
        </Button>
        <Button className="border-danger text-danger" onClick={leave}>
          {t('go')}
        </Button>
      </div>
    </Dialog>
  );
}
