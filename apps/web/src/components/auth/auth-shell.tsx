import type { ReactNode } from 'react';

/** The narrow single-column frame of the sign-in, sign-up and onboarding pages. */
export function AuthShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-xl gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <header className="grid gap-2">
        <h1 className="text-h1 font-extrabold">{title}</h1>
        {lead ? <p className="text-ink-2">{lead}</p> : null}
      </header>
      {children}
    </div>
  );
}
