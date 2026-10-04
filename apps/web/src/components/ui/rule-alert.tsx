import type { ReactNode } from 'react';

/**
 * A rejected answer (rules R1–R8): firm, never insulting, always with an easier question or an
 * example (SPEC §2). Announced politely to screen readers, unless `live` is false: inside an area
 * that takes focus to be read (the answer editor's feedback), a live region would make screen
 * readers say it twice (UX-15). `id` names the message, for that area's label.
 */
export function RuleAlert({
  message,
  children,
  id,
  live = true,
}: {
  message: string;
  children?: ReactNode;
  id?: string;
  live?: boolean;
}) {
  return (
    <div
      {...(live ? { role: 'status' } : {})}
      className="grid gap-1.5 border-s-[3px] border-ink bg-sunken px-4 py-3 text-small"
    >
      <p id={id} className="font-bold">
        {message}
      </p>
      {children ? <div>{children}</div> : null}
    </div>
  );
}
