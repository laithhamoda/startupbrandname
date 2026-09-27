'use client';

import { Menu, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { NavLink } from './nav-link';

export interface MenuLink {
  href: string;
  label: string;
  emphasis?: boolean;
}

/**
 * The header's links and settings. From wide desktop width (1280px) they sit in one row; on smaller screens a
 * menu button opens them in a panel under the header, which closes on navigation, with Escape or
 * with a tap outside.
 */
export function HeaderMenu({
  label,
  menuLabel,
  links,
  children,
}: {
  label: string;
  menuLabel: string;
  links: readonly MenuLink[];
  /** Language and theme controls, shown after the links. */
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Remembers the page the menu was opened on, so moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const panelId = useId();
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpenOn(null);
      button.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpenOn(null);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={container}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpenOn(open ? null : pathname);
        }}
        className="inline-flex items-center gap-2 rounded-control px-2 py-1 text-small text-ink-2 hover:bg-sunken xl:hidden"
      >
        {open ? <X aria-hidden className="size-4" /> : <Menu aria-hidden className="size-4" />}
        {menuLabel}
      </button>
      <div
        id={panelId}
        className={cn(
          open ? 'grid' : 'hidden',
          'absolute inset-x-0 top-full z-40 gap-3 border-b border-hairline bg-paper px-4 py-4 shadow-overlay sm:px-6',
          'xl:static xl:flex xl:items-center xl:gap-1 xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none',
        )}
      >
        <nav aria-label={label}>
          <ul className="grid gap-1 xl:flex xl:items-center">
            {links.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  emphasis={link.emphasis}
                  className="inline-block whitespace-nowrap"
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1 border-t border-hairline pt-3 xl:border-0 xl:pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}
