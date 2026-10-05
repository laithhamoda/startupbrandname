import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/client-messages';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { currentLocale } from '@/i18n/locale';
import { requireAccount } from '@/lib/auth/session';

/** Signed-in area. Only completed accounts get in; the others go to sign-in or the gate. */
export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAccount(await currentLocale());

  return (
    <>
      <SiteHeader area="app" />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* What the forms of the signed-in pages read: the account settings, a new project, its
            settings and the diagnostic editor. */}
        <ClientMessages
          namespaces={['account', 'aboutYou', 'auth.errors', 'projects', 'diagnostic']}
        >
          {children}
        </ClientMessages>
      </main>
      <SiteFooter />
    </>
  );
}
