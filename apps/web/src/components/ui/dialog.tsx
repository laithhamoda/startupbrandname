'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactNode } from 'react';

interface OverlayPanelProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}

const closeButtonClass = 'absolute top-3 end-3 rounded-control p-1 text-ink-2 hover:bg-sunken';

function PanelBody({ title, description, children }: Omit<OverlayPanelProps, 'trigger'>) {
  const t = useTranslations('common');

  return (
    <>
      <RadixDialog.Title className="pe-8 font-display text-h3 font-bold">{title}</RadixDialog.Title>
      {description ? (
        <RadixDialog.Description className="mt-1 text-small text-muted">
          {description}
        </RadixDialog.Description>
      ) : null}
      <div className="mt-4">{children}</div>
      <RadixDialog.Close className={closeButtonClass} aria-label={t('close')}>
        <X aria-hidden className="size-5" />
      </RadixDialog.Close>
    </>
  );
}

/** Centred modal. Overlays are the only elements with a shadow (CLAUDE.md §6). */
export function Dialog({ trigger, title, description, children }: OverlayPanelProps) {
  return (
    <RadixDialog.Root>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-scrim" />
        <RadixDialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className="fixed inset-x-4 top-1/2 mx-auto max-w-lg -translate-y-1/2 bg-surface p-6 text-ink shadow-overlay"
        >
          <PanelBody title={title} description={description}>
            {children}
          </PanelBody>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Side panel on the inline end (the left in Arabic), used by the AI mentor. Full screen on phones. */
export function Drawer({ trigger, title, description, children }: OverlayPanelProps) {
  return (
    <RadixDialog.Root>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-scrim" />
        <RadixDialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className="fixed inset-y-0 end-0 flex w-full flex-col overflow-y-auto bg-surface p-6 text-ink shadow-overlay sm:max-w-sm"
        >
          <PanelBody title={title} description={description}>
            {children}
          </PanelBody>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
