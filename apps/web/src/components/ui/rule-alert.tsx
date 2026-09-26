import type { ReactNode } from 'react';

/**
 * A rejected answer (rules R1–R8): firm, never insulting, always with an easier question or an
 * example (SPEC §2). Announced politely to screen readers.
 */
export function RuleAlert({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div
      role="status"
      className="grid gap-1.5 border-s-[3px] border-ink bg-sunken px-4 py-3 text-small"
    >
      <p className="font-bold">{message}</p>
      {children ? <div>{children}</div> : null}
    </div>
  );
}
