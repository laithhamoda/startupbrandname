import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/client-messages';

/** The admin area: the forms of its pages read the `admin` messages. */
export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <ClientMessages namespaces={['admin']}>{children}</ClientMessages>;
}
