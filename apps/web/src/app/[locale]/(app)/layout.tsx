import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/client-messages';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { currentLocale } from '@/i18n/locale';
import { requireVisitor } from '@/lib/auth/session';

/**
 * Signed-in area. Only completed accounts and visitors who began without signup get in; the others go
 * to sign-in or the gate.
 */
export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  // A visitor without an account passes here (D-350); every page that is not theirs asks again.
  const { user } = await requireVisitor(await currentLocale());

  return (
    <>
      <SiteHeader area={user.isAnonymous ? 'visitor' : 'app'} />
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
