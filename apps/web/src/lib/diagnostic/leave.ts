/**
 * The unsaved-answer guard (UX-6): whether the draft differs from what is saved, and whether a
 * click on a link would take the founder away from it. The draft lives only on screen; nothing
 * is kept in browser storage (owner decision, 2026-09-28).
 */

/** Whether two drafts hold the same values. Drafts are plain data: text, numbers, lists. */
export function sameDraft(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameDraft(item, b[index]))
    );
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && sameDraft(left[key], right[key]))
  );
}

/** The parts of a click that decide where it goes. */
export interface LinkClick {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

/** The parts of a link that decide where it goes. */
export interface LinkTarget {
  /** Absolute, as HTMLAnchorElement.href gives it. */
  href: string;
  target: string;
  download: boolean;
}

/**
 * Whether clicking the link takes this tab to another page of this site, which would drop the
 * draft. A new tab or window, a download, a jump within the page and a link that something else
 * already handled are not. Another site is left to the browser's own prompt (beforeunload).
 */
export function leavesPage(click: LinkClick, link: LinkTarget, here: string): boolean {
  if (click.defaultPrevented || click.button !== 0) return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if ((link.target !== '' && link.target !== '_self') || link.download) return false;
  const from = new URL(here);
  const to = new URL(link.href, from);
  if (to.origin !== from.origin) return false;
  return to.pathname !== from.pathname || to.search !== from.search;
}

/** The parts of an element that decide whether focus can go to it. */
export interface FocusCandidate {
  isConnected: boolean;
  tabIndex: number;
  /** Empty for an element that is not laid out, such as one inside a closed menu panel. */
  getClientRects(): { length: number };
}

/** Elements that may take focus; `firstTabbable` drops the ones that cannot right now. */
export const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/**
 * Whether focus can go back to `element` when the dialog closes. Below 1280px the header links
 * sit in a menu panel that closes on any click or Escape outside it, so the clicked link may be
 * hidden by then, and focusing it would drop focus to the page itself.
 */
export function canTakeFocus(element: FocusCandidate | null): boolean {
  return element !== null && element.isConnected && element.getClientRects().length > 0;
}

/**
 * The first of `elements` (in page order) that the Tab key would reach: for the answer form,
 * the answer's own field, or the chosen option of a radio group (the others have tabIndex -1).
 */
export function firstTabbable<T extends FocusCandidate>(elements: Iterable<T>): T | null {
  for (const element of elements) {
    if (element.tabIndex >= 0 && canTakeFocus(element)) return element;
  }
  return null;
}
