import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { type NamespacePath, ROOT_NAMESPACES, pickMessages } from '@/i18n/client-messages';

/**
 * Sends the client components inside it the namespaces they read, besides the root ones
 * (PERF-8). A nested provider replaces the one above it rather than adding to it, so the root
 * namespaces are sent again. A client component that reads a namespace its provider lacks shows
 * the message key instead of the text: wrap it here with that namespace.
 */
export async function ClientMessages({
  namespaces,
  children,
}: {
  namespaces: readonly NamespacePath[];
  children: ReactNode;
}) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={pickMessages(messages, [...ROOT_NAMESPACES, ...namespaces])}>
      {children}
    </NextIntlClientProvider>
  );
}
